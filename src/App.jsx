import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, Bell, Building2, CalendarDays, Check, CheckSquare2, ChevronDown, ChevronRight, CircleDollarSign, Clock3, Database, Download,
  ExternalLink, FileSpreadsheet, FileText, FolderOpen, History, LayoutDashboard, Mail, MapPin, Menu, MessageSquareText, Moon,
  LogOut, MoreHorizontal, Pencil, Phone, Plus, RefreshCcw, Search, Settings, ShieldCheck, Sun, Trash2, Upload, Users, X,
} from 'lucide-react'
import AuthScreen from './AuthScreen'
import { deleteRecord, fetchCrmData, saveRecord } from './lib/database'
import { deleteContractDocument, fetchDocuments, openContractDocument, uploadContractDocument } from './lib/documents'
import { fetchAuditLogs, fetchTeam, updateTeamAccess, updateTeamRole } from './lib/governance'
import { getLinkedIdentities, getProfile, getSession, signOut, unlinkMicrosoftIdentity, updateAccount, uploadProfilePicture } from './lib/auth'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { clearSensitiveClientData, reportSecurityEvent, startSessionGuard } from './lib/runtimeSecurity'
import { fetchBusinessData, markNotificationsRead as persistNotificationReads, recordPartnerSale, saveFinancialYear as persistFinancialYear, savePartnerTarget, saveServiceLevelAgreement } from './lib/businessData'
import { beginOutlookConnection, disconnectOutlook as disconnectOutlookAccount, fetchOutlookCalendar, fetchOutlookEmail, fetchSharePointDocuments, getOutlookStatus } from './lib/outlook'

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'companies', label: 'Companies', icon: Building2, children: [{ id: 'companies', label: 'All companies' }, { id: 'partners', label: 'Partners' }] },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'contracts', label: 'Contracts', icon: FileText, children: [{ id: 'contracts', label: 'All contracts' }, { id: 'slas', label: 'Service Level Agreements' }] },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'interactions', label: 'Interactions', icon: MessageSquareText },
  { id: 'followups', label: 'Follow-ups', icon: CheckSquare2 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
]


const formatDate = (value) => new Intl.DateTimeFormat('en-NA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const formatMoney = (value) => new Intl.NumberFormat('en-NA', { style: 'currency', currency: 'NAD', maximumFractionDigits: 0 }).format(value)
const initials = (name = '') => name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
const today = new Date().toISOString().slice(0, 10)
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
const daysUntil = (date) => Math.ceil((new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000)
const contractStatus = (contract) => {
  if (contract.status === 'Draft' || contract.status === 'Terminated') return contract.status
  const days = daysUntil(contract.endDate)
  if (days < 0) return 'Expired'
  if (days <= Number(contract.renewalNoticeDays || 60)) return 'Expiring soon'
  return 'Active'
}

const emptyCrmData = () => ({ companies: [], contacts: [], contracts: [], interactions: [], followups: [] })
const demoMode = false

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
  const [form, setForm] = useState(initial ? { ...initial, followUpAction: 'None' } : { companyId: companies[0]?.id || '', contactId: '', type: 'Call', date: today, summary: '', notes: '', followUpAction: 'Email' })
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
    {!initial && <><label className="full">Required three-day follow-up<select name="followUpAction" value={form.followUpAction} onChange={change}><option value="Email">Send an email</option><option value="Call">Make a call</option><option value="None">No follow-up required</option></select><small>{form.followUpAction === 'None' ? 'No reminder will be created for this engagement.' : `A ${form.followUpAction.toLowerCase()} reminder will be due three days after the engagement date.`}</small></label></>}
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

function Dashboard({ data, companyById, userName, outlook, weeklyMeetings, meetingsLoading, meetingsError, meetingsLastUpdated, onRefreshMeetings, setView, openCompany, openAddInteraction, openAddFollowup, onToggleFollowup }) {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  useEffect(() => {
    const clock = window.setInterval(() => setCurrentTime(new Date()), 60000)
    return () => window.clearInterval(clock)
  }, [])
  const activeContracts = data.contracts.filter((c) => contractStatus(c) === 'Active')
  const activeValue = activeContracts.reduce((sum, c) => sum + Number(c.value), 0)
  const expiring = data.contracts.filter((c) => contractStatus(c) === 'Expiring soon')
  const recent = [...data.interactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const pendingFollowups = [...(data.followups || [])].filter((item) => !item.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4)
  const firstName = userName?.trim().split(/\s+/)[0] || 'there'
  const greeting = currentTime.getHours() < 12 ? 'Good morning' : 'Good afternoon'
  const currentDate = new Intl.DateTimeFormat('en-NA', { weekday: 'long', day: 'numeric', month: 'long' }).format(currentTime)
  const outlookCalendarConnected = outlook.connected && outlook.calendar
  const meetingDay = (date) => new Intl.DateTimeFormat('en-NA', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  const meetingTime = (date) => new Intl.DateTimeFormat('en-NA', { hour: '2-digit', minute: '2-digit' }).format(date)
  const lastUpdatedLabel = meetingsLastUpdated ? new Intl.DateTimeFormat('en-NA', { hour: '2-digit', minute: '2-digit' }).format(meetingsLastUpdated) : null
  return <>
    <div className="welcome"><div><span className="eyebrow">{currentDate}</span><h1>{greeting}, {firstName}.</h1><p>Here’s what is happening across your company relationships.</p></div><button className="btn primary" onClick={openAddInteraction}><Plus size={17} /> Log interaction</button></div>
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
    <section className="panel weekly-meetings"><div className="panel-head"><div><span className="eyebrow">Microsoft Outlook</span><h2>This week’s meetings</h2></div>{outlookCalendarConnected && <div className="calendar-refresh-actions"><span className="calendar-connected"><span /> Calendar connected</span>{lastUpdatedLabel && <small>Last updated {lastUpdatedLabel}</small>}<button className="btn secondary" disabled={meetingsLoading} onClick={onRefreshMeetings}><RefreshCcw size={14} className={meetingsLoading ? 'spin' : ''} /> {meetingsLoading ? 'Refreshing…' : 'Refresh'}</button></div>}</div>{outlookCalendarConnected ? <>{meetingsError && <div className="calendar-sync-warning" role="status"><strong>Calendar refresh failed.</strong> {meetingsError} {weeklyMeetings.length > 0 && 'Showing the last successfully retrieved meetings.'}</div>}{meetingsLoading && !weeklyMeetings.length ? <div className="calendar-empty"><span><CalendarDays size={23} /></span><div><strong>Loading Outlook meetings…</strong><p>Requesting this week’s events securely from Microsoft Graph.</p></div></div> : weeklyMeetings.length ? <div className="meeting-list">{weeklyMeetings.map((meeting) => <article key={meeting.id}><span className="meeting-date"><strong>{meetingDay(meeting.start).split(',')[0]}</strong><small>{meetingDay(meeting.start).split(',').slice(1).join(',')}</small></span><div><strong>{meeting.title}</strong><small>{meetingTime(meeting.start)}–{meetingTime(meeting.end)} · {meeting.location} · {meeting.attendees} attendees</small></div><button className="icon-btn" disabled={!meeting.webLink} onClick={() => meeting.webLink && window.open(meeting.webLink, '_blank', 'noopener,noreferrer')} title="Open meeting in Outlook"><ExternalLink size={15} /></button></article>)}</div> : !meetingsError && <div className="calendar-empty"><span><CalendarDays size={23} /></span><div><strong>No meetings this week</strong><p>Microsoft Outlook returned no calendar events for the current week.</p></div></div>}</> : <div className="calendar-empty"><span><CalendarDays size={23} /></span><div><strong>{outlook.connected ? 'Outlook Calendar is not enabled' : 'Connect Microsoft Outlook'}</strong><p>{outlook.connected ? 'Reconnect and grant calendar access to show weekly meetings.' : 'Choose Outlook email, Outlook calendar, or both in Account Settings.'}</p></div><button className="btn secondary" onClick={() => setView('settings')}>Open integrations</button></div>}</section>
  </>
}

function OutlookEmailPanel({ outlook, messages, loading, error, lastUpdated, onRefresh, onOpenSettings }) {
  const updated = lastUpdated ? new Intl.DateTimeFormat('en-NA', { hour: '2-digit', minute: '2-digit' }).format(lastUpdated) : null
  const emailDate = (date) => new Intl.DateTimeFormat('en-NA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
  const enabled = outlook.connected && outlook.email
  return <section className="panel outlook-email-panel"><div className="panel-head"><div><span className="eyebrow">Microsoft Outlook</span><h2>Recent client emails</h2><p>Read-only messages involving contacts registered in ContractConnect.</p></div>{enabled && <div className="calendar-refresh-actions">{updated && <small>Last updated {updated}</small>}<button className="btn secondary" disabled={loading} onClick={onRefresh}><RefreshCcw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Refreshing…' : 'Refresh'}</button></div>}</div>{enabled ? <>{error && <div className="calendar-sync-warning" role="status"><strong>Email refresh failed.</strong> {error} {messages.length > 0 && 'Showing the last successfully retrieved messages.'}</div>}{loading && !messages.length ? <div className="calendar-empty"><span><Mail size={23} /></span><div><strong>Loading client emails…</strong><p>Matching recent Outlook messages to registered CRM contact addresses.</p></div></div> : messages.length ? <div className="outlook-email-list">{messages.map((message) => <article key={message.id} className={!message.isRead && message.direction === 'Received' ? 'unread' : ''}><span className={`email-direction ${message.direction.toLowerCase()}`}>{message.direction === 'Sent' ? <ExternalLink size={15} /> : <Mail size={15} />}</span><div><div><strong>{message.subject}</strong><time>{emailDate(message.date)}</time></div><small>{message.direction} · {message.contacts.join(', ') || 'Known CRM contact'}{message.hasAttachments ? ' · Attachment' : ''}</small>{message.preview && <p>{message.preview}</p>}</div><button className="icon-btn" disabled={!message.webLink} onClick={() => message.webLink && window.open(message.webLink, '_blank', 'noopener,noreferrer')} title="Open email in Outlook"><ExternalLink size={15} /></button></article>)}</div> : !error && <div className="calendar-empty"><span><Mail size={23} /></span><div><strong>No matching client emails</strong><p>No recent Inbox or Sent messages matched the email addresses stored under Contacts.</p></div></div>}</> : <div className="calendar-empty"><span><Mail size={23} /></span><div><strong>{outlook.connected ? 'Outlook Email is not enabled' : 'Connect Microsoft Outlook'}</strong><p>{outlook.connected ? 'Update Outlook permissions and select Outlook email.' : 'Connect Outlook Email in Account Settings to display CRM-related messages.'}</p></div><button className="btn secondary" onClick={onOpenSettings}>Open integrations</button></div>}</section>
}

function Companies({ companies, contacts, contracts, interactions, query, openCompany, financialYear, onSaveFinancialYear }) {
  const [viewMode, setViewMode] = useState('all')
  const [filters, setFilters] = useState(() => JSON.parse(localStorage.getItem('contractconnect-company-view') || '{"status":"All","industry":"All","owner":"All"}'))
  const [financialYearDraft, setFinancialYearDraft] = useState(financialYear)
  const [savingYear, setSavingYear] = useState(false)
  useEffect(() => setFinancialYearDraft(financialYear), [financialYear])
  const industries = ['All', ...new Set(companies.map((c) => c.industry))]
  const owners = ['All', ...new Set(companies.map((c) => c.owner))]
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const limit = viewMode === 'top10' ? 10 : 20
  const shiftBackOneYear = (date) => `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`
  const previousFinancialYear = { start: shiftBackOneYear(financialYear.start), end: shiftBackOneYear(financialYear.end) }
  const rankingPeriod = viewMode === 'top20' ? previousFinancialYear : financialYear
  const rankingPeriodLabel = `${formatDate(rankingPeriod.start)} – ${formatDate(rankingPeriod.end)}`
  const saveFinancialYear = async () => {
    if (!financialYearDraft.start || !financialYearDraft.end || financialYearDraft.start > financialYearDraft.end) return
    setSavingYear(true)
    try { await onSaveFinancialYear(financialYearDraft) }
    catch (error) { alert(`Financial year could not be saved: ${error.message}`) }
    finally { setSavingYear(false) }
  }
  const companyValueForPeriod = (companyId, periodStart, periodEnd) => contracts.filter((contract) => {
    if (contract.companyId !== companyId) return false
    return contract.startDate <= periodEnd && contract.endDate >= periodStart
  }).reduce((sum, contract) => sum + Number(contract.value), 0)
  const matching = companies.filter((c) => `${c.name} ${c.industry} ${c.location}`.toLowerCase().includes(query.toLowerCase()))
  const filtered = viewMode === 'all'
    ? matching.filter((c) => filters.status === 'All' || c.status === filters.status).filter((c) => filters.industry === 'All' || c.industry === filters.industry).filter((c) => filters.owner === 'All' || c.owner === filters.owner)
    : matching.map((company) => ({ ...company, rankedValue: companyValueForPeriod(company.id, rankingPeriod.start, rankingPeriod.end) })).filter((company) => company.rankedValue > 0).sort((a, b) => b.rankedValue - a.rankedValue || a.name.localeCompare(b.name)).slice(0, limit)
  const rankingTotal = viewMode === 'all' ? 0 : filtered.reduce((sum, company) => sum + company.rankedValue, 0)
  return <section className="panel table-panel"><div className="company-view-tabs" role="tablist" aria-label="Company views"><button role="tab" aria-selected={viewMode === 'all'} className={viewMode === 'all' ? 'active' : ''} onClick={() => setViewMode('all')}>All companies</button><button role="tab" aria-selected={viewMode === 'top10'} className={viewMode === 'top10' ? 'active' : ''} onClick={() => setViewMode('top10')}>Top 10 clients</button><button role="tab" aria-selected={viewMode === 'top20'} className={viewMode === 'top20' ? 'active' : ''} onClick={() => setViewMode('top20')}>Top 20 clients</button></div>{viewMode === 'all' ? <div className="filter-toolbar"><select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}><option>All</option><option>Active</option><option>Prospect</option><option>Renewal due</option><option>Inactive</option></select><select value={filters.industry} onChange={(e) => updateFilter('industry', e.target.value)}>{industries.map((value) => <option key={value}>{value}</option>)}</select><select value={filters.owner} onChange={(e) => updateFilter('owner', e.target.value)}>{owners.map((value) => <option key={value}>{value}</option>)}</select><button className="btn secondary" onClick={() => localStorage.setItem('contractconnect-company-view', JSON.stringify(filters))}>Save view</button><button className="text-btn" onClick={() => setFilters({ status: 'All', industry: 'All', owner: 'All' })}>Clear</button></div> : <><div className="financial-year-controls"><span>Financial year</span><label>Start<input type="date" value={financialYearDraft.start} onChange={(e) => setFinancialYearDraft((current) => ({ ...current, start: e.target.value }))} /></label><label>End<input type="date" value={financialYearDraft.end} onChange={(e) => setFinancialYearDraft((current) => ({ ...current, end: e.target.value }))} /></label><button className="btn secondary" disabled={!financialYearDraft.start || !financialYearDraft.end || financialYearDraft.start > financialYearDraft.end} onClick={saveFinancialYear}>Apply financial year</button></div><div className="ranking-summary"><div><span className="eyebrow">{viewMode === 'top10' ? 'Current financial year' : 'Previous financial year'}</span><strong>{viewMode === 'top10' ? 'Top 10 clients' : 'Top 20 clients'}</strong><small>Contracts active from {rankingPeriodLabel}. Reviews are completed manually by users.</small></div><div><small>Ranked portfolio value</small><strong>{formatMoney(rankingTotal)}</strong></div></div></>}<div className="table-wrap"><table><thead><tr>{viewMode !== 'all' && <th className="rank-column">Rank</th>}<th>Company</th><th>Status</th><th>Primary contact</th><th>{viewMode === 'all' ? 'Contract value' : 'Financial-year value'}</th><th>Last interaction</th><th /></tr></thead><tbody>{filtered.map((company, index) => {
    const contact = contacts.find((c) => c.companyId === company.id && c.primary)
    const value = viewMode === 'all' ? contracts.filter((c) => c.companyId === company.id).reduce((sum, c) => sum + Number(c.value), 0) : company.rankedValue
    const last = [...interactions].filter((i) => i.companyId === company.id).sort((a, b) => b.date.localeCompare(a.date))[0]
    return <tr key={company.id} onClick={() => openCompany(company.id)}>{viewMode !== 'all' && <td className="rank-column"><span className={`rank-badge rank-${index + 1}`}>{index + 1}</span></td>}<td><div className="company-cell"><Avatar name={company.name} color={company.color} /><div><strong>{company.name}</strong><small>{company.industry} · {company.location}</small></div></div></td><td><Status>{company.status}</Status></td><td>{contact ? <div><strong className="cell-main">{contact.name}</strong><small className="cell-sub">{contact.role}</small></div> : '—'}</td><td><strong className="cell-main">{value ? formatMoney(value) : '—'}</strong></td><td>{last ? <div><strong className="cell-main">{formatDate(last.date)}</strong><small className="cell-sub">{last.type}</small></div> : '—'}</td><td><ChevronRight size={17} /></td></tr>
  })}</tbody></table></div>{!filtered.length && <Empty title={viewMode === 'all' ? 'No companies found' : `No clients found for ${rankingPeriodLabel}`} text={viewMode === 'all' ? 'Try a different search term.' : 'No contracts overlap this financial year.'} />}</section>
}

function PartnerSaleForm({ partner, companies, onSave, onClose }) {
  const [form, setForm] = useState({ amount: '', date: today, product: '', clientSelection: companies[0]?.id || 'manual', manualClientName: '', reference: '' })
  const submit = (event) => {
    event.preventDefault()
    const amount = Number(form.amount)
    const selectedClient = companies.find((company) => company.id === form.clientSelection)
    const clientName = form.clientSelection === 'manual' ? form.manualClientName.trim() : selectedClient?.name
    if (!Number.isFinite(amount) || amount <= 0 || !clientName) return
    onSave({ amount, date: form.date, product: form.product.trim(), reference: form.reference.trim(), clientId: selectedClient?.id || null, clientName, clientSource: selectedClient ? 'company-record' : 'manual' })
  }
  return <form className="form-grid" onSubmit={submit}><div className="partner-sale-context full"><Avatar name={partner.name} color="#315bd1" /><div><strong>Product partner: {partner.name}</strong><small>This sale will count toward {partner.name}’s annual target.</small></div></div><label>Purchasing client<select required value={form.clientSelection} onChange={(e) => setForm({ ...form, clientSelection: e.target.value })}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}<option value="manual">Client not listed — enter manually</option></select></label><label>Product sold<input required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder={`e.g. ${partner.name} licence`} /></label>{form.clientSelection === 'manual' && <label className="full">Client name<input required value={form.manualClientName} onChange={(e) => setForm({ ...form, manualClientName: e.target.value })} placeholder="Enter the purchasing client’s name" /></label>}<label>Sale amount (NAD)<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></label><label>Sale date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label className="full">Order or opportunity reference<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Optional PO, invoice or opportunity number" /></label><div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">Record sale</button></div></form>
}

function PartnerForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { name: initial.name, productCategory: initial.productCategory, annualTarget: initial.annualTarget, salesAchieved: initial.openingSales || 0, owner: initial.owner } : { name: '', productCategory: '', annualTarget: '', salesAchieved: 0, owner: '' })
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = (event) => {
    event.preventDefault()
    const annualTarget = Number(form.annualTarget)
    const salesAchieved = Number(form.salesAchieved)
    if (!Number.isFinite(annualTarget) || annualTarget <= 0 || !Number.isFinite(salesAchieved) || salesAchieved < 0) return
    onSave({ ...initial, ...form, annualTarget, salesAchieved })
  }
  return <form className="form-grid" onSubmit={submit}><label>Partner name<input required name="name" value={form.name} onChange={change} placeholder="Partner organisation" /></label><label>Account owner<input required name="owner" value={form.owner} onChange={change} placeholder="Responsible team member" /></label><label className="full">Product category<input required name="productCategory" value={form.productCategory} onChange={change} placeholder="Products or services covered by the target" /></label><label>Annual sales target (NAD)<input required min="0.01" step="0.01" type="number" name="annualTarget" value={form.annualTarget} onChange={change} /></label><label>Opening sales achieved (NAD)<input required min="0" step="0.01" type="number" name="salesAchieved" value={form.salesAchieved} onChange={change} /><small>Set this to 0 when starting a new financial year.</small></label><div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">{initial ? 'Save partner' : 'Add partner'}</button></div></form>
}

function Partners({ query, canWrite, companies, businessData, onRefresh }) {
  const partnerTargets = businessData.partners
  const [salePartner, setSalePartner] = useState(null)
  const [partnerEditor, setPartnerEditor] = useState(null)
  const [addingPartner, setAddingPartner] = useState(false)
  const financialYear = businessData.financialYear
  const partners = partnerTargets.filter((partner) => `${partner.name} ${partner.productCategory} ${partner.owner}`.toLowerCase().includes(query.toLowerCase()))
  const totalTarget = partners.reduce((sum, partner) => sum + partner.annualTarget, 0)
  const totalSales = partners.reduce((sum, partner) => sum + partner.salesAchieved, 0)
  const totalRemaining = Math.max(totalTarget - totalSales, 0)
  const overallProgress = totalTarget ? Math.round(totalSales / totalTarget * 100) : 0
  const salesActivity = partnerTargets.flatMap((partner) => (partner.sales || []).map((sale) => ({ ...sale, partnerId: partner.id, partnerName: partner.name }))).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 6)
  const recordSale = async (sale) => {
    try {
      if (!salePartner.targetId) throw new Error('Set this partner’s target for the active financial year before recording sales.')
      await recordPartnerSale(salePartner.targetId, sale)
      await onRefresh()
      setSalePartner(null)
    } catch (error) { alert(`Partner sale could not be recorded: ${error.message}`) }
  }
  const savePartner = async (partner) => {
    if (!financialYear.id) return alert('Set and save the active financial year before adding partner targets.')
    try {
      await savePartnerTarget(partner, financialYear.id)
      await onRefresh()
      setPartnerEditor(null)
      setAddingPartner(false)
    } catch (error) { alert(`Partner target could not be saved: ${error.message}`) }
  }
  return <div className="partners-page">{canWrite && <div className="partner-page-actions"><button className="btn primary" onClick={() => setAddingPartner(true)}><Plus size={16} /> Add partner</button></div>}<section className="partner-summary-grid"><article className="panel"><span className="partner-summary-icon target"><CircleDollarSign size={20} /></span><div><small>Combined annual target</small><strong>{formatMoney(totalTarget)}</strong><span>{formatDate(financialYear.start)} – {formatDate(financialYear.end)}</span></div></article><article className="panel"><span className="partner-summary-icon achieved"><BarChart3 size={20} /></span><div><small>Sales achieved</small><strong>{formatMoney(totalSales)}</strong><span>{overallProgress}% of target</span></div></article><article className="panel"><span className="partner-summary-icon remaining"><Clock3 size={20} /></span><div><small>Remaining to target</small><strong>{formatMoney(totalRemaining)}</strong><span>Across {partners.length} partners</span></div></article></section>
    <section className="panel partner-targets"><div className="panel-head"><div><span className="eyebrow">Partner performance</span><h2>Annual monetary sales targets</h2><p>Monitor product sales against each partner commitment.</p></div><Status>{overallProgress >= 100 ? 'Target achieved' : 'In progress'}</Status></div><div className="table-wrap"><table><thead><tr><th>Partner</th><th>Product category</th><th>Annual target</th><th>Sales achieved</th><th>Remaining</th><th>Progress</th><th>Owner</th><th /></tr></thead><tbody>{partners.map((partner) => {
      const remaining = Math.max(partner.annualTarget - partner.salesAchieved, 0)
      const progress = partner.annualTarget ? Math.round(partner.salesAchieved / partner.annualTarget * 100) : 0
      return <tr key={partner.id}><td><div className="company-cell"><Avatar name={partner.name} color="#315bd1" /><div><strong>{partner.name}</strong><small>Product partner</small></div></div></td><td>{partner.productCategory}</td><td><strong>{formatMoney(partner.annualTarget)}</strong></td><td><strong className="partner-sales">{formatMoney(partner.salesAchieved)}</strong></td><td>{formatMoney(remaining)}</td><td><div className="target-progress"><div><i style={{ width: `${Math.min(progress, 100)}%` }} /></div><strong>{progress}%</strong></div></td><td>{partner.owner}</td><td>{canWrite && <div className="partner-row-actions"><button className="icon-btn" onClick={() => setPartnerEditor(partner)} title="Edit partner and annual target"><Pencil size={15} /></button><button className="btn secondary record-sale-btn" onClick={() => setSalePartner(partner)}><Plus size={14} /> Record sale</button></div>}</td></tr>
    })}</tbody></table></div>{!partners.length && <Empty title="No partners found" text="Try a different search term." />}</section>
    <section className="panel partner-activity"><div className="panel-head"><div><span className="eyebrow">Sales updates</span><h2>Recent partner activity</h2></div><span className="count">{salesActivity.length}</span></div>{salesActivity.map((sale) => <article key={sale.id}><span><CircleDollarSign size={16} /></span><div><strong>{sale.product || sale.description || 'Partner sale'} sold to {sale.clientName || 'Client not recorded'}</strong><small>{sale.partnerName} partner target · {formatDate(sale.date)}{sale.reference ? ` · ${sale.reference}` : ''}{sale.clientSource === 'manual' ? ' · Manually entered client' : ''}</small></div><b>+{formatMoney(sale.amount)}</b></article>)}{!salesActivity.length && <Empty title="No sales recorded yet" text="Use Record sale beside a partner to update its progress." />}</section>
    {salePartner && <Modal title="Record partner sale" onClose={() => setSalePartner(null)}><PartnerSaleForm partner={salePartner} companies={companies} onSave={recordSale} onClose={() => setSalePartner(null)} /></Modal>}
    {(addingPartner || partnerEditor) && <Modal title={partnerEditor ? 'Edit partner target' : 'Add a partner'} onClose={() => { setAddingPartner(false); setPartnerEditor(null) }}><PartnerForm initial={partnerEditor} onSave={savePartner} onClose={() => { setAddingPartner(false); setPartnerEditor(null) }} /></Modal>}
  </div>
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

function SlaForm({ contracts, companyById, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { contractId: contracts[0]?.id || '', title: '', service: '', availabilityTarget: 99.5, responseHours: 2, resolutionHours: 8, startDate: today, endDate: '', reviewFrequency: 'Quarterly', status: 'Active' })
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = (event) => {
    event.preventDefault()
    onSave({ ...form, availabilityTarget: Number(form.availabilityTarget), responseHours: Number(form.responseHours), resolutionHours: Number(form.resolutionHours) })
  }
  return <form className="form-grid" onSubmit={submit}><label className="full">Related contract<select required name="contractId" value={form.contractId} onChange={change}>{contracts.map((contract) => <option key={contract.id} value={contract.id}>{companyById[contract.companyId]?.name} — {contract.title}</option>)}</select></label><label className="full">SLA title<input required name="title" value={form.title} onChange={change} placeholder="Service level agreement title" /></label><label className="full">Covered service<textarea required name="service" value={form.service} onChange={change} placeholder="Describe the service and obligations covered" /></label><label>Availability target (%)<input required min="0" max="100" step="0.01" type="number" name="availabilityTarget" value={form.availabilityTarget} onChange={change} /></label><label>Initial response (hours)<input required min="0" step="0.5" type="number" name="responseHours" value={form.responseHours} onChange={change} /></label><label>Resolution target (hours)<input required min="0" step="0.5" type="number" name="resolutionHours" value={form.resolutionHours} onChange={change} /></label><label>Review frequency<select name="reviewFrequency" value={form.reviewFrequency} onChange={change}><option>Monthly</option><option>Quarterly</option><option>Biannual</option><option>Annual</option></select></label><label>Start date<input required type="date" name="startDate" value={form.startDate} onChange={change} /></label><label>End date<input required type="date" name="endDate" value={form.endDate} onChange={change} /></label><label>Status<select name="status" value={form.status} onChange={change}><option>Draft</option><option>Active</option><option>Under review</option><option>Expired</option><option>Terminated</option></select></label><div className="form-actions full"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">{initial ? 'Save SLA' : 'Add SLA'}</button></div></form>
}

function ServiceLevelAgreements({ contracts, companyById, query, canWrite, slas, onRefresh }) {
  const [editingSla, setEditingSla] = useState(null)
  const [addingSla, setAddingSla] = useState(false)
  const contractById = Object.fromEntries(contracts.map((contract) => [contract.id, contract]))
  const filtered = slas.filter((sla) => {
    const contract = contractById[sla.contractId]
    const company = companyById[contract?.companyId]
    return `${sla.title} ${sla.service} ${sla.status} ${company?.name} ${contract?.title}`.toLowerCase().includes(query.toLowerCase())
  })
  const saveSla = async (sla) => {
    try {
      await saveServiceLevelAgreement(sla)
      await onRefresh()
      setEditingSla(null)
      setAddingSla(false)
    } catch (error) { alert(`Service level agreement could not be saved: ${error.message}`) }
  }
  const activeCount = slas.filter((sla) => sla.status === 'Active').length
  const reviewCount = slas.filter((sla) => sla.status === 'Under review').length
  return <div className="sla-page">{canWrite && <div className="sla-page-actions"><button className="btn primary" disabled={!contracts.length} onClick={() => setAddingSla(true)}><Plus size={16} /> Add SLA</button></div>}<section className="sla-summary-grid"><article className="panel"><span>Stored SLAs</span><strong>{slas.length}</strong><small>Linked to client contracts</small></article><article className="panel"><span>Active</span><strong>{activeCount}</strong><small>Current service commitments</small></article><article className="panel"><span>Under review</span><strong>{reviewCount}</strong><small>Awaiting agreement or approval</small></article></section><section className="panel table-panel sla-table"><div className="panel-head"><div><span className="eyebrow">Contract commitments</span><h2>Service Level Agreements</h2><p>Store and monitor the service standards agreed with each client.</p></div></div><div className="table-wrap"><table><thead><tr><th>SLA</th><th>Client and contract</th><th>Availability</th><th>Response</th><th>Resolution</th><th>Review</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((sla) => { const contract = contractById[sla.contractId]; const company = companyById[contract?.companyId]; return <tr key={sla.id}><td><div className="contract-name"><FileText size={18} /><div><strong>{sla.title}</strong><small className="cell-sub">{sla.service}</small></div></div></td><td><strong className="cell-main">{company?.name || 'Unknown client'}</strong><small className="cell-sub">{contract?.title || 'Contract unavailable'}</small></td><td><strong>{sla.availabilityTarget}%</strong></td><td>{sla.responseHours} hr</td><td>{sla.resolutionHours} hr</td><td>{sla.reviewFrequency}</td><td><Status>{sla.status}</Status></td><td>{canWrite && <button className="icon-btn" onClick={() => setEditingSla(sla)} title="Edit SLA"><Pencil size={15} /></button>}</td></tr> })}</tbody></table></div>{!filtered.length && <Empty title="No service level agreements found" text={contracts.length ? 'Add an SLA when a client agrees to service commitments.' : 'Add a contract before creating its SLA.'} />}</section>{(addingSla || editingSla) && <Modal title={editingSla ? 'Edit service level agreement' : 'Add service level agreement'} onClose={() => { setAddingSla(false); setEditingSla(null) }}><SlaForm contracts={contracts} companyById={companyById} initial={editingSla} onSave={saveSla} onClose={() => { setAddingSla(false); setEditingSla(null) }} /></Modal>}</div>
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
  return <section className="panel table-panel"><div className="document-summary"><span><FolderOpen size={20} /></span><div><strong>{documents.length} documents</strong><small>ContractConnect repository and read-only SharePoint files</small></div></div><div className="table-wrap"><table><thead><tr><th>Document</th><th>Contract</th><th>Source</th><th>Category</th><th>Access</th><th>Version</th><th>Updated</th><th /></tr></thead><tbody>{filtered.map((doc) => { const contract = contractById[doc.contractId]; const remote = doc.source === 'SharePoint'; return <tr key={doc.id}><td><div className="contract-name"><FileText size={18} /><div><strong>{doc.name}</strong><small className="cell-sub">{size(doc.fileSize)}</small></div></div></td><td><strong className="cell-main">{contract?.title || (remote ? 'SharePoint contract file' : '—')}</strong><small className="cell-sub">{companyById[contract?.companyId]?.name}</small></td><td><Status>{doc.source || 'ContractConnect'}</Status></td><td><Status>{doc.category}</Status></td><td><Status>{doc.accessLevel}</Status></td><td>{remote ? '—' : `v${doc.version}`}</td><td>{formatDate(String(doc.modifiedAt || doc.createdAt).slice(0, 10))}</td><td><div className="row-actions"><button className="icon-btn" onClick={() => onOpen(doc)} title="Open document"><ExternalLink size={15} /></button>{!remote && <button className="icon-btn danger" onClick={() => onDelete(doc)} title="Delete document"><Trash2 size={15} /></button>}</div></td></tr> })}</tbody></table></div>{!filtered.length && <Empty title="No documents found" text="No matching ContractConnect or SharePoint documents were found." />}</section>
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

function AccountSettings({ profile, email, userId, theme, outlook, onOutlookChanged, onThemeChange, onUpdated }) {
  const stockAvatars = ['/avatars/avatar-1.jpg?v=2', '/avatars/avatar-2.jpg?v=2', '/avatars/avatar-3.jpg?v=2', '/avatars/avatar-4.jpg?v=2', '/avatars/avatar-5.jpg?v=2']
  const [form, setForm] = useState({ fullName: profile.full_name, email, password: '', confirm: '', avatarUrl: profile.avatar_url || '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [identities, setIdentities] = useState([])
  const [unlinking, setUnlinking] = useState(false)
  const [outlookPreferences, setOutlookPreferences] = useState(outlook)
  const [outlookBusy, setOutlookBusy] = useState(false)
  useEffect(() => setOutlookPreferences(outlook), [outlook])
  useEffect(() => { getLinkedIdentities().then(setIdentities).catch((err) => setError(err.message)) }, [])
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (form.password && form.password !== form.confirm) { setError('The new passwords do not match.'); return }
    setSaving(true)
    try {
      const nextEmail = form.email.trim().toLowerCase()
      const emailChanged = nextEmail !== email.toLowerCase()
      const updated = await updateAccount({ fullName: form.fullName.trim(), email: emailChanged ? nextEmail : undefined, password: form.password, avatarUrl: form.avatarUrl })
      onUpdated(updated); setForm((current) => ({ ...current, password: '', confirm: '' })); setMessage(emailChanged ? 'Your profile was updated. Check your email and confirm the address change before signing in with the new address.' : 'Your account settings have been updated.')
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
  const unlinkMicrosoft = async () => {
    if (!confirm('Unlink Microsoft from this administrator account? Confirm that sign-in with the replacement email and password works before continuing.')) return
    setUnlinking(true); setError(''); setMessage('')
    try { const remaining = await unlinkMicrosoftIdentity(); setIdentities(remaining); setMessage('Microsoft was unlinked from this administrator account. Sign out before testing Microsoft sign-in again.') }
    catch (err) { setError(err.message || 'Microsoft could not be unlinked.') }
    finally { setUnlinking(false) }
  }
  const saveOutlookConnection = async () => {
    if (!outlookPreferences.email && !outlookPreferences.calendar && !outlookPreferences.sharepoint) return
    setOutlookBusy(true); setError(''); setMessage('')
    try { await beginOutlookConnection(outlookPreferences) }
    catch (err) { setError(err.message || 'Microsoft authorization could not start.'); setOutlookBusy(false) }
  }
  const disconnectOutlook = async () => {
    if (!confirm('Disconnect Outlook and remove ContractConnect’s stored Microsoft credentials?')) return
    setOutlookBusy(true); setError(''); setMessage('')
    try { await disconnectOutlookAccount(); await onOutlookChanged(); setMessage('Microsoft Outlook has been disconnected from ContractConnect.') }
    catch (err) { setError(err.message || 'Outlook could not be disconnected.') }
    finally { setOutlookBusy(false) }
  }
  return <div className="settings-grid">
    <section className="panel settings-card"><div className="settings-intro"><Avatar name={profile.full_name} color="#d9a451" src={form.avatarUrl} /><div><h2>Personal information</h2><p>Update how your profile appears across ContractConnect.</p></div></div><form className="settings-form" onSubmit={submit}>
      <div className="avatar-settings"><span>Profile picture</span><div className="avatar-options"><button type="button" className={!form.avatarUrl ? 'selected' : ''} onClick={() => setForm({ ...form, avatarUrl: '' })}><Avatar name={form.fullName} color="#d9a451" /></button>{stockAvatars.map((src) => <button type="button" key={src} className={form.avatarUrl === src ? 'selected' : ''} onClick={() => setForm({ ...form, avatarUrl: src })}><Avatar name="Profile" src={src} /></button>)}<label className="avatar-upload"><Upload size={17} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} />{uploading && <small>Uploading…</small>}</label></div></div>
      <label>Full name<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
      <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><small>Supabase may send confirmation links before the new address becomes active.</small></label>
      <div className="settings-divider"><span>Password</span><p>Leave these fields blank to keep your current password.</p></div>
      <label>New password<input minLength="8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></label>
      <label>Confirm new password<input minLength="8" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat new password" /></label>
      {error && <div className="auth-alert error">{error}</div>}{message && <div className="auth-alert success">{message}</div>}
      <button className="btn primary settings-save" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
    </form></section>
    <aside className="settings-aside"><section className="panel appearance-card"><span className="settings-icon"><Sun size={21} /></span><h2>Appearance</h2><p>Choose how ContractConnect looks on this device.</p><div className="theme-options"><button className={theme === 'light' ? 'active' : ''} onClick={() => onThemeChange('light')}><Sun size={17} /><span><strong>Light</strong><small>Bright workspace</small></span></button><button className={theme === 'dark' ? 'active' : ''} onClick={() => onThemeChange('dark')}><Moon size={17} /><span><strong>Dark</strong><small>Reduced glare</small></span></button></div></section><section className="panel security-card"><span><ShieldCheck size={22} /></span><h2>Secure account</h2><p>Your account is protected by Supabase authentication, encrypted sessions, and row-level database security.</p><dl><div><dt>Access level</dt><dd>{profile.role}</dd></div><div><dt>Session</dt><dd className="secure-value">Active</dd></div></dl><div className="linked-identities"><strong>Linked sign-in methods</strong>{identities.map((identity) => <div className="identity-row" key={identity.id}><span>{identity.provider === 'azure' ? 'Microsoft' : identity.provider === 'email' ? 'Email and password' : identity.provider}</span>{identity.provider === 'azure' && identities.length > 1 && <button type="button" onClick={unlinkMicrosoft} disabled={unlinking}>{unlinking ? 'Unlinking…' : 'Unlink'}</button>}</div>)}</div></section></aside>
    <section className="panel integrations-card"><div className="panel-head"><div><span className="eyebrow">Optional connections</span><h2>Integrations</h2><p>Connect services to bring relevant activity into your workspace.</p></div></div><article className="integration-row"><span className="microsoft-integration-icon" aria-hidden="true"><i /><i /><i /><i /></span><div><strong>Microsoft 365</strong><p>Choose which Microsoft services ContractConnect may read.</p><div className="outlook-options"><label><input type="checkbox" disabled={outlookBusy} checked={outlookPreferences.email} onChange={(e) => setOutlookPreferences((current) => ({ ...current, email: e.target.checked }))} /> Outlook email</label><label><input type="checkbox" disabled={outlookBusy} checked={outlookPreferences.calendar} onChange={(e) => setOutlookPreferences((current) => ({ ...current, calendar: e.target.checked }))} /> Outlook calendar</label><label><input type="checkbox" disabled={outlookBusy} checked={Boolean(outlookPreferences.sharepoint)} onChange={(e) => setOutlookPreferences((current) => ({ ...current, sharepoint: e.target.checked }))} /> SharePoint contracts</label></div><small>{outlookPreferences.connected ? `Connected as ${outlookPreferences.accountEmail || 'Microsoft user'} · ${[outlookPreferences.email && 'Email', outlookPreferences.calendar && 'Calendar', outlookPreferences.sharepoint && 'SharePoint'].filter(Boolean).join(', ')}` : outlookPreferences.status === 'error' ? `Connection needs attention${outlookPreferences.error ? ` · ${outlookPreferences.error}` : ''}` : 'Optional · Microsoft will request only the permissions selected here'}</small></div><div className="integration-actions"><button className="btn primary" disabled={outlookBusy || (!outlookPreferences.email && !outlookPreferences.calendar && !outlookPreferences.sharepoint)} onClick={saveOutlookConnection}>{outlookBusy ? 'Please wait…' : outlookPreferences.connected ? 'Update permissions' : <><ExternalLink size={14} /> Connect</>}</button>{outlookPreferences.connected && <button className="text-btn" disabled={outlookBusy} onClick={disconnectOutlook}>Disconnect</button>}</div><ChevronDown size={17} /></article></section>
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
  return <div className="data-page"><section className="data-notice"><span><Database size={20} /></span><div><strong>Production data workspace</strong><p>Exports contain the records currently stored in this ContractConnect environment. Handle exported files according to your organisation’s data-classification policy.</p></div></section>
    <section className="panel data-section"><div className="panel-head"><div><span className="eyebrow">Current workspace</span><h2>Export workspace data</h2></div></div><div className="export-grid">{exports.map((item) => <article className="export-card" key={item.name}><span><FileSpreadsheet size={20} /></span><div><strong>{item.name}</strong><small>{item.count} records · CSV format</small></div><button className="icon-btn" onClick={() => downloadCsv(`contractconnect-${item.name.toLowerCase().replace(' ', '-')}.csv`, item.headers, item.rows)} aria-label={`Export ${item.name}`}><Download size={17} /></button></article>)}</div></section>
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
  const teamById = Object.fromEntries(team.map((user) => [user.id, user]))
  const auditDetails = (log) => {
    const before = log.old_data || {}
    const after = log.new_data || {}
    const record = log.action === 'DELETE' ? before : after
    const recordName = record.full_name || record.name || record.title || record.summary || record.file_name || `Record ${log.record_id?.slice(0, 12)}`
    const changes = []
    if (before.role !== undefined && after.role !== undefined && before.role !== after.role) changes.push(`Role: ${before.role} → ${after.role}`)
    if (before.is_active !== undefined && after.is_active !== undefined && before.is_active !== after.is_active) changes.push(after.is_active ? 'Access approved' : 'Access deactivated')
    if (before.full_name && after.full_name && before.full_name !== after.full_name) changes.push(`Name: ${before.full_name} → ${after.full_name}`)
    const verb = log.action === 'INSERT' ? 'Created' : log.action === 'DELETE' ? 'Deleted' : 'Updated'
    return { title: `${verb} ${recordName}`, changes: changes.join(' · ') || `${log.table_name.replaceAll('_', ' ')} record changed` }
  }
  return <div className="governance-page">{error && <div className="auth-alert error">{error}</div>}<section className="panel team-panel"><div className="panel-head"><div><span className="eyebrow">Access control</span><h2>Team roles</h2></div><span className="count">{team.length}</span></div>{team.map((user) => <div className="team-row" key={user.id}><Avatar name={user.full_name} src={user.avatar_url} color="#d9a451" /><div><strong>{user.full_name}</strong><small>{user.id === currentUserId ? 'You' : user.is_active ? 'Active team member' : 'Awaiting approval'}</small></div><select value={user.role} disabled={!canAdminister || user.id === currentUserId || !user.is_active} onChange={(e) => changeRole(user.id, e.target.value)}><option>Administrator</option><option>Manager</option><option>Contributor</option><option>Read-only</option></select>{canAdminister && user.id !== currentUserId && <button className={`btn ${user.is_active ? 'secondary' : 'primary'}`} onClick={() => changeAccess(user.id, !user.is_active)}>{user.is_active ? 'Deactivate' : 'Approve access'}</button>}</div>)}</section><section className="panel audit-panel"><div className="panel-head"><div><span className="eyebrow">Governance</span><h2>Recent audit activity</h2></div><History size={18} /></div>{logs.map((log) => { const detail = auditDetails(log); const actor = teamById[log.changed_by]; return <div className="audit-row" key={log.id}><span className={`audit-action ${log.action.toLowerCase()}`}>{log.action}</span><Avatar name={actor?.full_name || 'System'} src={actor?.avatar_url} color="#315bd1" /><div><strong>{detail.title}</strong><small>{detail.changes}</small><small className="audit-attribution">By {actor?.full_name || (log.changed_by ? `User ${log.changed_by.slice(0, 8)}` : 'System')} · {new Date(log.created_at).toLocaleString('en-NA')}</small></div></div> })}{!logs.length && <Empty title="No audit activity" text="Changes will appear here after the governance migration." />}</section></div>
}

function CrmApp({ session, profile, theme, onThemeChange, onProfileUpdated, onSignOut }) {
  const [data, setData] = useState(emptyCrmData)
  const currentYear = new Date().getFullYear()
  const [businessData, setBusinessData] = useState({ financialYear: { id: null, start: `${currentYear}-01-01`, end: `${currentYear}-12-31` }, partners: [], slas: [], readNotificationIds: [] })
  const [outlook, setOutlook] = useState({ connected: false, status: 'disconnected', email: false, calendar: false, sharepoint: false, accountEmail: '', error: '' })
  const [weeklyMeetings, setWeeklyMeetings] = useState([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingsError, setMeetingsError] = useState('')
  const [meetingsLastUpdated, setMeetingsLastUpdated] = useState(null)
  const calendarRefreshInFlight = useRef(false)
  const calendarRetryAt = useRef(0)
  const [outlookEmails, setOutlookEmails] = useState([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailsError, setEmailsError] = useState('')
  const [emailsLastUpdated, setEmailsLastUpdated] = useState(null)
  const emailRefreshInFlight = useRef(false)
  const emailRetryAt = useRef(0)
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'dashboard')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [openNavGroups, setOpenNavGroups] = useState({ companies: true, contracts: false })
  const [documents, setDocuments] = useState([])
  const [sharePointDocuments, setSharePointDocuments] = useState([])
  const [sharePointLoading, setSharePointLoading] = useState(false)
  const [sharePointError, setSharePointError] = useState('')
  const [profileMenu, setProfileMenu] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [readNotifications, setReadNotifications] = useState(new Set())
  const [syncState, setSyncState] = useState(isSupabaseConfigured ? 'connecting' : 'local')
  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured) return undefined
    fetchCrmData().then(async (remoteData) => {
      if (!active) return
      if (active && remoteData) setData(remoteData)
      setSyncState('connected')
    }).catch((error) => {
      console.error('Supabase connection failed:', error.message)
      if (active) setSyncState('error')
    })
    return () => { active = false }
  }, [session.user.id])
  useEffect(() => { fetchDocuments().then(setDocuments).catch((error) => console.warn('Document repository unavailable:', error.message)) }, [session.user.id])
  const refreshOutlookCalendar = async (status = outlook) => {
    if (!status.connected || !status.calendar || calendarRefreshInFlight.current) return
    if (Date.now() < calendarRetryAt.current) {
      const waitSeconds = Math.ceil((calendarRetryAt.current - Date.now()) / 1000)
      setMeetingsError(`Microsoft is temporarily limiting requests. Try again in ${waitSeconds} seconds.`)
      return
    }
    calendarRefreshInFlight.current = true
    setMeetingsLoading(true); setMeetingsError('')
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
      const end = new Date(start); end.setDate(end.getDate() + 7)
      setWeeklyMeetings(await fetchOutlookCalendar(start, end))
      setMeetingsLastUpdated(new Date())
      calendarRetryAt.current = 0
    } catch (error) {
      if (error.retryAfterSeconds) calendarRetryAt.current = Date.now() + error.retryAfterSeconds * 1000
      setMeetingsError(error.message || 'Microsoft calendar could not be loaded.')
    } finally { calendarRefreshInFlight.current = false; setMeetingsLoading(false) }
  }
  const reloadOutlook = async () => {
    const status = await getOutlookStatus()
    setOutlook(status)
    if (!status.connected || !status.calendar) { setWeeklyMeetings([]); setMeetingsLastUpdated(null) }
    if (!status.connected || !status.email) { setOutlookEmails([]); setEmailsLastUpdated(null) }
    if (!status.connected || !status.sharepoint) setSharePointDocuments([])
    await Promise.all([refreshOutlookCalendar(status), refreshOutlookEmails(status)])
    return status
  }
  const refreshOutlookEmails = async (status = outlook) => {
    if (!status.connected || !status.email || emailRefreshInFlight.current) return
    if (Date.now() < emailRetryAt.current) {
      const waitSeconds = Math.ceil((emailRetryAt.current - Date.now()) / 1000)
      setEmailsError(`Microsoft is temporarily limiting requests. Try again in ${waitSeconds} seconds.`)
      return
    }
    emailRefreshInFlight.current = true
    setEmailsLoading(true); setEmailsError('')
    try {
      setOutlookEmails(await fetchOutlookEmail())
      setEmailsLastUpdated(new Date())
      emailRetryAt.current = 0
    } catch (error) {
      if (error.retryAfterSeconds) emailRetryAt.current = Date.now() + error.retryAfterSeconds * 1000
      setEmailsError(error.message || 'Microsoft email could not be loaded.')
    } finally { emailRefreshInFlight.current = false; setEmailsLoading(false) }
  }
  const refreshSharePoint = async (status = outlook) => {
    if (!status.connected || !status.sharepoint || sharePointLoading) return
    setSharePointLoading(true); setSharePointError('')
    try { setSharePointDocuments(await fetchSharePointDocuments()) }
    catch (error) { setSharePointError(error.message || 'SharePoint documents could not be loaded.') }
    finally { setSharePointLoading(false) }
  }
  useEffect(() => {
    reloadOutlook().catch((error) => setMeetingsError(error.message || 'Outlook connection status is unavailable.'))
    const url = new URL(window.location.href)
    if (url.searchParams.has('outlook')) { url.searchParams.delete('outlook'); window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`) }
  }, [session.user.id])
  useEffect(() => {
    if (view !== 'dashboard' || !outlook.connected || !outlook.calendar) return undefined
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return
      if (!meetingsLastUpdated || Date.now() - meetingsLastUpdated.getTime() >= 2 * 60 * 1000) refreshOutlookCalendar(outlook)
    }
    refreshIfStale()
    const interval = window.setInterval(refreshIfStale, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', refreshIfStale)
    window.addEventListener('focus', refreshIfStale)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshIfStale)
      window.removeEventListener('focus', refreshIfStale)
    }
  }, [view, outlook.connected, outlook.calendar, meetingsLastUpdated])
  useEffect(() => {
    if (view !== 'dashboard' || !outlook.connected || !outlook.email) return undefined
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return
      if (!emailsLastUpdated || Date.now() - emailsLastUpdated.getTime() >= 2 * 60 * 1000) refreshOutlookEmails(outlook)
    }
    refreshIfStale()
    const interval = window.setInterval(refreshIfStale, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', refreshIfStale)
    window.addEventListener('focus', refreshIfStale)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshIfStale)
      window.removeEventListener('focus', refreshIfStale)
    }
  }, [view, outlook.connected, outlook.email, emailsLastUpdated])
  useEffect(() => {
    if (view === 'documents' && outlook.connected && outlook.sharepoint) refreshSharePoint(outlook)
  }, [view, outlook.connected, outlook.sharepoint])
  const reloadBusinessData = async () => {
    const result = await fetchBusinessData(session.user.id)
    setBusinessData(result)
    setReadNotifications(new Set(result.readNotificationIds))
    return result
  }
  useEffect(() => {
    if (!isSupabaseConfigured) return
    reloadBusinessData().catch((error) => {
      console.error('Production business data unavailable:', error.message)
      setSyncState('error')
    })
  }, [session.user.id])
  const companyById = useMemo(() => Object.fromEntries(data.companies.map((c) => [c.id, c])), [data.companies])
  const contactById = useMemo(() => Object.fromEntries(data.contacts.map((c) => [c.id, c])), [data.contacts])
  const visibleDocuments = useMemo(() => [...sharePointDocuments, ...documents], [sharePointDocuments, documents])
  const reminderNotifications = (data.followups || []).filter((item) => !item.completed && (!item.assignedTo || item.assignedTo === session.user.id) && item.dueDate <= addDays(today, 3)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const unreadNotificationCount = reminderNotifications.filter((item) => !readNotifications.has(item.id)).length
  const markNotificationsRead = async () => {
    const next = new Set([...readNotifications, ...reminderNotifications.map((item) => item.id)])
    setReadNotifications(next)
    try { await persistNotificationReads(session.user.id, reminderNotifications.map((item) => item.id)) }
    catch (error) {
      setReadNotifications(readNotifications)
      console.error('Notification state could not be saved:', error.message)
    }
  }
  const updateFinancialYear = async ({ start, end }) => {
    await persistFinancialYear(start, end)
    await reloadBusinessData()
  }
  const openCompany = (id) => { setSelectedCompany(id); setView('company'); setSearchOpen(false) }
  const navigate = (id) => { setView(id); setSelectedCompany(null); setQuery(''); setSearchOpen(false); setMobileNav(false); setProfileMenu(false) }
  const titles = { dashboard: ['Overview', 'Your relationship workspace at a glance.'], companies: ['Companies', 'Manage every contracted company and prospect.'], partners: ['Partners', 'Monitor annual product-sales targets across your partner network.'], contacts: ['Contacts', 'The people behind every relationship.'], contracts: ['Contracts', 'Track contract value, terms, and renewal dates.'], slas: ['Service Level Agreements', 'Manage the service commitments agreed under client contracts.'], documents: ['Document repository', 'Store agreements, amendments, and supporting contract files.'], interactions: ['Interactions', 'A complete record of relationship activity.'], followups: ['Follow-ups', 'Stay on top of every commitment and next action.'], reports: ['Reports', 'Understand contract value, renewals, activity, and relationship health.'], governance: ['Governance', 'Manage team access and review changes to CRM records.'], settings: ['Account settings', 'Manage your personal information and account security.'], data: ['Data management', 'Prepare exports and templates for controlled data migration.'] }
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
  const saveInteractionWithRule = async (item) => {
    const { followUpAction = 'None', ...interaction } = item
    try {
      const savedInteraction = await saveRecord('interactions', interaction)
      let savedFollowup = null
      if (!editing && followUpAction !== 'None') {
        savedFollowup = await saveRecord('followups', {
          id: crypto.randomUUID(),
          companyId: interaction.companyId,
          contactId: interaction.contactId || '',
          title: `${followUpAction} follow-up: ${interaction.summary}`,
          dueDate: addDays(interaction.date, 3),
          priority: 'High',
          completed: false,
        })
      }
      setData((current) => ({
        ...current,
        interactions: current.interactions.some((entry) => entry.id === savedInteraction.id) ? current.interactions.map((entry) => entry.id === savedInteraction.id ? savedInteraction : entry) : [...current.interactions, savedInteraction],
        followups: savedFollowup ? [...current.followups, savedFollowup] : current.followups,
      }))
      setModal(null)
      setEditing(null)
    } catch (error) { alert(`Interaction or required follow-up could not be saved: ${error.message}`) }
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
  const activeTitle = titles[view] || titles.companies
  const openFollowupCount = (data.followups || []).filter((item) => !item.completed).length
  const canWrite = profile.role !== 'Read-only'
  const canAdminister = profile.role === 'Administrator'
  const canManage = ['Administrator', 'Manager'].includes(profile.role)
  const reset = () => {}

  return <div className={`app-shell ${canWrite ? '' : 'read-only'}`}>
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}><div className="brand"><span className="brand-mark"><FileText size={20} /></span><span>Contract<span>Connect</span></span><button className="nav-close" onClick={() => setMobileNav(false)}><X /></button></div><nav>{navItems.map(({ id, label, icon: Icon, children }) => { const groupOpen = Boolean(openNavGroups[id]); const groupActive = children?.some((child) => child.id === view) || (id === 'companies' && view === 'company'); return children ? <div className={`nav-group ${groupOpen ? 'open' : ''}`} key={id}><button className={groupActive ? 'active' : ''} onClick={() => setOpenNavGroups((current) => ({ ...current, [id]: !current[id] }))} aria-expanded={groupOpen}><Icon size={19} /><span>{label}</span><ChevronDown className="nav-chevron" size={16} /></button>{groupOpen && <div className="nav-children">{children.map((child) => <button key={child.id} className={view === child.id || (view === 'company' && child.id === 'companies') ? 'active' : ''} onClick={() => navigate(child.id)}><span>{child.label}</span></button>)}</div>}</div> : <button key={id} className={view === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span>{id === 'followups' && openFollowupCount > 0 && <b className="nav-badge">{openFollowupCount}</b>}</button> })}</nav><div className="sidebar-bottom"><div className="powered-by"><span>Powered by:</span><img src="/schoemans-digital-solutions-logo.jpg" alt="Schoemans Digital Solutions" /></div><div className={`sync-state ${syncState}`}><span />{syncState === 'connected' ? 'Supabase connected' : syncState === 'connecting' ? 'Connecting to Supabase…' : syncState === 'error' ? 'Supabase unavailable' : 'Local demo mode'}</div>{demoMode && canManage && <button onClick={reset}><RefreshCcw size={17} /> Reset demo data</button>}<div className="profile-menu-wrap">{profileMenu && <div className="profile-menu"><button onClick={() => navigate('settings')}><Settings size={16} /><span><strong>Account settings</strong><small>Profile and security</small></span></button><button onClick={() => navigate('data')}><Database size={16} /><span><strong>Data management</strong><small>Exports and templates</small></span></button>{canManage && <button onClick={() => navigate('governance')}><ShieldCheck size={16} /><span><strong>Governance</strong><small>Roles and audit trail</small></span></button>}<button className="profile-signout" onClick={onSignOut}><LogOut size={16} /><span><strong>Sign out</strong><small>End this session</small></span></button></div>}<div className={`user-card ${profileMenu ? 'menu-open' : ''}`}><Avatar name={profile.full_name} color="#d9a451" src={profile.avatar_url} /><div><strong>{profile.full_name}</strong><small>{profile.role}</small></div><button className="profile-menu-trigger" onClick={() => setProfileMenu((open) => !open)} aria-label="Open account menu" aria-expanded={profileMenu}><MoreHorizontal size={19} /></button></div></div></div></aside>
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <main><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu /></button><div className="global-search"><Search size={18} /><input value={query} onFocus={() => setSearchOpen(true)} onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }} placeholder="Search companies, contacts, contracts…" /><kbd>⌘ K</kbd>{searchOpen && <GlobalSearchResults query={query} data={data} documents={documents} companyById={companyById} onNavigate={navigate} onCompany={openCompany} />}</div><div className="notification-wrap"><button className="notification-trigger" onClick={() => { setNotificationOpen((open) => !open); setSearchOpen(false) }} aria-label={`${unreadNotificationCount} unread reminders`}><Bell size={19} />{unreadNotificationCount > 0 && <b>{unreadNotificationCount}</b>}</button>{notificationOpen && <section className="notification-menu"><div><span><strong>Follow-up reminders</strong><small>{reminderNotifications.length} due or coming up</small></span>{unreadNotificationCount > 0 && <button onClick={markNotificationsRead}>Mark all read</button>}</div>{reminderNotifications.map((item) => { const overdue = item.dueDate < today; return <button className={readNotifications.has(item.id) ? 'read' : ''} key={item.id} onClick={() => { markNotificationsRead(); setNotificationOpen(false); navigate('followups') }}><span className={overdue ? 'overdue' : ''}><Bell size={14} /></span><div><strong>{item.title}</strong><small>{companyById[item.companyId]?.name} · {overdue ? `Overdue since ${formatDate(item.dueDate)}` : `Due ${formatDate(item.dueDate)}`}</small></div></button> })}{!reminderNotifications.length && <div className="notification-empty"><Check size={18} /><span><strong>You’re up to date</strong><small>No follow-ups are due in the next three days.</small></span></div>}</section>}</div><button className="top-avatar" title={profile.full_name}><Avatar name={profile.full_name} color="#d9a451" src={profile.avatar_url} /></button></header>
      <div className="content">{view !== 'company' && view !== 'dashboard' && <div className="page-heading"><div><span className="eyebrow">ContractConnect CRM</span><h1>{activeTitle[0]}</h1><p>{activeTitle[1]}</p></div>{canWrite && !['settings', 'data', 'reports', 'governance', 'partners', 'slas'].includes(view) && <button className="btn primary" onClick={() => openCreate(view === 'companies' ? 'company' : view === 'contacts' ? 'contact' : view === 'contracts' ? 'contract' : view === 'documents' ? 'document' : view === 'followups' ? 'followup' : 'interaction')}><Plus size={17} /> {view === 'companies' ? 'Add company' : view === 'contacts' ? 'Add contact' : view === 'contracts' ? 'Add contract' : view === 'documents' ? 'Upload document' : view === 'followups' ? 'Add follow-up' : 'Log interaction'}</button>}</div>}
        {view === 'dashboard' && <Dashboard data={data} companyById={companyById} userName={profile.full_name} outlook={outlook} weeklyMeetings={weeklyMeetings} meetingsLoading={meetingsLoading} meetingsError={meetingsError} meetingsLastUpdated={meetingsLastUpdated} onRefreshMeetings={() => refreshOutlookCalendar(outlook)} setView={setView} openCompany={openCompany} openAddInteraction={() => openCreate('interaction')} openAddFollowup={() => openCreate('followup')} onToggleFollowup={toggleFollowup} />}
        {view === 'dashboard' && <OutlookEmailPanel outlook={outlook} messages={outlookEmails} loading={emailsLoading} error={emailsError} lastUpdated={emailsLastUpdated} onRefresh={() => refreshOutlookEmails(outlook)} onOpenSettings={() => setView('settings')} />}
        {view === 'companies' && <Companies {...data} query={query} openCompany={openCompany} financialYear={businessData.financialYear} onSaveFinancialYear={updateFinancialYear} />}
        {view === 'partners' && <Partners query={query} canWrite={canWrite} companies={data.companies} businessData={businessData} onRefresh={reloadBusinessData} />}
        {view === 'contacts' && <Contacts data={data} companyById={companyById} query={query} onEdit={(item) => openEdit('contact', item)} onDelete={removeEntity} />}
        {view === 'contracts' && <Contracts data={data} companyById={companyById} query={query} onEdit={(item) => openEdit('contract', item)} onDelete={removeEntity} />}
        {view === 'slas' && <ServiceLevelAgreements contracts={data.contracts} companyById={companyById} query={query} canWrite={canWrite} slas={businessData.slas} onRefresh={reloadBusinessData} />}
        {view === 'documents' && <>{outlook.sharepoint && <div className="calendar-refresh-actions"><span className="calendar-connected"><span /> SharePoint read-only</span><button className="btn secondary" disabled={sharePointLoading} onClick={() => refreshSharePoint(outlook)}><RefreshCcw size={14} className={sharePointLoading ? 'spin' : ''} /> {sharePointLoading ? 'Refreshing…' : 'Refresh SharePoint'}</button></div>}{sharePointError && <div className="calendar-sync-warning" role="status"><strong>SharePoint refresh failed.</strong> {sharePointError}</div>}<Documents documents={visibleDocuments} contracts={data.contracts} companyById={companyById} query={query} onOpen={(doc) => doc.source === 'SharePoint' ? window.open(doc.webUrl, '_blank', 'noopener,noreferrer') : openContractDocument(doc).catch((error) => alert(error.message))} onDelete={removeDocument} /></>}
        {view === 'interactions' && <Interactions data={data} companyById={companyById} contactById={contactById} query={query} onEdit={(item) => openEdit('interaction', item)} onDelete={removeEntity} />}
        {view === 'followups' && <Followups data={data} companyById={companyById} contactById={contactById} query={query} onToggle={toggleFollowup} onEdit={(item) => openEdit('followup', item)} onDelete={removeEntity} />}
        {view === 'settings' && <AccountSettings profile={profile} email={session.user.email} userId={session.user.id} theme={theme} outlook={outlook} onOutlookChanged={reloadOutlook} onThemeChange={onThemeChange} onUpdated={onProfileUpdated} />}
        {view === 'data' && <DataManagement data={data} companyById={companyById} contactById={contactById} />}
        {view === 'reports' && <Reports data={data} companyById={companyById} />}
        {view === 'governance' && canManage && <Governance currentUserId={session.user.id} canAdminister={canAdminister} />}
        {view === 'company' && companyById[selectedCompany] && <CompanyDetail company={companyById[selectedCompany]} data={data} onBack={() => navigate('companies')} openAddInteraction={() => openCreate('interaction')} onEdit={(item) => openEdit('company', item)} onDelete={removeEntity} />}
      </div>
    </main>
    {modal === 'company' && <Modal title={editing ? 'Edit company' : 'Add a company'} onClose={() => { setModal(null); setEditing(null) }}><CompanyForm initial={editing} onSave={(item) => saveEntity('companies', item)} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
    {modal === 'contact' && <Modal title={editing ? 'Edit contact' : 'Add a contact'} onClose={() => { setModal(null); setEditing(null) }}><ContactForm companies={data.companies} initial={editing} onSave={(item) => saveEntity('contacts', item)} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
    {modal === 'contract' && <Modal title={editing ? 'Edit contract' : 'Add a contract'} onClose={() => { setModal(null); setEditing(null) }}><ContractForm companies={data.companies} initial={editing} onSave={(item) => saveEntity('contracts', item)} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
    {modal === 'interaction' && <Modal title={editing ? 'Edit interaction' : 'Log an interaction'} onClose={() => { setModal(null); setEditing(null) }}><InteractionForm companies={data.companies} contacts={data.contacts} initial={editing} onSave={saveInteractionWithRule} onClose={() => { setModal(null); setEditing(null) }} /></Modal>}
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
