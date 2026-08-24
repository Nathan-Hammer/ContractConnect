import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { authenticate, corsHeaders, getValidAccessToken, json, provider } from '../_shared/outlook.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { admin, user } = await authenticate(request)
    const { action = 'status', start, end } = await request.json().catch(() => ({}))
    if (action === 'status') {
      const { data } = await admin.from('integration_connections').select('status,email_enabled,calendar_enabled,sharepoint_enabled,provider_email,last_success_at,last_error').eq('user_id', user.id).eq('provider', provider).maybeSingle()
      return json({ connection: data || { status: 'disconnected', email_enabled: false, calendar_enabled: false, sharepoint_enabled: false } })
    }
    if (action === 'disconnect') {
      await admin.from('integration_credentials').delete().eq('user_id', user.id).eq('provider', provider)
      await admin.from('integration_connections').upsert({ user_id: user.id, provider, status: 'disconnected', email_enabled: false, calendar_enabled: false, sharepoint_enabled: false, granted_scopes: [], provider_account_id: null, provider_email: null, last_error: null, updated_at: new Date().toISOString() })
      return json({ disconnected: true })
    }
    const { data: connection } = await admin.from('integration_connections').select('*').eq('user_id', user.id).eq('provider', provider).single()
    if (action === 'sharepoint') {
      if (!connection?.sharepoint_enabled || connection.status !== 'connected') return json({ error: 'SharePoint is not connected' }, 409)
      const accessToken = await getValidAccessToken(admin, user.id)
      const graphHeaders = { authorization: `Bearer ${accessToken}` }
      const siteHost = Deno.env.get('SHAREPOINT_SITE_HOST') || 'schoemans.sharepoint.com'
      const sitePath = Deno.env.get('SHAREPOINT_SITE_PATH') || '/sites/DigitalSolutions'
      const driveName = Deno.env.get('SHAREPOINT_DRIVE_NAME') || 'Digidocs'
      const folderPath = Deno.env.get('SHAREPOINT_FOLDER_PATH') || 'Project Contracts'
      const siteResponse = await fetch(`https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteHost)}:${sitePath}?$select=id`, { headers: graphHeaders })
      if (!siteResponse.ok) throw new Error(`Microsoft SharePoint site lookup failed (${siteResponse.status})`)
      const site = await siteResponse.json()
      const drivesResponse = await fetch(`https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(site.id)}/drives?$select=id,name,webUrl`, { headers: graphHeaders })
      if (!drivesResponse.ok) throw new Error(`Microsoft SharePoint library lookup failed (${drivesResponse.status})`)
      const drives = await drivesResponse.json()
      const drive = (drives.value || []).find((item: Record<string, unknown>) => String(item.name).toLowerCase() === driveName.toLowerCase())
      if (!drive) return json({ error: `SharePoint library '${driveName}' was not found` }, 404)
      let nextUrl: string | null = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(drive.id)}/root:/${folderPath.split('/').map(encodeURIComponent).join('/') }:/children?$select=id,name,size,file,folder,webUrl,createdDateTime,lastModifiedDateTime,parentReference&$top=200`
      const items: Array<Record<string, unknown>> = []
      while (nextUrl && items.length < 500) {
        const response = await fetch(nextUrl, { headers: graphHeaders })
        if (response.status === 429) return json({ error: 'Microsoft is temporarily limiting SharePoint requests.', retryAfterSeconds: Math.max(1, Number(response.headers.get('retry-after')) || 60) }, 429)
        if (!response.ok) throw new Error(`Microsoft SharePoint folder request failed (${response.status})`)
        const page = await response.json()
        items.push(...(page.value || []))
        nextUrl = page['@odata.nextLink'] || null
      }
      await admin.from('integration_connections').update({ last_success_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('provider', provider)
      return json({ documents: items.filter((item) => item.file).slice(0, 500).map((item) => ({ id: item.id, name: item.name, size: item.size, mimeType: (item.file as Record<string, unknown>)?.mimeType, webUrl: item.webUrl, createdAt: item.createdDateTime, modifiedAt: item.lastModifiedDateTime })) })
    }
    if (action === 'email') {
      if (!connection?.email_enabled || connection.status !== 'connected') return json({ error: 'Outlook Email is not connected' }, 409)
      const { data: contacts, error: contactError } = await admin.from('contacts').select('email')
      if (contactError) throw contactError
      const knownEmails = new Set((contacts || []).map((contact) => String(contact.email || '').trim().toLowerCase()).filter(Boolean))
      if (!knownEmails.size) return json({ messages: [] })
      const accessToken = await getValidAccessToken(admin, user.id)
      const select = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink,isRead,hasAttachments'
      const mailboxUrls = ['inbox', 'sentitems'].map((folder) => {
        const url = new URL(`https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages`)
        url.search = new URLSearchParams({ '$select': select, '$orderby': folder === 'inbox' ? 'receivedDateTime desc' : 'sentDateTime desc', '$top': '50' }).toString()
        return url
      })
      const responses = await Promise.all(mailboxUrls.map((url) => fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })))
      const throttled = responses.find((response) => response.status === 429)
      if (throttled) {
        const retryAfter = Math.max(1, Number(throttled.headers.get('retry-after')) || 60)
        return json({ error: 'Microsoft is temporarily limiting email requests.', retryAfterSeconds: retryAfter }, 429, { 'retry-after': String(retryAfter) })
      }
      const failed = responses.find((response) => !response.ok)
      if (failed) throw new Error(`Microsoft email request failed (${failed.status})`)
      const [inbox, sent] = await Promise.all(responses.map((response) => response.json()))
      const address = (recipient: Record<string, unknown> | null | undefined) => String((recipient?.emailAddress as Record<string, unknown> | undefined)?.address || '').toLowerCase()
      const matched = [...(inbox.value || []).map((message: Record<string, unknown>) => ({ ...message, direction: 'Received' })), ...(sent.value || []).map((message: Record<string, unknown>) => ({ ...message, direction: 'Sent' }))]
        .filter((message: Record<string, unknown>) => {
          const participants = [address(message.from as Record<string, unknown>), ...((message.toRecipients as Array<Record<string, unknown>>) || []).map(address), ...((message.ccRecipients as Array<Record<string, unknown>>) || []).map(address)]
          return participants.some((email) => knownEmails.has(email))
        })
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => String(b.receivedDateTime || b.sentDateTime).localeCompare(String(a.receivedDateTime || a.sentDateTime)))
        .slice(0, 20)
        .map((message: Record<string, unknown>) => ({
          id: message.id,
          subject: message.subject,
          direction: message.direction,
          contactParticipants: [message.from as Record<string, unknown>, ...((message.toRecipients as Array<Record<string, unknown>>) || []), ...((message.ccRecipients as Array<Record<string, unknown>>) || [])]
            .filter((recipient) => knownEmails.has(address(recipient)))
            .map((recipient) => ({ name: (recipient.emailAddress as Record<string, unknown>)?.name || '', address: address(recipient) })),
          receivedDateTime: message.receivedDateTime,
          sentDateTime: message.sentDateTime,
          bodyPreview: message.bodyPreview,
          webLink: message.webLink,
          isRead: message.isRead,
          hasAttachments: message.hasAttachments,
        }))
      await admin.from('integration_connections').update({ last_success_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('provider', provider)
      return json({ messages: matched })
    }
    if (action !== 'calendar') return json({ error: 'Unsupported action' }, 400)
    if (!connection?.calendar_enabled || connection.status !== 'connected') return json({ error: 'Outlook Calendar is not connected' }, 409)
    const startDate = new Date(start); const endDate = new Date(end)
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate || endDate.getTime() - startDate.getTime() > 32 * 86400000) return json({ error: 'Invalid calendar range' }, 400)
    const graph = new URL('https://graph.microsoft.com/v1.0/me/calendarView')
    graph.search = new URLSearchParams({ startDateTime: startDate.toISOString(), endDateTime: endDate.toISOString(), '$select': 'id,subject,start,end,location,attendees,webLink,isCancelled', '$orderby': 'start/dateTime', '$top': '100' }).toString()
    const response = await fetch(graph, { headers: { authorization: `Bearer ${await getValidAccessToken(admin, user.id)}`, prefer: 'outlook.timezone="UTC"' } })
    if (!response.ok) {
      const detail = await response.text()
      const retryAfter = response.status === 429 ? Math.max(1, Number(response.headers.get('retry-after')) || 60) : null
      await admin.from('integration_connections').update({ status: response.status === 401 ? 'error' : 'connected', last_error: `Graph ${response.status}: ${detail}`.slice(0,1000), updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('provider', provider)
      if (retryAfter) return json({ error: 'Microsoft is temporarily limiting calendar requests.', retryAfterSeconds: retryAfter }, 429, { 'retry-after': String(retryAfter) })
      throw new Error(`Microsoft calendar request failed (${response.status})`)
    }
    const body = await response.json()
    await admin.from('integration_connections').update({ last_success_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('provider', provider)
    return json({ events: (body.value || []).filter((event: Record<string, unknown>) => !event.isCancelled) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outlook request failed'
    console.error('outlook_api_failed', message)
    return json({ error: message }, 400)
  }
})
