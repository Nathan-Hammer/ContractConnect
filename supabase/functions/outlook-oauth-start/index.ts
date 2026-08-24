import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { authenticate, corsHeaders, encrypt, json, provider, randomUrlToken, redirectUri, requiredEnv, sha256 } from '../_shared/outlook.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { admin, user } = await authenticate(request)
    const { email = false, calendar = false, sharepoint = false, returnUrl } = await request.json()
    if (!email && !calendar && !sharepoint) return json({ error: 'Select at least one Microsoft integration' }, 400)
    const allowedOrigin = requiredEnv('CONTRACTCONNECT_APP_ORIGIN')
    const destination = new URL(returnUrl || allowedOrigin)
    if (destination.origin !== allowedOrigin) return json({ error: 'Invalid return URL' }, 400)
    const state = randomUrlToken()
    const verifier = randomUrlToken(64)
    await admin.from('integration_oauth_states').delete().lt('expires_at', new Date().toISOString())
    const { error } = await admin.from('integration_oauth_states').insert({ state_hash: await sha256(state), user_id: user.id, provider, encrypted_code_verifier: await encrypt(verifier), email_requested: Boolean(email), calendar_requested: Boolean(calendar), sharepoint_requested: Boolean(sharepoint), return_url: destination.toString(), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
    if (error) throw error
    const scopes = ['openid','profile','email','offline_access','User.Read', ...(email ? ['Mail.Read'] : []), ...(calendar ? ['Calendars.Read'] : []), ...(sharepoint ? ['Sites.Read.All'] : [])]
    const authorize = new URL(`https://login.microsoftonline.com/${encodeURIComponent(requiredEnv('OUTLOOK_TENANT_ID'))}/oauth2/v2.0/authorize`)
    authorize.search = new URLSearchParams({ client_id: requiredEnv('OUTLOOK_CLIENT_ID'), response_type: 'code', redirect_uri: redirectUri(), response_mode: 'query', scope: scopes.join(' '), state, code_challenge: await sha256(verifier), code_challenge_method: 'S256', prompt: 'select_account' }).toString()
    return json({ authorizationUrl: authorize.toString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outlook authorization could not start'
    console.error('outlook_oauth_start_failed', message)
    return json({ error: message }, 400)
  }
})
