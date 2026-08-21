import { supabase } from './supabase'
import { clearSensitiveClientData, reportSecurityEvent } from './runtimeSecurity'

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export const signInWithMicrosoft = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email',
      redirectTo: `${window.location.origin}/`,
    },
  })
  if (error) throw error
  return data
}

export const signUp = async ({ name, email, password }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })
  if (error) throw error
  return data
}

export const sendPasswordReset = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  })
  if (error) throw error
}

export const updatePassword = async (password) => {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export const updateAccount = async ({ fullName, email, password, avatarUrl }) => {
  const { data: authData, error: authError } = await supabase.auth.updateUser({
    ...(email ? { email } : {}),
    ...(password ? { password } : {}),
    data: { full_name: fullName, avatar_url: avatarUrl || null },
  })
  if (authError) throw authError
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: fullName, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() })
    .eq('id', authData.user.id)
    .select()
    .single()
  if (profileError) throw profileError
  return profile
}

export const uploadProfilePicture = async (userId, file) => {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/profile-${Date.now()}.${extension}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export const getLinkedIdentities = async () => {
  const { data, error } = await supabase.auth.getUserIdentities()
  if (error) throw error
  return data.identities || []
}

export const unlinkMicrosoftIdentity = async () => {
  const identities = await getLinkedIdentities()
  const microsoftIdentity = identities.find((identity) => identity.provider === 'azure')
  if (!microsoftIdentity) throw new Error('No Microsoft identity is linked to this account.')
  if (identities.length < 2) throw new Error('Microsoft cannot be unlinked because it is the only sign-in method on this account.')
  const { error } = await supabase.auth.unlinkIdentity(microsoftIdentity)
  if (error) throw error
  await reportSecurityEvent('identity_unlinked', 'high', { provider: 'azure' })
  return identities.filter((identity) => identity.id !== microsoftIdentity.id)
}

export const signOut = async () => {
  clearSensitiveClientData()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const getProfile = async (user) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (error) throw error
  if (!data) {
    await reportSecurityEvent('profile_missing', 'high', { user_id: user.id })
    return { id: user.id, full_name: user.user_metadata?.full_name || user.email.split('@')[0], role: 'Read-only', is_active: false }
  }
  return data
}
