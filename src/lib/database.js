import { supabase, isSupabaseConfigured } from './supabase'
import { seedData } from '../data'

const toCompany = (row) => ({
  id: row.id, name: row.name, industry: row.industry, location: row.location,
  status: row.status, website: row.website || '', phone: row.phone || '',
  owner: row.owner, initials: row.initials, color: row.color, notes: row.notes || '',
})
const toContact = (row) => ({
  id: row.id, companyId: row.company_id, name: row.name, role: row.role,
  email: row.email, phone: row.phone || '', primary: row.is_primary,
})
const toContract = (row) => ({
  id: row.id, companyId: row.company_id, title: row.title, value: Number(row.value),
  startDate: row.start_date, endDate: row.end_date, status: row.status,
  renewalNoticeDays: row.renewal_notice_days || 60, autoRenew: Boolean(row.auto_renew),
  terminationNoticeDate: row.termination_notice_date || '',
})
const toInteraction = (row) => ({
  id: row.id, companyId: row.company_id, contactId: row.contact_id,
  type: row.type, date: row.interaction_date, summary: row.summary, notes: row.notes || '',
})
const toFollowup = (row) => ({ id: row.id, companyId: row.company_id, contactId: row.contact_id, title: row.title, dueDate: row.due_date, priority: row.priority, completed: row.completed })

const fromCompany = (item) => ({
  id: item.id, name: item.name, industry: item.industry, location: item.location,
  status: item.status, website: item.website || null, phone: item.phone || null,
  owner: item.owner, initials: item.initials, color: item.color, notes: item.notes || null,
})
const fromInteraction = (item) => ({
  id: item.id, company_id: item.companyId, contact_id: item.contactId || null,
  type: item.type, interaction_date: item.date, summary: item.summary, notes: item.notes || null,
})
const fromContact = (item) => ({
  id: item.id, company_id: item.companyId, name: item.name, role: item.role,
  email: item.email, phone: item.phone || null, is_primary: Boolean(item.primary),
})
const fromContract = (item) => ({
  id: item.id, company_id: item.companyId, title: item.title, value: Number(item.value),
  start_date: item.startDate, end_date: item.endDate, status: item.status,
  renewal_notice_days: Number(item.renewalNoticeDays || 60), auto_renew: Boolean(item.autoRenew),
  termination_notice_date: item.terminationNoticeDate || null,
})
const fromFollowup = (item) => ({ id: item.id, company_id: item.companyId, contact_id: item.contactId || null, title: item.title, due_date: item.dueDate, priority: item.priority, completed: Boolean(item.completed), completed_at: item.completed ? new Date().toISOString() : null })

export async function fetchCrmData() {
  if (!isSupabaseConfigured) return null
  const [companies, contacts, contracts, interactions, followups] = await Promise.all([
    supabase.from('companies').select('*').order('name'),
    supabase.from('contacts').select('*').order('name'),
    supabase.from('contracts').select('*').order('end_date'),
    supabase.from('interactions').select('*').order('interaction_date', { ascending: false }),
    supabase.from('followups').select('*').order('due_date'),
  ])
  const failed = [companies, contacts, contracts, interactions, followups].find((result) => result.error)
  if (failed) throw failed.error
  return {
    companies: companies.data.map(toCompany),
    contacts: contacts.data.map(toContact),
    contracts: contracts.data.map(toContract),
    interactions: interactions.data.map(toInteraction),
    followups: followups.data.map(toFollowup),
  }
}

export async function seedDemoData() {
  if (!isSupabaseConfigured) return seedData
  const operations = [
    ['companies', seedData.companies.map(fromCompany)],
    ['contacts', seedData.contacts.map(fromContact)],
    ['contracts', seedData.contracts.map(fromContract)],
    ['interactions', seedData.interactions.map(fromInteraction)],
    ['followups', seedData.followups.map(fromFollowup)],
  ]
  for (const [table, rows] of operations) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }
  return fetchCrmData()
}

export async function resetDemoData() {
  if (!isSupabaseConfigured) return seedData
  for (const table of ['followups', 'interactions', 'contracts', 'contacts', 'companies']) {
    const { error } = await supabase.from(table).delete().neq('id', '')
    if (error) throw error
  }
  return seedDemoData()
}

export async function createCompany(company) {
  if (!isSupabaseConfigured) return company
  const { data, error } = await supabase.from('companies').insert(fromCompany(company)).select().single()
  if (error) throw error
  return toCompany(data)
}

export async function createInteraction(interaction) {
  if (!isSupabaseConfigured) return interaction
  const { data, error } = await supabase.from('interactions').insert(fromInteraction(interaction)).select().single()
  if (error) throw error
  return toInteraction(data)
}

export async function saveRecord(kind, item) {
  if (!isSupabaseConfigured) return item
  const config = {
    companies: { table: 'companies', from: fromCompany, to: toCompany },
    contacts: { table: 'contacts', from: fromContact, to: toContact },
    contracts: { table: 'contracts', from: fromContract, to: toContract },
    interactions: { table: 'interactions', from: fromInteraction, to: toInteraction },
    followups: { table: 'followups', from: fromFollowup, to: toFollowup },
  }[kind]
  if (!config) throw new Error(`Unsupported record type: ${kind}`)
  const { data, error } = await supabase.from(config.table).upsert(config.from(item)).select().single()
  if (error) throw error
  return config.to(data)
}

export async function deleteRecord(kind, id) {
  if (!isSupabaseConfigured) return
  const allowed = ['companies', 'contacts', 'contracts', 'interactions', 'followups']
  if (!allowed.includes(kind)) throw new Error(`Unsupported record type: ${kind}`)
  const { error } = await supabase.from(kind).delete().eq('id', id)
  if (error) throw error
}
