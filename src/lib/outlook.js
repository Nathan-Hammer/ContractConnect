import { supabase } from './supabase'

const invoke = async (functionName, body) => {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    let serverMessage = data?.error
    let retryAfterSeconds = data?.retryAfterSeconds
    try {
      const response = error.context
      if (!serverMessage && response instanceof Response) {
        const payload = await response.clone().json()
        serverMessage = payload?.error
        retryAfterSeconds = payload?.retryAfterSeconds
      }
    } catch { /* Preserve the Supabase client error when the response is not JSON. */ }
    const failure = new Error(serverMessage || error.message)
    if (retryAfterSeconds) failure.retryAfterSeconds = Number(retryAfterSeconds)
    throw failure
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function getOutlookStatus() {
  const { connection } = await invoke('outlook-api', { action: 'status' })
  return { connected: connection.status === 'connected', status: connection.status, email: Boolean(connection.email_enabled), calendar: Boolean(connection.calendar_enabled), sharepoint: Boolean(connection.sharepoint_enabled), accountEmail: connection.provider_email || '', lastSuccessAt: connection.last_success_at || null, error: connection.last_error || '' }
}

export async function beginOutlookConnection({ email, calendar, sharepoint }) {
  const { authorizationUrl } = await invoke('outlook-oauth-start', { email, calendar, sharepoint, returnUrl: `${window.location.origin}${window.location.pathname}?view=settings` })
  window.location.assign(authorizationUrl)
}

export async function fetchSharePointDocuments() {
  const { documents } = await invoke('outlook-api', { action: 'sharepoint' })
  return documents.map((document) => ({ id: `sharepoint-${document.id}`, source: 'SharePoint', name: document.name, fileSize: Number(document.size || 0), mimeType: document.mimeType || '', createdAt: document.createdAt, modifiedAt: document.modifiedAt, webUrl: document.webUrl, category: 'Contract', accessLevel: 'SharePoint', version: '—', contractId: null }))
}

export async function disconnectOutlook() {
  await invoke('outlook-api', { action: 'disconnect' })
}

export async function fetchOutlookCalendar(start, end) {
  const { events } = await invoke('outlook-api', { action: 'calendar', start: start.toISOString(), end: end.toISOString() })
  const graphDate = (value) => new Date(value.timeZone === 'UTC' && !String(value.dateTime).endsWith('Z') ? `${value.dateTime}Z` : value.dateTime)
  return events.map((event) => ({ id: event.id, title: event.subject || '(No title)', start: graphDate(event.start), end: graphDate(event.end), location: event.location?.displayName || 'No location', attendees: event.attendees?.length || 0, webLink: event.webLink || '' }))
}

export async function fetchOutlookEmail() {
  const { messages } = await invoke('outlook-api', { action: 'email' })
  return messages.map((message) => ({
    id: message.id,
    subject: message.subject || '(No subject)',
    direction: message.direction,
    contacts: (message.contactParticipants || []).map((contact) => contact.name || contact.address).filter(Boolean),
    date: new Date(message.receivedDateTime || message.sentDateTime),
    preview: String(message.bodyPreview || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    webLink: message.webLink || '',
    isRead: Boolean(message.isRead),
    hasAttachments: Boolean(message.hasAttachments),
  }))
}
