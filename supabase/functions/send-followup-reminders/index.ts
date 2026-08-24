import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const cronSecret = Deno.env.get('FOLLOWUP_CRON_SECRET')
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('REMINDER_FROM_EMAIL')
  const appUrl = Deno.env.get('CONTRACTCONNECT_APP_URL')
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail || !appUrl) {
    return json({ error: 'Reminder service is not configured' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Windhoek', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]))
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
  const { data: followups, error } = await admin.rpc('claim_due_followup_email_reminders', {
    p_today: today,
    p_limit: 100,
    p_lease_minutes: 10,
  })

  if (error) return json({ error: error.message }, 500)

  let sent = 0
  let failed = 0
  for (const followup of followups || []) {
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(followup.assigned_to)
      if (userError || !userData.user?.email) throw new Error(userError?.message || 'Assigned user has no email address')

      const delivery = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          'content-type': 'application/json',
          'idempotency-key': `followup-${followup.id}-${followup.due_date}`,
          'user-agent': 'ContractConnect/1.0',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [userData.user.email],
          subject: `ContractConnect follow-up due: ${followup.title}`,
          text: [
            `Your ContractConnect follow-up is due${followup.due_date < today ? ' and overdue' : ' today'}.`,
            '',
            `Follow-up: ${followup.title}`,
            `Client: ${followup.company_name || 'Not specified'}`,
            `Due date: ${followup.due_date}`,
            '',
            `Open ContractConnect: ${appUrl}`,
          ].join('\n'),
        }),
      })
      if (!delivery.ok) throw new Error(`Email provider returned HTTP ${delivery.status}`)
      const providerResult = await delivery.json() as { id?: string }
      if (!providerResult.id) throw new Error('Email provider did not return a message identifier')

      const { data: updated, error: updateError } = await admin.from('followups').update({
        email_reminder_sent_at: new Date().toISOString(),
        email_reminder_provider_id: providerResult.id,
        email_reminder_error: null,
        email_reminder_lease_token: null,
        email_reminder_lease_until: null,
        email_reminder_next_attempt_at: null,
      }).eq('id', followup.id)
        .eq('email_reminder_lease_token', followup.lease_token)
        .is('email_reminder_sent_at', null)
        .select('id')
        .maybeSingle()
      if (updateError) throw updateError
      if (!updated) throw new Error('Reminder lease expired before acceptance could be recorded')
      sent += 1
    } catch (sendError) {
      failed += 1
      const message = sendError instanceof Error ? sendError.message : 'Unknown delivery error'
      const terminal = followup.attempt_count >= 5
      const retryMinutes = Math.min(15 * (2 ** Math.max(followup.attempt_count - 1, 0)), 360)
      const nextAttempt = terminal ? null : new Date(Date.now() + retryMinutes * 60_000).toISOString()
      await admin.from('followups').update({
        email_reminder_error: message.slice(0, 300),
        email_reminder_next_attempt_at: nextAttempt,
        email_reminder_lease_token: null,
        email_reminder_lease_until: null,
      }).eq('id', followup.id).eq('email_reminder_lease_token', followup.lease_token)
    }
  }

  return json({ processed: followups?.length || 0, accepted: sent, failed })
})
