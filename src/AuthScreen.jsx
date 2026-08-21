import { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, FileText, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { sendPasswordReset, signIn, signInWithMicrosoft, signUp, updatePassword } from './lib/auth'
import { allowPublicSignup } from './lib/runtimeSecurity'

export default function AuthScreen({ recovery = false }) {
  const [mode, setMode] = useState(recovery ? 'update' : 'signin')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const switchMode = (next) => { setMode(next); setError(''); setMessage('') }

  const microsoftSignIn = async () => {
    setLoading(true); setError(''); setMessage('')
    try { await signInWithMicrosoft() }
    catch (err) { setError(err.message || 'Microsoft sign-in could not be started. Please try again.'); setLoading(false) }
  }

  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError(''); setMessage('')
    try {
      if ((mode === 'signup' || mode === 'update') && form.password !== form.confirm) throw new Error('The passwords do not match.')
      if (mode === 'signin') await signIn(form.email.trim(), form.password)
      if (mode === 'signup') {
        const result = await signUp({ name: form.name.trim(), email: form.email.trim(), password: form.password })
        if (!result.session) setMessage('Check your inbox to confirm your email address, then sign in.')
      }
      if (mode === 'forgot') {
        await sendPasswordReset(form.email.trim())
        setMessage('Password reset instructions have been sent to your email address.')
      }
      if (mode === 'update') {
        await updatePassword(form.password)
        setMessage('Your password has been updated. You can now continue to ContractConnect.')
      }
    } catch (err) { setError(err.message || 'Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  const heading = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'update' ? 'Choose a new password' : 'Welcome back'
  const intro = mode === 'signup' ? 'Start managing your company relationships in one place.' : mode === 'forgot' ? 'Enter your email and we’ll send you a secure reset link.' : mode === 'update' ? 'Use at least eight characters for your new password.' : 'Sign in to continue to your relationship workspace.'

  return <main className="auth-page">
    <section className="auth-story">
      <div className="auth-brand"><span className="brand-mark"><FileText size={20} /></span><span>Contract<span>Connect</span></span></div>
      <div className="story-copy"><span className="eyebrow">Relationship intelligence</span><h1>Every contract starts with a connection.</h1><p>Keep your companies, contacts, agreements, and conversations together—so your team always knows what comes next.</p></div>
      <div className="story-stat"><strong>One clear view</strong><span>of every client relationship</span></div>
    </section>
    <section className="auth-form-side"><div className="auth-card">
      {(mode === 'forgot' || mode === 'update') && <button className="auth-back" type="button" onClick={() => switchMode('signin')}><ArrowLeft size={16} /> Back to sign in</button>}
      <span className="auth-lock"><LockKeyhole size={19} /></span><h2>{heading}</h2><p>{intro}</p>
      {mode === 'signin' && <><button className="microsoft-signin" type="button" onClick={microsoftSignIn} disabled={loading}><span className="microsoft-mark" aria-hidden="true"><i /><i /><i /><i /></span> Continue with Microsoft</button><div className="auth-divider"><span>or sign in with email</span></div></>}
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <label>Full name<div className="auth-input"><UserRound size={17} /><input required autoFocus name="name" value={form.name} onChange={change} placeholder="Your full name" /></div></label>}
        {mode !== 'update' && <label>Email address<div className="auth-input"><Mail size={17} /><input required autoFocus={mode !== 'signup'} type="email" name="email" autoComplete="email" value={form.email} onChange={change} placeholder="you@company.com" /></div></label>}
        {mode !== 'forgot' && <label>Password<div className="auth-input"><LockKeyhole size={17} /><input required minLength="8" type={showPassword ? 'text' : 'password'} name="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={form.password} onChange={change} placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
        {(mode === 'signup' || mode === 'update') && <label>Confirm password<div className="auth-input"><LockKeyhole size={17} /><input required minLength="8" type={showPassword ? 'text' : 'password'} name="confirm" autoComplete="new-password" value={form.confirm} onChange={change} placeholder="Repeat your password" /></div></label>}
        {mode === 'signin' && <button className="forgot-link" type="button" onClick={() => switchMode('forgot')}>Forgot password?</button>}
        {error && <div className="auth-alert error" role="alert">{error}</div>}
        {message && <div className="auth-alert success" role="status">{message}</div>}
        <button className="btn primary auth-submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'update' ? 'Update password' : 'Sign in'}</button>
      </form>
      {mode === 'signin' && !allowPublicSignup && <div className="auth-switch">Access is invitation-only. Contact your ContractConnect administrator.</div>}
      {((mode === 'signin' && allowPublicSignup) || mode === 'signup') && <div className="auth-switch">{mode === 'signin' ? 'New to ContractConnect?' : 'Already have an account?'} <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></div>}
    </div><p className="auth-footer">Securely powered by Supabase authentication and Microsoft Entra ID</p></section>
  </main>
}
