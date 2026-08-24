import { isSupabaseConfigured, supabase } from './supabase'

const isProduction = import.meta.env.PROD
export const allowPublicSignup = String(import.meta.env.VITE_ALLOW_PUBLIC_SIGNUP || '').toLowerCase() === 'true'

const SENSITIVE_STORAGE_KEYS = ['contractconnect-data-v1', 'contractconnect-company-view']
const allowedSeverities = new Set(['info', 'warning', 'high', 'critical'])

function safeContext(context = {}) {
  return Object.fromEntries(Object.entries(context).slice(0, 20).map(([key, value]) => [
    String(key).slice(0, 64),
    typeof value === 'string' ? value.slice(0, 500) : value,
  ]))
}

export async function reportSecurityEvent(eventType, severity = 'warning', context = {}) {
  const payload = {
    event_type: String(eventType).slice(0, 100),
    severity: allowedSeverities.has(severity) ? severity : 'warning',
    context: safeContext(context),
    page_path: window.location.pathname.slice(0, 500),
  }

  if (!isSupabaseConfigured) {
    if (!isProduction) console.warn('[security-event]', payload)
    return
  }

  try {
    const { error } = await supabase.from('security_events').insert(payload)
    if (error && !['42P01', 'PGRST205', '42501'].includes(error.code)) throw error
  } catch (error) {
    console.warn('Security event could not be recorded:', error.message)
  }
}

export function clearSensitiveClientData() {
  SENSITIVE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
}

function assertSecureRuntimeConfiguration() {
  if (!isProduction) return
  if (!isSupabaseConfigured) throw new Error('Production requires a configured Supabase connection.')
  if (allowPublicSignup) throw new Error('Public sign-up must be disabled in production.')
}

export function installRuntimeProtection() {
  assertSecureRuntimeConfiguration()
  if (isSupabaseConfigured) clearSensitiveClientData()

  const onCspViolation = (event) => reportSecurityEvent('csp_violation', 'high', {
    blocked_uri: event.blockedURI,
    violated_directive: event.violatedDirective,
    source_file: event.sourceFile,
    line_number: event.lineNumber,
  })
  const onUnhandledRejection = (event) => reportSecurityEvent('unhandled_promise_rejection', 'warning', {
    reason: event.reason?.message || String(event.reason || 'unknown'),
  })
  const onWindowError = (event) => reportSecurityEvent('runtime_error', 'warning', {
    message: event.message,
    source: event.filename,
    line_number: event.lineno,
  })

  window.addEventListener('securitypolicyviolation', onCspViolation)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  window.addEventListener('error', onWindowError)

  return () => {
    window.removeEventListener('securitypolicyviolation', onCspViolation)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
    window.removeEventListener('error', onWindowError)
  }
}

export function startSessionGuard(onInvalidSession, intervalMs = 5 * 60 * 1000) {
  if (!isSupabaseConfigured) return () => {}
  let checking = false
  const verify = async () => {
    if (checking || document.visibilityState === 'hidden') return
    checking = true
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        await reportSecurityEvent('session_verification_failed', 'high', { reason: error?.message || 'missing user' })
        clearSensitiveClientData()
        onInvalidSession()
      }
    } finally {
      checking = false
    }
  }
  const timer = window.setInterval(verify, intervalMs)
  const onVisibility = () => document.visibilityState === 'visible' && verify()
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
