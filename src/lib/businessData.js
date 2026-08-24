import { supabase, isSupabaseConfigured } from './supabase'

const defaultFinancialYear = () => {
  const year = new Date().getFullYear()
  return { id: null, start: `${year}-01-01`, end: `${year}-12-31` }
}

const toFinancialYear = (row) => row ? ({ id: row.id, name: row.name, start: row.start_date, end: row.end_date }) : defaultFinancialYear()
const toSla = (row) => ({ id: row.id, contractId: row.contract_id, title: row.title, service: row.service, availabilityTarget: Number(row.availability_target), responseHours: Number(row.response_hours), resolutionHours: Number(row.resolution_hours), startDate: row.start_date, endDate: row.end_date, reviewFrequency: row.review_frequency, status: row.status, createdAt: row.created_at })

export async function fetchBusinessData(userId) {
  if (!isSupabaseConfigured) return { financialYear: defaultFinancialYear(), partners: [], slas: [], readNotificationIds: [] }
  const [yearResult, partnerResult, targetResult, saleResult, slaResult, readResult] = await Promise.all([
    supabase.from('financial_years').select('*').eq('is_active', true).maybeSingle(),
    supabase.from('partners').select('*').eq('is_active', true).order('name'),
    supabase.from('partner_targets').select('*'),
    supabase.from('partner_sales').select('*, companies(name)').order('sale_date', { ascending: false }),
    supabase.from('service_level_agreements').select('*').order('end_date'),
    supabase.from('notification_reads').select('followup_id').eq('user_id', userId),
  ])
  const failed = [yearResult, partnerResult, targetResult, saleResult, slaResult, readResult].find((result) => result.error)
  if (failed) throw failed.error
  const financialYear = toFinancialYear(yearResult.data)
  const targets = new Map(targetResult.data.filter((row) => row.financial_year_id === financialYear.id).map((row) => [row.partner_id, row]))
  const salesByTarget = new Map()
  saleResult.data.forEach((row) => {
    const entries = salesByTarget.get(row.partner_target_id) || []
    entries.push({ id: row.id, amount: Number(row.amount), date: row.sale_date, product: row.product, reference: row.reference || '', clientId: row.company_id, clientName: row.companies?.name || row.manual_client_name, clientSource: row.company_id ? 'company-record' : 'manual', createdAt: row.created_at })
    salesByTarget.set(row.partner_target_id, entries)
  })
  const partners = partnerResult.data.map((row) => {
    const target = targets.get(row.id)
    const sales = target ? (salesByTarget.get(target.id) || []) : []
    const openingSales = Number(target?.opening_sales_amount || 0)
    return { id: row.id, targetId: target?.id || null, name: row.name, productCategory: row.product_category, owner: row.owner_name, annualTarget: Number(target?.target_amount || 0), openingSales, salesAchieved: openingSales + sales.reduce((sum, sale) => sum + sale.amount, 0), sales }
  })
  return { financialYear, partners, slas: slaResult.data.map(toSla), readNotificationIds: readResult.data.map((row) => row.followup_id) }
}

export async function saveFinancialYear(start, end) {
  const { data, error } = await supabase.rpc('set_active_financial_year', { p_start: start, p_end: end })
  if (error) throw error
  return toFinancialYear(data)
}

export async function savePartnerTarget(partner, financialYearId) {
  const { error } = await supabase.rpc('save_partner_target', { p_partner_id: partner.id || null, p_name: partner.name, p_product_category: partner.productCategory, p_owner_name: partner.owner, p_financial_year_id: financialYearId, p_target_amount: partner.annualTarget, p_opening_sales_amount: partner.salesAchieved || 0 })
  if (error) throw error
}

export async function recordPartnerSale(partnerTargetId, sale) {
  const { error } = await supabase.rpc('record_partner_sale', { p_partner_target_id: partnerTargetId, p_company_id: sale.clientId || null, p_manual_client_name: sale.clientId ? null : sale.clientName, p_product: sale.product, p_amount: sale.amount, p_sale_date: sale.date, p_reference: sale.reference || null })
  if (error) throw error
}

export async function saveServiceLevelAgreement(sla) {
  const row = { ...(sla.id ? { id: sla.id } : {}), contract_id: sla.contractId, title: sla.title, service: sla.service, availability_target: sla.availabilityTarget, response_hours: sla.responseHours, resolution_hours: sla.resolutionHours, start_date: sla.startDate, end_date: sla.endDate, review_frequency: sla.reviewFrequency, status: sla.status, updated_at: new Date().toISOString() }
  const { data, error } = await supabase.from('service_level_agreements').upsert(row).select().single()
  if (error) throw error
  return toSla(data)
}

export async function markNotificationsRead(userId, followupIds) {
  if (!followupIds.length) return
  const { error } = await supabase.from('notification_reads').upsert(followupIds.map((followupId) => ({ user_id: userId, followup_id: followupId })), { onConflict: 'user_id,followup_id' })
  if (error) throw error
}
