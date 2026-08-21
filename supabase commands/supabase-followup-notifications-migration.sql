-- ContractConnect follow-up notification ownership and email delivery state.
-- Run once in the Supabase SQL Editor before deploying send-followup-reminders.

alter table public.followups
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists email_reminder_sent_at timestamptz,
  add column if not exists email_reminder_error text;

alter table public.followups
  alter column assigned_to set default auth.uid();

create index if not exists followups_pending_email_idx
  on public.followups (due_date, assigned_to)
  where completed = false and email_reminder_sent_at is null;

comment on column public.followups.assigned_to is
  'ContractConnect user responsible for completing and receiving reminders for this follow-up.';
comment on column public.followups.email_reminder_sent_at is
  'Set only after the email provider accepts the reminder, preventing duplicate delivery.';

-- Existing rows remain unassigned because ownership cannot be inferred safely.
-- Assign them explicitly after reviewing the responsible user, for example:
-- update public.followups set assigned_to = '<auth-user-uuid>'
-- where assigned_to is null and completed = false;
