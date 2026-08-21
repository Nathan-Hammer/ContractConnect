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
  const today = new Date().toISOString().slice(0, 10)
  const { data: followups, error } = await admin
    .from('followups')
    .select('id,title,due_date,assigned_to,companies(name)')
    .eq('completed', false)
    .lte('due_date', today)
    .is('email_reminder_sent_at', null)
    .not('assigned_to', 'is', null)
    .limit(100)

  if (error) return json({ error: error.message }, 500)

  let sent = 0
  const failures: Array<{ id: string; error: string }> = []
  for (const followup of followups || []) {
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(followup.assigned_to)
      if (userError || !userData.user?.email) throw new Error(userError?.message || 'Assigned user has no email address')

      const company = Array.isArray(followup.companies) ? followup.companies[0]?.name : followup.companies?.name
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
            `Client: ${company || 'Not specified'}`,
            `Due date: ${followup.due_date}`,
            '',
            `Open ContractConnect: ${appUrl}`,
          ].join('\n'),
        }),
      })
      if (!delivery.ok) throw new Error(`Email provider returned ${delivery.status}: ${await delivery.text()}`)

      const { error: updateError } = await admin.from('followups').update({
        email_reminder_sent_at: new Date().toISOString(),
        email_reminder_error: null,
      }).eq('id', followup.id).is('email_reminder_sent_at', null)
      if (updateError) throw updateError
      sent += 1
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Unknown delivery error'
      failures.push({ id: followup.id, error: message })
      await admin.from('followups').update({ email_reminder_error: message.slice(0, 1000) }).eq('id', followup.id)
    }
  }

  return json({ processed: followups?.length || 0, sent, failures })
})
