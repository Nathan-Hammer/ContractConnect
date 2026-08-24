import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { adminClient, decrypt, encrypt, exchangeToken, provider, redirectUri, requiredEnv, sha256 } from '../_shared/outlook.ts'

const redirect = (url: string, outcome: string) => { const target = new URL(url); target.searchParams.set('outlook', outcome); return Response.redirect(target.toString(), 302) }
Deno.serve(async (request) => {
  const fallback = requiredEnv('CONTRACTCONNECT_APP_ORIGIN')
  try {
    const url = new URL(request.url)
    const state = url.searchParams.get('state') || ''
    const code = url.searchParams.get('code') || ''
    if (!state || !code || url.searchParams.get('error')) throw new Error(url.searchParams.get('error_description') || 'Microsoft authorization was cancelled')
    const admin = adminClient()
    const { data: oauth, error } = await admin.from('integration_oauth_states').delete().eq('state_hash', await sha256(state)).gt('expires_at', new Date().toISOString()).select().single()
    if (error || !oauth) throw new Error('Authorization state is invalid or expired')
    const token = await exchangeToken(new URLSearchParams({ client_id: requiredEnv('OUTLOOK_CLIENT_ID'), client_secret: requiredEnv('OUTLOOK_CLIENT_SECRET'), grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: await decrypt(oauth.encrypted_code_verifier) }))
    if (!token.refresh_token) throw new Error('Microsoft did not issue an offline refresh token')
    const meResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName', { headers: { authorization: `Bearer ${token.access_token}` } })
    if (!meResponse.ok) throw new Error(`Microsoft profile lookup failed (${meResponse.status})`)
    const me = await meResponse.json()
    const now = new Date().toISOString()
    const connection = { user_id: oauth.user_id, provider, status: 'connected', email_enabled: oauth.email_requested, calendar_enabled: oauth.calendar_requested, sharepoint_enabled: oauth.sharepoint_requested, provider_account_id: me.id, provider_email: me.mail || me.userPrincipalName, granted_scopes: String(token.scope || '').split(' ').filter(Boolean), last_success_at: now, last_error: null, connected_at: now, updated_at: now }
    const { error: connectionError } = await admin.from('integration_connections').upsert(connection)
    if (connectionError) throw connectionError
    const { error: credentialError } = await admin.from('integration_credentials').upsert({ user_id: oauth.user_id, provider, encrypted_access_token: await encrypt(token.access_token), encrypted_refresh_token: await encrypt(token.refresh_token), access_token_expires_at: new Date(Date.now() + Number(token.expires_in) * 1000).toISOString(), updated_at: now })
    if (credentialError) throw credentialError
    return redirect(oauth.return_url, 'connected')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    return redirect(fallback, 'error')
  }
})
