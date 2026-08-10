import { supabase } from './supabase'

export async function fetchTeam() {
  const { data, error } = await supabase.from('profiles').select('id,full_name,role,is_active,avatar_url,created_at').order('created_at')
  if (error) throw error
  return data
}

export async function updateTeamAccess(id, isActive) {
  const { data, error } = await supabase.from('profiles').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function updateTeamRole(id, role) {
  const { data, error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function fetchAuditLogs() {
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw error
  }
  return data
}
