# Automated follow-up email notifications

## Production status

The worker is implemented with atomic leases, a maximum of five attempts, exponential retry delays, active-user validation, provider idempotency, and provider message-ID recording. `email_reminder_sent_at` means that Resend accepted the request; it does not prove delivery to the recipient's inbox.

Production verification remains incomplete until the deployment and acceptance checks below have been performed against the production Supabase project and verified sending domain.

## 1. Database migration

Run these files in order in the Supabase SQL Editor if the first migration has not already been applied:

1. `supabase commands/supabase-followup-notifications-migration.sql`
2. `supabase commands/supabase-followup-notifications-production-migration.sql`

Review and assign every open row where `assigned_to is null`. The system deliberately does not guess ownership for old records.

## 2. Email provider

In Resend, verify a dedicated sending subdomain and configure SPF and DKIM. Add DMARC through the organization's DNS change process. Create a narrowly scoped production API key and do not reuse a development key.

Set these Supabase Edge Function secrets:

```text
RESEND_API_KEY=<production Resend API key>
REMINDER_FROM_EMAIL=ContractConnect <reminders@verified-subdomain.example>
CONTRACTCONNECT_APP_URL=https://your-production-app.example
FOLLOWUP_CRON_SECRET=<at least 32 random bytes, encoded as hex or base64url>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by hosted Supabase. Never put the service-role key, Resend key, or cron secret in Vite variables, source control, browser code, or screenshots.

## 3. Deploy

From the repository root, with the Supabase CLI linked to the correct production project:

```powershell
npx supabase functions deploy send-followup-reminders --no-verify-jwt
```

The endpoint is intentionally not protected by a user JWT because it is called by a scheduler. It rejects every request that does not contain the independent `x-cron-secret` value.

## 4. Schedule securely

Enable the Supabase Cron and `pg_net` integrations. Store the project URL and the same cron secret in Supabase Vault; do not paste the secret directly into a cron job definition.

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'contractconnect_project_url');
select vault.create_secret('THE_SAME_FOLLOWUP_CRON_SECRET', 'contractconnect_followup_cron_secret');

select cron.schedule(
  'contractconnect-followup-email-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'contractconnect_project_url')
      || '/functions/v1/send-followup-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'contractconnect_followup_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
```

The worker uses the `Africa/Windhoek` calendar date and runs every 15 minutes so retries are not delayed until the following day. It only claims records that are due and eligible.

## 5. Acceptance test

Use a dedicated test user and client; do not alter a real client's engagement record merely to test notifications.

1. Confirm the user's profile is active and has a deliverable email address.
2. Create an incomplete follow-up assigned to that user with today's due date.
3. Run the Cron job once from the Supabase dashboard.
4. Confirm the function response reports `processed: 1`, `accepted: 1`, and `failed: 0`.
5. Confirm `email_reminder_sent_at` and `email_reminder_provider_id` are populated and the email appears in Resend logs.
6. Confirm the recipient receives the message and its link opens the production ContractConnect origin.
7. Run the job again and confirm it does not send a duplicate.
8. Temporarily use a controlled invalid recipient to verify retry counters and operational alerting, then remove the test record.
9. Inspect `cron.job_run_details`, Edge Function logs, and Resend logs. Logs must not contain secrets or message bodies.

## 6. Monitoring and incident handling

Monitor these conditions at least daily during the trial:

- Cron job failures or a job that has not run for 30 minutes.
- Edge Function non-2xx responses.
- Rows with `email_reminder_attempt_count = 5` and no `email_reminder_sent_at`.
- Resend bounces, complaints, and domain-verification changes.

Rotate `FOLLOWUP_CRON_SECRET` and `RESEND_API_KEY` immediately if exposed. Update both Edge Function secrets and Vault when rotating the cron secret.

For true delivery-state tracking, add a Resend webhook endpoint that verifies the provider signature and records delivered, bounced, and complained events. That webhook is not part of the current implementation, so operational staff must use Resend's dashboard for those states.
