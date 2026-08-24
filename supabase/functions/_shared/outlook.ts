import { createClient } from 'npm:@supabase/supabase-js@2'

export const provider = 'microsoft_outlook'
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...corsHeaders, ...headers } })
export const corsHeaders = {
  'access-control-allow-origin': Deno.env.get('CONTRACTCONNECT_APP_ORIGIN') || '',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
  'vary': 'Origin',
}
export const requiredEnv = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`${name} is not configured`); return value }
export const adminClient = () => createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
export const authenticate = async (request: Request) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Missing user authorization')
  const admin = adminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Invalid user authorization')
  const { data: profile } = await admin.from('profiles').select('is_active').eq('id', data.user.id).single()
  if (!profile?.is_active) throw new Error('User access is not active')
  return { admin, user: data.user }
}
const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
const encryptionKey = async () => crypto.subtle.importKey('raw', base64ToBytes(requiredEnv('OUTLOOK_TOKEN_ENCRYPTION_KEY')), 'AES-GCM', false, ['encrypt','decrypt'])
export const encrypt = async (value: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(value))
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}
export const decrypt = async (value: string) => {
  const [iv, encrypted] = value.split('.')
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, await encryptionKey(), base64ToBytes(encrypted))
  return new TextDecoder().decode(decrypted)
}
export const sha256 = async (value: string) => bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
export const randomUrlToken = (length = 48) => bytesToBase64(crypto.getRandomValues(new Uint8Array(length))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
export const tokenEndpoint = () => `https://login.microsoftonline.com/${encodeURIComponent(requiredEnv('OUTLOOK_TENANT_ID'))}/oauth2/v2.0/token`
export const redirectUri = () => requiredEnv('OUTLOOK_REDIRECT_URI')
export const exchangeToken = async (body: URLSearchParams) => {
  const response = await fetch(tokenEndpoint(), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error_description || result.error || `Microsoft token exchange failed (${response.status})`)
  return result
}
export async function getValidAccessToken(admin: ReturnType<typeof adminClient>, userId: string) {
  const { data: credential, error } = await admin.from('integration_credentials').select('*').eq('user_id', userId).eq('provider', provider).single()
  if (error || !credential) throw new Error('Outlook is not connected')
  if (new Date(credential.access_token_expires_at).getTime() > Date.now() + 300000) return decrypt(credential.encrypted_access_token)
  const refreshToken = await decrypt(credential.encrypted_refresh_token)
  const token = await exchangeToken(new URLSearchParams({ client_id: requiredEnv('OUTLOOK_CLIENT_ID'), client_secret: requiredEnv('OUTLOOK_CLIENT_SECRET'), grant_type: 'refresh_token', refresh_token: refreshToken, redirect_uri: redirectUri() }))
  await admin.from('integration_credentials').update({ encrypted_access_token: await encrypt(token.access_token), encrypted_refresh_token: await encrypt(token.refresh_token || refreshToken), access_token_expires_at: new Date(Date.now() + Number(token.expires_in) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId).eq('provider', provider)
  return token.access_token as string
}
