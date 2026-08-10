import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, Building2, CalendarDays, Check, CheckSquare2, ChevronRight, CircleDollarSign, Clock3, Database, Download,
  ExternalLink, FileSpreadsheet, FileText, FolderOpen, History, LayoutDashboard, Mail, MapPin, Menu, MessageSquareText, Moon,
  LogOut, MoreHorizontal, Pencil, Phone, Plus, RefreshCcw, Search, Settings, ShieldCheck, Sun, Trash2, Upload, Users, X,
} from 'lucide-react'
import { seedData } from './data'
import AuthScreen from './AuthScreen'
import { deleteRecord, fetchCrmData, resetDemoData, saveRecord, seedDemoData } from './lib/database'
import { deleteContractDocument, fetchDocuments, openContractDocument, uploadContractDocument } from './lib/documents'
import { fetchAuditLogs, fetchTeam, updateTeamAccess, updateTeamRole } from './lib/governance'
import { getProfile, getSession, signOut, updateAccount, uploadProfilePicture } from './lib/auth'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { clearSensitiveClientData, demoMode, reportSecurityEvent, startSessionGuard } from './lib/runtimeSecurity'

const STORAGE_KEY = 'contractconnect-data-v1'
const navItems = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'contracts', label: 'Contracts', icon: FileText },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'interactions', label: 'Interactions', icon: MessageSquareText },
  { id: 'followups', label: 'Follow-ups', icon: CheckSquare2 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
]

const cloneSeed = () => JSON.parse(JSON.stringify(seedData))
const formatDate = (value) => new Intl.DateTimeFormat('en-NA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const formatMoney = (value) => new Intl.NumberFormat('en-NA', { style: 'currency', currency: 'NAD', maximumFractionDigits: 0 }).format(value)
const initials = (name = '') => name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
const today = new Date().toISOString().slice(0, 10)
const daysUntil = (date) => Math.ceil((new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000)
const contractStatus = (contract) => {
  if (contract.status === 'Draft' || contract.status === 'Terminated') return contract.status
  const days = daysUntil(contract.endDate)
  if (days < 0) return 'Expired'
  if (days <= Number(contract.renewalNoticeDays || 60)) return 'Expiring soon'
  return 'Active'
}

function loadData() {
  if (isSupabaseConfigured && !demoMode) return { companies: [], contacts: [], contracts: [], interactions: [], followups: [] }
  try { return { ...cloneSeed(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) } }
  catch { return cloneSeed() }
}

function Status({ children }) {
  const type = String(children).toLowerCase().replaceAll(' ', '-')
  return <span className={`status status-${type}`}><span />{children}</span>
}

function Avatar({ name, color, src }) {
  return <span className="avatar" style={{ background: color || '#dfe9e5' }}>{src ? <img src={src} alt="" /> : initials(name)}</span>
}

function Empty({ title, text }) {
  return <div className="empty"><Search size={24} /><strong>{title}</strong><p>{text}</p></div>
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true">
      <div className="modal-head"><div><span className="eyebrow">ContractConnect</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      {children}
    </section>
  </div>
}

function CompanyForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', industry: '', location: '', status: 'Active', website: '', phone: '', owner: '', notes: '' })
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    onSave({ ...form, id: form.id || crypto.randomUUID(), initials: initials(form.name), color: form.color || ['#e07045', '#498f81', '#546fa8', '#9568a8'][Math.floor(Math.random() * 4)] })
  }
  return <form onSubmit={submit} className="form-grid">
    <label className="full">Company name<input autoFocus required name="name" value={form.name} onChange={change} placeholder="e.g. Acacia Holdings" /></label>
    <label>Industry<input required name="industry" value={form.industry} onChange={change} placeholder="Industry" /></label>
    <label>Location<input required name="location" value={form.location} onChange={change} placeholder="City" /></label>
    <label>Status<select name="status" value={form.status} onChange={change}><option>Active</option><option>Prospect</option><option>Renewal due</option><option>Inactive</option></select></label>
    <label>Account owner<input required name="owner" value={form.owner} onChange={change} placeholder="Team member" /></label>
    <label>Website<input name="website" value={form.website} onChange={change} placeholder="company.com" /></label>
    <label>Phone<input name="phone" value={form.phone} onChange={change} placeholder="+264 ..." /></label>
    <label className="full">Notes<textarea name="notes" value={form.notes} onChange={change} placeholder="Important relationship notes" /></label>
    <div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">{initial ? 'Save changes' : 'Add company'}</button></div>
  </form>
}

function InteractionForm({ companies, contacts, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { companyId: companies[0]?.id || '', contactId: '', type: 'Call', date: today, summary: '', notes: '' })
  const available = contacts.filter((contact) => contact.companyId === form.companyId)
  const change = (e) => {
    const next = { ...form, [e.target.name]: e.target.value }
    if (e.target.name === 'companyId') next.contactId = ''
    setForm(next)
  }
  return <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, id: form.id || crypto.randomUUID() }) }} className="form-grid">
    <label>Company<select required name="companyId" value={form.companyId} onChange={change}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Contact<select name="contactId" value={form.contactId} onChange={change}><option value="">No contact selected</option>{available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Interaction type<select name="type" value={form.type} onChange={change}><option>Call</option><option>Meeting</option><option>Email</option><option>Note</option></select></label>
    <label>Date<input required type="date" name="date" value={form.date} onChange={change} /></label>
    <label className="full">Summary<input autoFocus required name="summary" value={form.summary} onChange={change} placeholder="What was this about?" /></label>
    <label className="full">Notes<textarea name="notes" value={form.notes} onChange={change} placeholder="Decisions, context, and next steps" /></label>
    <div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">{initial ? 'Save changes' : 'Save interaction'}</button></div>
  </form>
}

function ContactForm({ companies, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { companyId: companies[0]?.id || '', name: '', role: '', email: '', phone: '', primary: false })
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  return <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, id: form.id || crypto.randomUUID() }) }} className="form-grid">
    <label className="full">Company<select required name="companyId" value={form.companyId} onChange={change}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Full name<input autoFocus required name="name" value={form.name} onChange={change} placeholder="Contact name" /></label>
    <label>Job title<input required name="role" value={form.role} onChange={change} placeholder="e.g. Finance Manager" /></label>
    <label>Email address<input required type="email" name="email" value={form.email} onChange={change} placeholder="name@company.com" /></label>
    <label>Phone<input name="phone" value={form.phone} onChange={change} placeholder="+264 ..." /></label>
    <label className="checkbox-label full"><input type="checkbox" name="primary" checked={form.primary} onChange={change} /> Primary contact for this company</label>
    <div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">{initial ? 'Save changes' : 'Add contact'}</button></div>
  </form>
}

function ContractForm({ companies, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { companyId: companies[0]?.id || '', title: '', value: '', startDate: today, endDate: '', status: 'Draft', renewalNoticeDays: 60, autoRenew: false, terminationNoticeDate: '' })
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  return <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, value: Number(form.value), id: form.id || crypto.randomUUID() }) }} className="form-grid">
    <label className="full">Company<select required name="companyId" value={form.companyId} onChange={change}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="full">Contract title<input autoFocus required name="title" value={form.title} onChange={change} placeholder="e.g. Annual support agreement" /></label>
    <label>Contract value (NAD)<input required min="0" type="number" name="value" value={form.value} onChange={change} /></label>
    <label>Status<select name="status" value={form.status} onChange={change}><option>Draft</option><option>Active</option><option>Expiring soon</option><option>Expired</option><option>Terminated</option></select></label>
    <label>Start date<input required type="date" name="startDate" value={form.startDate} onChange={change} /></label>
    <label>End date<input required min={form.startDate} type="date" name="endDate" value={form.endDate} onChange={change} /></label>
    <label>Renewal notice<select name="renewalNoticeDays" value={form.renewalNoticeDays || 60} onChange={change}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="120">120 days</option><option value="180">180 days</option></select></label>
    <label>Termination notice date<input type="date" name="terminationNoticeDate" value={form.terminationNoticeDate || ''} onChange={change} /></label>
    <label className="checkbox-label full"><input type="checkbox" name="autoRenew" checked={Boolean(form.autoRenew)} onChange={change} /> Contract renews automatically</label>
    <div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">{initial ? 'Save changes' : 'Add contract'}</button></div>
  </form>
}

function FollowupForm({ companies, contacts, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { companyId: companies[0]?.id || '', contactId: '', title: '', dueDate: today, priority: 'Medium', completed: false })
  const available = contacts.filter((contact) => contact.companyId === form.companyId)
  const change = (e) => {
    const next = { ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }
    if (e.target.name === 'companyId') next.contactId = ''
    setForm(next)
  }
  return <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, id: form.id || crypto.randomUUID() }) }} className="form-grid">
    <label>Company<select required name="companyId" value={form.companyId} onChange={change}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Contact<select name="contactId" value={form.contactId} onChange={change}><option value="">No contact selected</option>{available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="full">Follow-up task<input autoFocus required name="title" value={form.title} onChange={change} placeholder="What needs to happen next?" /></label>
    <label>Due date<input required type="date" name="dueDate" value={form.dueDate} onChange={change} /></label>
    <label>Priority<select name="priority" value={form.priority} onChange={change}><option>Low</option><option>Medium</option><option>High</option></select></label>
    {initial && <label className="checkbox-label full"><input type="checkbox" name="completed" checked={form.completed} onChange={change} /> Mark as completed</label>}
    <div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">{initial ? 'Save changes' : 'Add follow-up'}</button></div>
  </form>
}

function DocumentForm({ contracts, companyById, canRestrict, onSave, onClose }) {
  const [form, setForm] = useState({ contractId: contracts[0]?.id || '', category: 'Agreement', version: 1, accessLevel: 'All team', file: null })
  return <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onSave(form) }}>
    <label className="full">Contract<select required value={form.contractId} onChange={(e) => setForm({ ...form, contractId: e.target.value })}>{contracts.map((c) => <option key={c.id} value={c.id}>{companyById[c.companyId]?.name} — {c.title}</option>)}</select></label>
    <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Agreement</option><option>Amendment</option><option>Supporting document</option><option>Certificate</option><option>Other</option></select></label>
    <label>Version<input required min="1" type="number" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
    <label className="full">Access<select value={form.accessLevel} onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}><option>All team</option>{canRestrict && <option>Managers only</option>}</select></label>
    <label className="full document-picker"><span>Choose document</span><input required type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} /><small>PDF, Word, JPG, or PNG · maximum 20 MB</small></label>
    <div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!form.file}><Upload size={16} /> Upload document</button></div>
  </form>
}

function Dashboard({ data, companyById, userName, setView, openCompany, openAddInteraction, openAddFollowup, onToggleFollowup }) {
  const activeContracts = data.contracts.filter((c) => contractStatus(c) === 'Active')
  const activeValue = activeContracts.reduce((sum, c) => sum + Number(c.value), 0)
  const expiring = data.contracts.filter((c) => contractStatus(c) === 'Expiring soon')
  const recent = [...data.interactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const pendingFollowups = [...(data.followups || [])].filter((item) => !item.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4)
  const firstName = userName?.trim().split(/\s+/)[0] || 'there'
  const currentDate = new Intl.DateTimeFormat('en-NA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return <>
    <div className="welcome"><div><span className="eyebrow">{currentDate}</span><h1>Good morning, {firstName}.</h1><p>Here’s what is happening across your company relationships.</p></div><button className="btn primary" onClick={openAddInteraction}><Plus size={17} /> Log interaction</button></div>
    <div className="stats-grid">
      <article className="stat-card"><div className="stat-icon green"><Building2 size={21} /></div><div><span>Contracted companies</span><strong>{data.companies.filter((c) => c.status === 'Active' || c.status === 'Renewal due').length}</strong><small><b>+1</b> this quarter</small></div></article>
      <article className="stat-card"><div className="stat-icon amber"><CircleDollarSign size={21} /></div><div><span>Active contract value</span><strong>{formatMoney(activeValue)}</strong><small>Across {activeContracts.length} active contracts</small></div></article>
      <article className="stat-card"><div className="stat-icon blue"><Users size={21} /></div><div><span>Key contacts</span><strong>{data.contacts.length}</strong><small>{data.contacts.filter((c) => c.primary).length} primary contacts</small></div></article>
      <article className="stat-card"><div className="stat-icon coral"><Clock3 size={21} /></div><div><span>Renewals due</span><strong>{expiring.length}</strong><small>Within the next 60 days</small></div></article>
    </div>
    <div className="dashboard-grid">
      <section className="panel recent-panel"><div className="panel-head"><div><span className="eyebrow">Relationship activity</span><h2>Recent interactions</h2></div><button className="text-btn" onClick={() => setView('interactions')}>View all <ChevronRight size={16} /></button></div>
        <div className="activity-list">{recent.map((item) => { const company = companyById[item.companyId]; return <button className="activity" key={item.id} onClick={() => openCompany(company.id)}><span className={`activity-icon ${item.type.toLowerCase()}`}>{item.type === 'Email' ? <Mail size={16} /> : item.type === 'Meeting' ? <Users size={16} /> : <Phone size={16} />}</span><span className="activity-copy"><strong>{item.summary}</strong><small>{company?.name} · {item.type}</small></span><time>{formatDate(item.date)}</time><ChevronRight size={16} /></button> })}</div>
      </section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Attention needed</span><h2>Upcoming renewals</h2></div></div>
        {expiring.length ? expiring.map((contract) => { const company = companyById[contract.companyId]; return <div className="renewal" key={contract.id}><div className="renewal-top"><Avatar name={company?.name} color={company?.color} /><div><strong>{company?.name}</strong><small>{contract.title}</small></div><Status>{contractStatus(contract)}</Status></div><div className="renewal-meta"><span><CalendarDays size={15} /> {daysUntil(contract.endDate)} days remaining</span><b>{formatMoney(contract.value)}</b></div><button className="btn secondary wide" onClick={() => openCompany(company.id)}>Review contract</button></div> }) : <Empty title="Nothing urgent" text="No renewals are currently due." />}
      </section>
    </div>
    <section className="panel dashboard-followups"><div className="panel-head"><div><span className="eyebrow">Next actions</span><h2>Upcoming follow-ups</h2></div><div className="panel-actions"><button className="text-btn" onClick={() => setView('followups')}>View all <ChevronRight size={16} /></button><button className="btn secondary" onClick={openAddFollowup}><Plus size={15} /> Add follow-up</button></div></div>
      {pendingFollowups.length ? <div className="dashboard-task-grid">{pendingFollowups.map((item) => { const overdue = item.dueDate < today; return <article className="dashboard-task" key={item.id}><button className="task-check" onClick={() => onToggleFollowup(item)} aria-label="Complete follow-up" /><div><Status>{overdue ? 'Overdue' : item.priority}</Status><strong>{item.title}</strong><small>{companyById[item.companyId]?.name}</small></div><time className={overdue ? 'overdue-date' : ''}>{formatDate(item.dueDate)}</time></article> })}</div> : <Empty title="You’re all caught up" text="There are no outstanding follow-ups." />}
    </section>
  </>
}

function Companies({ companies, contacts, contracts, interactions, query, openCompany }) {
  const [filters, setFilters] = useState(() => JSON.parse(localStorage.getItem('contractconnect-company-view') || '{"status":"All","industry":"All","owner":"All"}'))
  const industries = ['All', ...new Set(companies.map((c) => c.industry))]
  const owners = ['All', ...new Set(companies.map((c) => c.owner))]
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const filtered = companies.filter((c) => `${c.name} ${c.industry} ${c.location}`.toLowerCase().includes(query.toLowerCase())).filter((c) => filters.status === 'All' || c.status === filters.status).filter((c) => filters.industry === 'All' || c.industry === filters.industry).filter((c) => filters.owner === 'All' || c.owner === filters.owner)
  return <section className="panel table-panel"><div className="filter-toolbar"><select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}><option>All</option><option>Active</option><option>Prospect</option><option>Renewal due</option><option>Inactive</option></select><select value={filters.industry} onChange={(e) => updateFilter('industry', e.target.value)}>{industries.map((value) => <option key={value}>{value}</option>)}</select><select value={filters.owner} onChange={(e) => updateFilter('owner', e.target.value)}>{owners.map((value) => <option key={value}>{value}</option>)}</select><button className="btn secondary" onClick={() => localStorage.setItem('contractconnect-company-view', JSON.stringify(filters))}>Save view</button><button className="text-btn" onClick={() => setFilters({ status: 'All', industry: 'All', owner: 'All' })}>Clear</button></div><div className="table-wrap"><table><thead><tr><th>Company</th><th>Status</th><th>Primary contact</th><th>Contract value</th><th>Last interaction</th><th /></tr></thead><tbody>{filtered.map((company) => {
    const contact = contacts.find((c) => c.companyId === company.id && c.primary)
    const value = contracts.filter((c) => c.companyId === company.id).reduce((sum, c) => sum + Number(c.value), 0)
    const last = [...interactions].filter((i) => i.companyId === company.id).sort((a, b) => b.date.localeCompare(a.date))[0]
    return <tr key={company.id} onClick={() => openCompany(company.id)}><td><div className="company-cell"><Avatar name={company.name} color={company.color} /><div><strong>{company.name}</strong><small>{company.industry} · {company.location}</small></div></div></td><td><Status>{company.status}</Status></td><td>{contact ? <div><strong className="cell-main">{contact.name}</strong><small className="cell-sub">{contact.role}</small></div> : '—'}</td><td><strong className="cell-main">{value ? formatMoney(value) : '—'}</strong></td><td>{last ? <div><strong className="cell-main">{formatDate(last.date)}</strong><small className="cell-sub">{last.type}</small></div> : '—'}</td><td><ChevronRight size={17} /></td></tr>
  })}</tbody></table></div>{!filtered.length && <Empty title="No companies found" text="Try a different search term." />}</section>
}

function GlobalSearchResults({ query, data, documents, companyById, onNavigate, onCompany }) {
  if (!query.trim()) return null
  const q = query.toLowerCase()
  const results = [
    ...data.companies.filter((item) => `${item.name} ${item.industry} ${item.location}`.toLowerCase().includes(q)).map((item) => ({ id: `company-${item.id}`, type: 'Company', title: item.name, subtitle: `${item.industry} · ${item.location}`, action: () => onCompany(item.id), icon: Building2 })),
    ...data.contacts.filter((item) => `${item.name} ${item.role} ${item.email}`.toLowerCase().includes(q)).map((item) => ({ id: `contact-${item.id}`, type: 'Contact', title: item.name, subtitle: companyById[item.companyId]?.name, action: () => onNavigate('contacts'), icon: Users })),
    ...data.contracts.filter((item) => `${item.title} ${companyById[item.companyId]?.name}`.toLowerCase().includes(q)).map((item) => ({ id: `contract-${item.id}`, type: 'Contract', title: item.title, subtitle: companyById[item.companyId]?.name, action: () => onNavigate('contracts'), icon: FileText })),
    ...data.interactions.filter((item) => `${item.summary} ${item.notes}`.toLowerCase().includes(q)).map((item) => ({ id: `interaction-${item.id}`, type: 'Interaction', title: item.summary, subtitle: companyById[item.companyId]?.name, action: () => onNavigate('interactions'), icon: MessageSquareText })),
    ...data.followups.filter((item) => item.title.toLowerCase().includes(q)).map((item) => ({ id: `followup-${item.id}`, type: 'Follow-up', title: item.title, subtitle: companyById[item.companyId]?.name, action: () => onNavigate('followups'), icon: CheckSquare2 })),
    ...documents.filter((item) => item.name.toLowerCase().includes(q)).map((item) => ({ id: `document-${item.id}`, type: 'Document', title: item.name, subtitle: item.category, action: () => onNavigate('documents'), icon: FolderOpen })),
  ].slice(0, 8)
  return <div className="search-results">{results.length ? results.map((result) => { const Icon = result.icon; return <button key={result.id} onClick={result.action}><span><Icon size={16} /></span><div><strong>{result.title}</strong><small>{result.type} · {result.subtitle}</small></div><ChevronRight size={15} /></button> }) : <div className="search-empty">No matching records</div>}</div>
}

function Contacts({ data, companyById, query, onEdit, onDelete }) {
  const filtered = data.contacts.filter((c) => `${c.name} ${c.role} ${companyById[c.companyId]?.name}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="contact-grid">{filtered.map((contact) => <article className="contact-card" key={contact.id}><div className="contact-top"><Avatar name={contact.name} color={companyById[contact.companyId]?.color} /><div className="card-actions"><button className="icon-btn" onClick={() => onEdit(contact)} aria-label="Edit contact"><Pencil size={16} /></button><button className="icon-btn danger" onClick={() => onDelete('contacts', contact)} aria-label="Delete contact"><Trash2 size={16} /></button></div></div><h3>{contact.name}</h3><p>{contact.role}</p><button className="company-link">{companyById[contact.companyId]?.name}</button><div className="contact-info"><a href={`mailto:${contact.email}`}><Mail size={15} />{contact.email}</a><a href={`tel:${contact.phone}`}><Phone size={15} />{contact.phone}</a></div>{contact.primary && <span className="primary-label">Primary contact</span>}</article>)}</div>
}

function Contracts({ data, companyById, query, onEdit, onDelete }) {
  const [windowDays, setWindowDays] = useState('all')
  const [statusFilter, setStatusFilter] = useState('All')
  const filtered = data.contracts.filter((c) => `${c.title} ${companyById[c.companyId]?.name}`.toLowerCase().includes(query.toLowerCase())).filter((c) => windowDays === 'all' || (daysUntil(c.endDate) >= 0 && daysUntil(c.endDate) <= Number(windowDays))).filter((c) => statusFilter === 'All' || contractStatus(c) === statusFilter)
  return <section className="panel table-panel"><div className="table-toolbar"><span>Renewal window</span>{['all', '30', '60', '90'].map((days) => <button key={days} className={windowDays === days ? 'active' : ''} onClick={() => setWindowDays(days)}>{days === 'all' ? 'All contracts' : `${days} days`}</button>)}<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option><option>Draft</option><option>Active</option><option>Expiring soon</option><option>Expired</option><option>Terminated</option></select></div><div className="table-wrap"><table><thead><tr><th>Contract</th><th>Company</th><th>Status</th><th>Renewal</th><th>Value</th><th /></tr></thead><tbody>{filtered.map((contract) => <tr key={contract.id}><td><div className="contract-name"><FileText size={18} /><strong>{contract.title}</strong></div></td><td>{companyById[contract.companyId]?.name}</td><td><Status>{contractStatus(contract)}</Status></td><td><strong className="cell-main">{formatDate(contract.endDate)}</strong><small className="cell-sub">{contract.autoRenew ? 'Auto-renews' : `${contract.renewalNoticeDays || 60}-day notice`}</small></td><td><strong>{formatMoney(contract.value)}</strong></td><td><div className="row-actions"><button className="icon-btn" onClick={() => onEdit(contract)}><Pencil size={15} /></button><button className="icon-btn danger" onClick={() => onDelete('contracts', contract)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <Empty title="No contracts in this window" text="Choose another renewal period." />}</section>
}

function Interactions({ data, companyById, contactById, query, onEdit, onDelete }) {
  const filtered = [...data.interactions].sort((a, b) => b.date.localeCompare(a.date)).filter((i) => `${i.summary} ${companyById[i.companyId]?.name} ${i.type}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="panel timeline">{filtered.map((item) => <article className="timeline-item" key={item.id}><div className={`activity-icon ${item.type.toLowerCase()}`}>{item.type === 'Email' ? <Mail size={16} /> : item.type === 'Meeting' ? <Users size={16} /> : <Phone size={16} />}</div><div className="timeline-body"><div className="timeline-title"><div><span className="eyebrow">{item.type}</span><h3>{item.summary}</h3></div><div className="timeline-tools"><time>{formatDate(item.date)}</time><button className="icon-btn" onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-btn danger" onClick={() => onDelete('interactions', item)}><Trash2 size={15} /></button></div></div><p>{item.notes}</p><div className="timeline-company"><Avatar name={companyById[item.companyId]?.name} color={companyById[item.companyId]?.color} /><span><strong>{companyById[item.companyId]?.name}</strong>{contactById[item.contactId] && ` · ${contactById[item.contactId].name}`}</span></div></div></article>)}</section>
}

function Followups({ data, companyById, contactById, query, onToggle, onEdit, onDelete }) {
  const [priority, setPriority] = useState('All')
  const [taskState, setTaskState] = useState('Open')
  const filtered = [...(data.followups || [])].sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate)).filter((item) => `${item.title} ${companyById[item.companyId]?.name}`.toLowerCase().includes(query.toLowerCase())).filter((item) => priority === 'All' || item.priority === priority).filter((item) => taskState === 'All' || (taskState === 'Open' ? !item.completed : item.completed))
  return <section className="panel followup-list"><div className="filter-toolbar"><select value={priority} onChange={(e) => setPriority(e.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select><select value={taskState} onChange={(e) => setTaskState(e.target.value)}><option>Open</option><option>Completed</option><option>All</option></select></div>{filtered.map((item) => {
    const overdue = !item.completed && item.dueDate < today
    return <article className={`followup-row ${item.completed ? 'completed' : ''}`} key={item.id}><button className="task-check" onClick={() => onToggle(item)} aria-label={item.completed ? 'Reopen follow-up' : 'Complete follow-up'}>{item.completed && <Check size={15} />}</button><div className="followup-copy"><div><Status>{item.completed ? 'Completed' : overdue ? 'Overdue' : item.priority}</Status><strong>{item.title}</strong></div><small>{companyById[item.companyId]?.name}{contactById[item.contactId] && ` · ${contactById[item.contactId].name}`}</small></div><time className={overdue ? 'overdue-date' : ''}><CalendarDays size={14} />{formatDate(item.dueDate)}</time><div className="row-actions"><button className="icon-btn" onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-btn danger" onClick={() => onDelete('followups', item)}><Trash2 size={15} /></button></div></article>
  })}{!filtered.length && <Empty title="No follow-ups found" text="Add a follow-up to keep the relationship moving." />}</section>
}

function Documents({ documents, contracts, companyById, query, onOpen, onDelete }) {
  const contractById = Object.fromEntries(contracts.map((c) => [c.id, c]))
  const filtered = documents.filter((doc) => `${doc.name} ${doc.category} ${contractById[doc.contractId]?.title} ${companyById[contractById[doc.contractId]?.companyId]?.name}`.toLowerCase().includes(query.toLowerCase()))
  const size = (bytes) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return <section className="panel table-panel"><div className="document-summary"><span><FolderOpen size={20} /></span><div><strong>{documents.length} documents</strong><small>Private Supabase repository</small></div></div><div className="table-wrap"><table><thead><tr><th>Document</th><th>Contract</th><th>Category</th><th>Access</th><th>Version</th><th>Uploaded</th><th /></tr></thead><tbody>{filtered.map((doc) => { const contract = contractById[doc.contractId]; return <tr key={doc.id}><td><div className="contract-name"><FileText size={18} /><div><strong>{doc.name}</strong><small className="cell-sub">{size(doc.fileSize)}</small></div></div></td><td><strong className="cell-main">{contract?.title}</strong><small className="cell-sub">{companyById[contract?.companyId]?.name}</small></td><td><Status>{doc.category}</Status></td><td><Status>{doc.accessLevel}</Status></td><td>v{doc.version}</td><td>{formatDate(doc.createdAt.slice(0, 10))}</td><td><div className="row-actions"><button className="icon-btn" onClick={() => onOpen(doc)} title="Open document"><ExternalLink size={15} /></button><button className="icon-btn danger" onClick={() => onDelete(doc)} title="Delete document"><Trash2 size={15} /></button></div></td></tr> })}</tbody></table></div>{!filtered.length && <Empty title="No documents found" text="Upload an agreement or supporting document." />}</section>
}

function CompanyDetail({ company, data, onBack, openAddInteraction, onEdit, onDelete }) {
  const contacts = data.contacts.filter((c) => c.companyId === company.id)
  const contracts = data.contracts.filter((c) => c.companyId === company.id)
  const interactions = [...data.interactions].filter((i) => i.companyId === company.id).sort((a, b) => b.date.localeCompare(a.date))
  return <><button className="back-btn" onClick={onBack}>← Back to companies</button><section className="company-hero"><div className="company-title"><Avatar name={company.name} color={company.color} /><div><div className="title-status"><h1>{company.name}</h1><Status>{company.status}</Status></div><p>{company.industry} · {company.location}</p></div></div><div className="hero-actions"><button className="btn secondary" onClick={() => onEdit(company)}><Pencil size={16} /> Edit</button><button className="btn danger-btn" onClick={() => onDelete('companies', company)}><Trash2 size={16} /> Delete</button><button className="btn primary" onClick={openAddInteraction}><Plus size={17} /> Log interaction</button></div></section>
    <div className="detail-grid"><div><section className="panel detail-section"><div className="panel-head"><h2>Company details</h2></div><p className="company-notes">{company.notes}</p><div className="details-list"><span><MapPin size={17} /><div><small>Location</small><strong>{company.location}</strong></div></span><span><Phone size={17} /><div><small>Phone</small><strong>{company.phone || '—'}</strong></div></span><span><Building2 size={17} /><div><small>Website</small><strong>{company.website || '—'}</strong></div></span><span><Users size={17} /><div><small>Account owner</small><strong>{company.owner}</strong></div></span></div></section>
      <section className="panel detail-section"><div className="panel-head"><h2>Interaction history</h2><span className="count">{interactions.length}</span></div>{interactions.map((item) => <div className="mini-activity" key={item.id}><div className={`activity-icon ${item.type.toLowerCase()}`}><MessageSquareText size={15} /></div><div><strong>{item.summary}</strong><p>{item.notes}</p><small>{item.type} · {formatDate(item.date)}</small></div></div>)}</section></div>
      <aside><section className="panel detail-section"><div className="panel-head"><h2>Key contacts</h2><span className="count">{contacts.length}</span></div>{contacts.map((contact) => <div className="person-row" key={contact.id}><Avatar name={contact.name} color={company.color} /><div><strong>{contact.name}</strong><small>{contact.role}</small><a href={`mailto:${contact.email}`}>{contact.email}</a></div></div>)}</section>
      <section className="panel detail-section"><div className="panel-head"><h2>Contracts</h2><span className="count">{contracts.length}</span></div>{contracts.map((contract) => <div className="contract-card" key={contract.id}><div><FileText size={17} /><strong>{contract.title}</strong></div><Status>{contractStatus(contract)}</Status><p>{formatDate(contract.startDate)} — {formatDate(contract.endDate)} · {contract.autoRenew ? 'Auto-renews' : `${contract.renewalNoticeDays || 60}-day notice`}</p><b>{formatMoney(contract.value)}</b></div>)}</section></aside></div></>
}

function AccountSettings({ profile, email, userId, theme, onThemeChange, onUpdated }) {
  const stockAvatars = ['/avatars/avatar-1.jpg?v=2', '/avatars/avatar-2.jpg?v=2', '/avatars/avatar-3.jpg?v=2', '/avatars/avatar-4.jpg?v=2', '/avatars/avatar-5.jpg?v=2']
  const [form, setForm] = useState({ fullName: profile.full_name, password: '', confirm: '', avatarUrl: profile.avatar_url || '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (form.password && form.password !== form.confirm) { setError('The new passwords do not match.'); return }
    setSaving(true)
    try {
      const updated = await updateAccount({ fullName: form.fullName.trim(), password: form.password, avatarUrl: form.avatarUrl })
      onUpdated(updated); setForm((current) => ({ ...current, password: '', confirm: '' })); setMessage('Your account settings have been updated.')
    } catch (err) { setError(err.message || 'Your account could not be updated.') }
    finally { setSaving(false) }
  }
  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Profile pictures must be smaller than 5 MB.'); return }
    setUploading(true); setError(''); setMessage('')
    try { const avatarUrl = await uploadProfilePicture(userId, file); setForm((current) => ({ ...current, avatarUrl })); setMessage('Picture uploaded. Select Save changes to apply it.') }
    catch (err) { setError(err.message || 'The profile picture could not be uploaded.') }
    finally { setUploading(false); event.target.value = '' }
  }
  return <div className="settings-grid">
    <section className="panel settings-card"><div className="settings-intro"><Avatar name={profile.full_name} color="#d9a451" src={form.avatarUrl} /><div><h2>Personal information</h2><p>Update how your profile appears across ContractConnect.</p></div></div><form className="settings-form" onSubmit={submit}>
      <div className="avatar-settings"><span>Profile picture</span><div className="avatar-options"><button type="button" className={!form.avatarUrl ? 'selected' : ''} onClick={() => setForm({ ...form, avatarUrl: '' })}><Avatar name={form.fullName} color="#d9a451" /></button>{stockAvatars.map((src) => <button type="button" key={src} className={form.avatarUrl === src ? 'selected' : ''} onClick={() => setForm({ ...form, avatarUrl: src })}><Avatar name="Profile" src={src} /></button>)}<label className="avatar-upload"><Upload size={17} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} />{uploading && <small>Uploading…</small>}</label></div></div>
      <label>Full name<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
      <label>Email address<input value={email} disabled /><small>Email changes are managed by your administrator.</small></label>
      <div className="settings-divider"><span>Password</span><p>Leave these fields blank to keep your current password.</p></div>
      <label>New password<input minLength="8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></label>
      <label>Confirm new password<input minLength="8" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat new password" /></label>
      {error && <div className="auth-alert error">{error}</div>}{message && <div className="auth-alert success">{message}</div>}
      <button className="btn primary settings-save" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
    </form></section>
    <aside className="settings-aside"><section className="panel appearance-card"><span className="settings-icon"><Sun size={21} /></span><h2>Appearance</h2><p>Choose how ContractConnect looks on this device.</p><div className="theme-options"><button className={theme === 'light' ? 'active' : ''} onClick={() => onThemeChange('light')}><Sun size={17} /><span><strong>Light</strong><small>Bright workspace</small></span></button><button className={theme === 'dark' ? 'active' : ''} onClick={() => onThemeChange('dark')}><Moon size={17} /><span><strong>Dark</strong><small>Reduced glare</small></span></button></div></section><section className="panel security-card"><span><ShieldCheck size={22} /></span><h2>Secure account</h2><p>Your account is protected by Supabase authentication, encrypted sessions, and row-level database security.</p><dl><div><dt>Access level</dt><dd>{profile.role}</dd></div><div><dt>Session</dt><dd className="secure-value">Active</dd></div></dl></section></aside>
  </div>
}

const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  URL.revokeObjectURL(url)
}

function DataManagement({ data, companyById, contactById }) {
  const exports = [
    { name: 'Companies', count: data.companies.length, headers: ['name', 'industry', 'location', 'status', 'website', 'phone', 'owner', 'notes'], rows: data.companies.map((c) => [c.name, c.industry, c.location, c.status, c.website, c.phone, c.owner, c.notes]) },
    { name: 'Contacts', count: data.contacts.length, headers: ['company', 'name', 'role', 'email', 'phone', 'primary'], rows: data.contacts.map((c) => [companyById[c.companyId]?.name, c.name, c.role, c.email, c.phone, c.primary]) },
    { name: 'Contracts', count: data.contracts.length, headers: ['company', 'title', 'value_nad', 'start_date', 'end_date', 'status'], rows: data.contracts.map((c) => [companyById[c.companyId]?.name, c.title, c.value, c.startDate, c.endDate, c.status]) },
    { name: 'Interactions', count: data.interactions.length, headers: ['company', 'contact', 'type', 'date', 'summary', 'notes'], rows: data.interactions.map((i) => [companyById[i.companyId]?.name, contactById[i.contactId]?.name, i.type, i.date, i.summary, i.notes]) },
    { name: 'Follow-ups', count: data.followups.length, headers: ['company', 'contact', 'title', 'due_date', 'priority', 'completed'], rows: data.followups.map((f) => [companyById[f.companyId]?.name, contactById[f.contactId]?.name, f.title, f.dueDate, f.priority, f.completed]) },
  ]
  return <div className="data-page"><section className="data-notice"><span><Database size={20} /></span><div><strong>Demo-data workspace</strong><p>Exports currently contain fictional demonstration records only. Importing real information remains disabled until organisational approval is received.</p></div></section>
    <section className="panel data-section"><div className="panel-head"><div><span className="eyebrow">Current workspace</span><h2>Export demo data</h2></div></div><div className="export-grid">{exports.map((item) => <article className="export-card" key={item.name}><span><FileSpreadsheet size={20} /></span><div><strong>{item.name}</strong><small>{item.count} records · CSV format</small></div><button className="icon-btn" onClick={() => downloadCsv(`contractconnect-${item.name.toLowerCase().replace(' ', '-')}.csv`, item.headers, item.rows)} aria-label={`Export ${item.name}`}><Download size={17} /></button></article>)}</div></section>
    <section className="panel data-section"><div className="panel-head"><div><span className="eyebrow">Future migration</span><h2>Download import templates</h2></div></div><div className="template-row"><div><strong>ContractConnect CSV template pack</strong><p>Blank, correctly structured templates for preparing approved data offline. No information is uploaded by this action.</p></div><button className="btn secondary" onClick={() => exports.forEach((item, index) => setTimeout(() => downloadCsv(`template-${item.name.toLowerCase().replace(' ', '-')}.csv`, item.headers, []), index * 150))}><Download size={16} /> Download templates</button></div></section>
  </div>
}

function Reports({ data, companyById }) {
  const byCompany = data.companies.map((company) => ({ label: company.name, value: data.contracts.filter((c) => c.companyId === company.id).reduce((sum, c) => sum + Number(c.value), 0) })).filter((item) => item.value).sort((a, b) => b.value - a.value)
  const statuses = ['Active', 'Expiring soon', 'Expired', 'Draft', 'Terminated'].map((status) => ({ label: status, value: data.contracts.filter((c) => contractStatus(c) === status).reduce((sum, c) => sum + Number(c.value), 0) })).filter((item) => item.value)
  const renewalMonths = Object.entries(data.contracts.reduce((acc, contract) => { const key = contract.endDate.slice(0, 7); acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort(([a], [b]) => a.localeCompare(b)).slice(0, 6).map(([key, value]) => ({ label: new Intl.DateTimeFormat('en-NA', { month: 'short', year: 'numeric' }).format(new Date(`${key}-01T12:00:00`)), value }))
  const interactionMonths = Object.entries(data.interactions.reduce((acc, item) => { const key = item.date.slice(0, 7); acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, value]) => ({ label: new Intl.DateTimeFormat('en-NA', { month: 'short' }).format(new Date(`${key}-01T12:00:00`)), value }))
  const completed = data.followups.filter((item) => item.completed).length
  const completionRate = data.followups.length ? Math.round(completed / data.followups.length * 100) : 0
  const staleCompanies = data.companies.filter((company) => { const last = data.interactions.filter((i) => i.companyId === company.id).sort((a, b) => b.date.localeCompare(a.date))[0]; return !last || daysUntil(last.date) < -30 })
  const Bars = ({ items, money = false }) => { const max = Math.max(...items.map((item) => item.value), 1); return <div className="report-bars">{items.map((item) => <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${Math.max(item.value / max * 100, 3)}%` }} /></div><strong>{money ? formatMoney(item.value) : item.value}</strong></div>)}</div> }
  return <div className="reports-page"><div className="report-kpis"><article className="panel"><span>Portfolio value</span><strong>{formatMoney(data.contracts.reduce((sum, c) => sum + Number(c.value), 0))}</strong><small>{data.contracts.length} contracts</small></article><article className="panel"><span>Follow-up completion</span><strong>{completionRate}%</strong><small>{completed} of {data.followups.length} completed</small></article><article className="panel"><span>Relationships needing attention</span><strong>{staleCompanies.length}</strong><small>No interaction in 30+ days</small></article></div>
    <div className="report-grid"><section className="panel report-card"><div className="panel-head"><h2>Contract value by company</h2></div><Bars items={byCompany} money /></section><section className="panel report-card"><div className="panel-head"><h2>Value by lifecycle status</h2></div><Bars items={statuses} money /></section><section className="panel report-card"><div className="panel-head"><h2>Renewals by month</h2></div><Bars items={renewalMonths} /></section><section className="panel report-card"><div className="panel-head"><h2>Interaction trend</h2></div><Bars items={interactionMonths} /></section></div>
    <section className="panel attention-table"><div className="panel-head"><div><span className="eyebrow">Relationship health</span><h2>Companies with no recent contact</h2></div><span className="count">{staleCompanies.length}</span></div>{staleCompanies.map((company) => <div className="attention-row" key={company.id}><Avatar name={company.name} color={company.color} /><div><strong>{company.name}</strong><small>{company.owner} · {company.industry}</small></div><Status>Needs attention</Status></div>)}{!staleCompanies.length && <Empty title="Relationships are current" text="Every company has a recent interaction." />}</section>
  </div>
}

function Governance({ currentUserId, canAdminister }) {
  const [team, setTeam] = useState([])
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  useEffect(() => { Promise.all([fetchTeam(), fetchAuditLogs()]).then(([users, audit]) => { setTeam(users); setLogs(audit) }).catch((err) => setError(err.message)) }, [])
  const changeRole = async (id, role) => { try { const updated = await updateTeamRole(id, role); setTeam((current) => current.map((user) => user.id === id ? updated : user)) } catch (err) { alert(err.message) } }
  const changeAccess = async (id, isActive) => { try { const updated = await updateTeamAccess(id, isActive); setTeam((current) => current.map((user) => user.id === id ? updated : user)); await reportSecurityEvent(isActive ? 'team_member_activated' : 'team_member_deactivated', 'high', { target_user_id: id }) } catch (err) { alert(err.message) } }
  return <div className="governance-page">{error && <div className="auth-alert error">{error}</div>}<section className="panel team-panel"><div className="panel-head"><div><span className="eyebrow">Access control</span><h2>Team roles</h2></div><span className="count">{team.length}</span></div>{team.map((user) => <div className="team-row" key={user.id}><Avatar name={user.full_name} src={user.avatar_url} color="#d9a451" /><div><strong>{user.full_name}</strong><small>{user.id === currentUserId ? 'You' : user.is_active ? 'Active team member' : 'Awaiting approval'}</small></div><select value={user.role} disabled={!canAdminister || user.id === currentUserId || !user.is_active} onChange={(e) => changeRole(user.id, e.target.value)}><option>Administrator</option><option>Manager</option><option>Contributor</option><option>Read-only</option></select>{canAdminister && user.id !== currentUserId && <button className={`btn ${user.is_active ? 'secondary' : 'primary'}`} onClick={() => changeAccess(user.id, !user.is_active)}>{user.is_active ? 'Deactivate' : 'Approve access'}</button>}</div>)}</section><section className="panel audit-panel"><div className="panel-head"><div><span className="eyebrow">Governance</span><h2>Recent audit activity</h2></div><History size={18} /></div>{logs.map((log) => <div className="audit-row" key={log.id}><span className={`audit-action ${log.action.toLowerCase()}`}>{log.action}</span><div><strong>{log.table_name.replaceAll('_', ' ')}</strong><small>Record {log.record_id?.slice(0, 12)} · {new Date(log.created_at).toLocaleString('en-NA')}</small></div></div>)}{!logs.length && <Empty title="No audit activity" text="Changes will appear here after the governance migration." />}</section></div>
}

function CrmApp({ session, profile, theme, onThemeChange, onProfileUpdated, onSignOut }) {
  const [data, setData] = useState(loadData)
  const [view, setView] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [documents, setDocuments] = useState([])
  const [profileMenu, setProfileMenu] = useState(false)
  const [syncState, setSyncState] = useState(isSupabaseConfigured ? 'connecting' : 'local')
  useEffect(() => {
    if (!isSupabaseConfigured || demoMode) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])
  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured) return undefined
    fetchCrmData().then(async (remoteData) => {
      if (!active) return
      const needsDemoSeed = demoMode && !remoteData?.companies.length && !remoteData?.contacts.length && !remoteData?.contracts.length && !remoteData?.interactions.length && !remoteData?.followups.length
      const resolved = needsDemoSeed ? await seedDemoData() : remoteData
      if (active && resolved) setData(resolved)
      setSyncState('connected')
    }).catch((error) => {
      console.error('Supabase connection failed:', error.message)
      if (active) setSyncState('error')
    })
    return () => { active = false }
  }, [session.user.id])
  useEffect(() => { fetchDocuments().then(setDocuments).catch((error) => console.warn('Document repository unavailable:', error.message)) }, [session.user.id])
  const companyById = useMemo(() => Object.fromEntries(data.companies.map((c) => [c.id, c])), [data.companies])
  const contactById = useMemo(() => Object.fromEntries(data.contacts.map((c) => [c.id, c])), [data.contacts])
  const openCompany = (id) => { setSelectedCompany(id); setView('company'); setSearchOpen(false) }
  const navigate = (id) => { setView(id); setSelectedCompany(null); setQuery(''); setSearchOpen(false); setMobileNav(false); setProfileMenu(false) }
  const titles = { dashboard: ['Overview', 'Your relationship workspace at a glance.'], companies: ['Companies', 'Manage every contracted company and prospect.'], contacts: ['Contacts', 'The people behind every relationship.'], contracts: ['Contracts', 'Track contract value, terms, and renewal dates.'], documents: ['Document repository', 'Store agreements, amendments, and supporting contract files.'], interactions: ['Interactions', 'A complete record of relationship activity.'], followups: ['Follow-ups', 'Stay on top of every commitment and next action.'], reports: ['Reports', 'Understand contract value, renewals, activity, and relationship health.'], governance: ['Governance', 'Manage team access and review changes to CRM records.'], settings: ['Account settings', 'Manage your personal information and account security.'], data: ['Data management', 'Prepare exports and templates for controlled data migration.'] }
  const openCreate = (kind) => { setEditing(null); setModal(kind) }
  const openEdit = (kind, item) => { setEditing(item); setModal(kind) }
  const saveEntity = async (kind, item) => {
    try {
      const saved = await saveRecord(kind, item)
      setData((current) => ({ ...current, [kind]: current[kind].some((entry) => entry.id === saved.id) ? current[kind].map((entry) => entry.id === saved.id ? saved : entry) : [...current[kind], saved] }))
      setModal(null); setEditing(null)
      if (kind === 'companies' && view !== 'company') navigate('companies')
    } catch (error) { alert(`Record could not be saved: ${error.message}`) }
  }
  const removeEntity = async (kind, item) => {
    if (!confirm(`Delete “${item.name || item.title || item.summary}”? This cannot be undone.`)) return
    try {
      await deleteRecord(kind, item.id)
      setData((current) => {
        if (kind !== 'companies') return { ...current, [kind]: current[kind].filter((entry) => entry.id !== item.id) }
        return { ...current, companies: current.companies.filter((entry) => entry.id !== item.id), contacts: current.contacts.filter((entry) => entry.companyId !== item.id), contracts: current.contracts.filter((entry) => entry.companyId !== item.id), interactions: current.interactions.filter((entry) => entry.companyId !== item.id), followups: current.followups.filter((entry) => entry.companyId !== item.id) }
      })
      if (kind === 'companies') navigate('companies')
    } catch (error) { alert(`Record could not be deleted: ${error.message}`) }
  }
  const toggleFollowup = (item) => saveEntity('followups', { ...item, completed: !item.completed })
  const addDocument = async (form) => { try { const saved = await uploadContractDocument(form); setDocuments((current) => [saved, ...current]); setModal(null) } catch (error) { alert(`Document could not be uploaded: ${error.message}`) } }
  const removeDocument = async (document) => { if (!confirm(`Delete “${document.name}”? This removes the stored file.`)) return; try { await deleteContractDocument(document); setDocuments((current) => current.filter((item) => item.id !== document.id)) } catch (error) { alert(`Document could not be deleted: ${error.message}`) } }
  const reset = async () => {
    if (!confirm('Reset all ContractConnect data to the original demo records? This removes any demo changes.')) return
    try { setData(await resetDemoData()) }
    catch (error) { alert(`Demo data could not be reset: ${error.message}`) }
  }
  const activeTitle = titles[view] || titles.companies
  const openFollowupCount = (data.followups || []).filter((item) => !item.completed).length
  const canWrite = profile.role !== 'Read-only'
  const canAdminister = profile.role === 'Administrator'
  const canManage = ['Administrator', 'Manager'].includes(profile.role)

  return <div className={`app-shell ${canWrite ? '' : 'read-only'}`}>
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}><div className="brand"><span className="brand-mark"><FileText size={20} /></span><span>Contract<span>Connect</span></span><button className="nav-close" onClick={() => setMobileNav(false)}><X /></button></div><nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={view === id || (view === 'company' && id === 'companies') ? 'active' : ''} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span>{id === 'followups' && openFollowupCount > 0 && <b className="nav-badge">{openFollowupCount}</b>}</button>)}</nav><div className="sidebar-bottom"><div className={`sync-state ${syncState}`}><span />{syncState === 'connected' ? 'Supabase connected' : syncState === 'connecting' ? 'Connecting to Supabase…' : syncState === 'error' ? 'Supabase unavailable' : 'Local demo mode'}</div>{demoMode && canManage && <button onClick={reset}><RefreshCcw size={17} /> Reset demo data</button>}<div className="profile-menu-wrap">{profileMenu && <div className="profile-menu"><button onClick={() => navigate('settings')}><Settings size={16} /><span><strong>Account settings</strong><small>Profile and security</small></span></button><button onClick={() => navigate('data')}><Database size={16} /><span><strong>Data management</strong><small>Exports and templates</small></span></button>{canManage && <button onClick={() => navigate('governance')}><ShieldCheck size={16} /><span><strong>Governance</strong><small>Roles and audit trail</small></span></button>}<button className="profile-signout" onClick={onSignOut}><LogOut size={16} /><span><strong>Sign out</strong><small>End this session</small></span></button></div>}<div className={`user-card ${profileMenu ? 'menu-open' : ''}`}><Avatar name={profile.full_name} color="#d9a451" src={profile.avatar_url} /><div><strong>{profile.full_name}</strong><small>{profile.role}</small></div><button className="profile-menu-trigger" onClick={() => setProfileMenu((open) => !open)} aria-label="Open account menu" aria-expanded={profileMenu}><MoreHorizontal size={19} /></button></div></div></div></aside>
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <main><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu /></button><div className="global-search"><Search size={18} /><input value={query} onFocus={() => setSearchOpen(true)} onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }} placeholder="Search companies, contacts, contracts…" /><kbd>⌘ K</kbd>{searchOpen && <GlobalSearchResults query={query} data={data} documents={documents} companyById={companyById} onNavigate={navigate} onCompany={openCompany} />}</div><button className="top-avatar" title={profile.full_name}><Avatar name={profile.full_name} color="#d9a451" src={profile.avatar_url} /></button></header>
      <div className="content">{view !== 'company' && view !== 'dashboard' && <div className="page-heading"><div><span className="eyebrow">ContractConnect CRM</span><h1>{activeTitle[0]}</h1><p>{activeTitle[1]}</p></div>{canWrite && !['settings', 'data', 'reports', 'governance'].includes(view) && <button className="btn primary" onClick={() => openCreate(view === 'companies' ? 'company' : view === 'contacts' ? 'contact' : view === 'contracts' ? 'contract' : view === 'documents' ? 'document' : view === 'followups' ? 'followup' : 'interaction')}><Plus size={17} /> {view === 'companies' ? 'Add company' : view === 'contacts' ? 'Add contact' : view === 'contracts' ? 'Add contract' : view === 'documents' ? 'Upload document' : view === 'followups' ? 'Add follow-up' : 'Log interaction'}</button>}</div>}
        {view === 'dashboard' && <Dashboard data={data} companyById={companyById} userName={profile.full_name} setView={setView} openCompany={openCompany} openAddInteraction={() => openCreate('interaction')} openAddFollowup={() => openCreate('followup')} onToggleFollowup={toggleFollowup} />}
        {view === 'companies' && <Companies {...data} query={query} openCompany={openCompany} />}
        {view === 'contacts' && <Contacts data={data} companyById={companyById} query={query} onEdit={(item) => openEdit('contact', item)} onDelete={removeEntity} />}
        {view === 'contracts' && <Contracts data={data} companyById={companyById} query={query} onEdit={(item) => openEdit('contract', item)} onDelete={removeEntity} />}
        {view === 'documents' && <Documents documents={documents} contracts={data.contracts} companyById={companyById} query={query} onOpen={(doc) => openContractDocument(doc).catch((error) => alert(error.message))} onDelete={removeDocument} />}
        {view === 'interactions' && <Interactions data={data} companyById={companyById} contactById={contactById} query={query} onEdit={(item) => openEdit('interaction', item)} onDelete={removeEntity} />}
        {view === 'followups' && <Followups data={data} companyById={companyById} contactById={contactById} query={query} onToggle={toggleFollowup} onEdit={(item) => openEdit('followup', item)} onDelete={removeEntity} />}
        {view === 'settings' && <AccountSettings profile={profile} email={session.user.email} userId={session.user.id} theme={theme} onThemeChange={onThemeChange} onUpdated={onProfileUpdated} />}
        {view === 'data' && <DataManagement data={data} companyById={companyById} contactById={contactById} />}
        {view === 'reports' && <Reports data={data} companyById={companyById} />}
        {view === 'governance' && canManage && <Governance currentUserId={session.user.id} canAdminister={canAdminister} />}
        {view === 'company' && companyById[selectedCompany] && <CompanyDetail company={companyById[selectedCompany]} data={data} onBack={() => navigate('companies')} openAddInteraction={() => openCreate('interaction')} onEdit={(item) => openEdit('company', item)} onDelete={removeEntity} />}
      </div>
    </main>
    {modal === 'company' && <Modal title={editing ? 'Edit company' : 'Add a company'} onClose={() => { setModal(null); setEditing(null) }}><CompanyForm initial={editing} onSave={(item) => saveEntity('companies', item)} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
    {modal === 'contact' && <Modal title={editing ? 'Edit contact' : 'Add a contact'} onClose={() => { setModal(null); setEditing(null) }}><ContactForm companies={data.companies} initial={editing} onSave={(item) => saveEntity('contacts', item)} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
    {modal === 'contract' && <Modal title={editing ? 'Edit contract' : 'Add a contract'} onClose={() => { setModal(null); setEditing(null) }}><ContractForm companies={data.companies} initial={editing} onSave={(item) => saveEntity('contracts', item)} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
    {modal === 'interaction' && <Modal title={editing ? 'Edit interaction' : 'Log an interaction'} onClose={() => { setModal(null); setEditing(null) }}><InteractionForm companies={data.companies} contacts={data.contacts} initial={editing} onSave={(item) => saveEntity('interactions', item)} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
    {modal === 'followup' && <Modal title={editing ? 'Edit follow-up' : 'Add a follow-up'} onClose={() => { setModal(null); setEditing(null) }}><FollowupForm companies={data.companies} contacts={data.contacts} initial={editing} onSave={(item) => saveEntity('followups', item)} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
    {modal === 'document' && <Modal title="Upload contract document" onClose={() => setModal(null)}><DocumentForm contracts={data.contracts} companyById={companyById} canRestrict={canManage} onSave={addDocument} onClose={() => setModal(null)} /></Modal>}
  </div>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return undefined }
    getSession().then(setSession).catch(console.error).finally(() => setLoading(false))
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'USER_UPDATED') setRecovery(false)
      if (event === 'SIGNED_OUT') { setProfile(null); setRecovery(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return undefined
    return startSessionGuard(() => {
      setSession(null)
      setProfile(null)
    })
  }, [session?.user])

  useEffect(() => {
    if (!session?.user) return
    getProfile(session.user).then(setProfile).catch((error) => {
      reportSecurityEvent('profile_load_failed', 'high', { message: error.message })
      setProfile({ full_name: session.user.user_metadata?.full_name || session.user.email, role: 'Read-only', is_active: false })
    })
  }, [session?.user])
  useEffect(() => {
    if (!session?.user) return
    const saved = localStorage.getItem(`contractconnect-theme:${session.user.id}`) || 'light'
    setTheme(saved); document.documentElement.dataset.theme = saved
  }, [session?.user])
  const changeTheme = (next) => {
    setTheme(next); document.documentElement.dataset.theme = next
    if (session?.user) localStorage.setItem(`contractconnect-theme:${session.user.id}`, next)
  }

  if (loading || (session && !profile)) return <div className="auth-loading"><span className="brand-mark"><FileText size={20} /></span><p>Opening ContractConnect…</p></div>
  if (!isSupabaseConfigured) return <AuthScreen />
  if (!session || recovery) return <AuthScreen recovery={recovery} />
  if (profile.is_active === false) return <main className="auth-page"><section className="auth-form-side"><div className="auth-card"><span className="auth-lock"><ShieldCheck size={19} /></span><h2>Access awaiting approval</h2><p>Your identity has been verified, but an administrator must approve your ContractConnect workspace access.</p><button className="btn primary" onClick={async () => { clearSensitiveClientData(); await signOut() }}>Sign out</button></div></section></main>
  return <CrmApp session={session} profile={profile} theme={theme} onThemeChange={changeTheme} onProfileUpdated={setProfile} onSignOut={signOut} />
}
