-- Production hardening for automated follow-up email reminders.
-- Run after supabase-followup-notifications-migration.sql.

alter table public.followups
  add column if not exists email_reminder_attempt_count integer not null default 0,
  add column if not exists email_reminder_next_attempt_at timestamptz,
  add column if not exists email_reminder_lease_token uuid,
  add column if not exists email_reminder_lease_until timestamptz,
  add column if not exists email_reminder_provider_id text;

alter table public.followups
  drop constraint if exists followups_email_reminder_attempt_count_check;
alter table public.followups
  add constraint followups_email_reminder_attempt_count_check
  check (email_reminder_attempt_count between 0 and 5);

drop index if exists public.followups_pending_email_idx;
create index followups_pending_email_idx
  on public.followups (email_reminder_next_attempt_at, due_date)
  where completed = false
    and email_reminder_sent_at is null
    and assigned_to is not null
    and email_reminder_attempt_count < 5;

create or replace function public.claim_due_followup_email_reminders(
  p_today date,
  p_limit integer default 100,
  p_lease_minutes integer default 10
)
returns table (
  id text,
  title text,
  due_date date,
  assigned_to uuid,
  company_name text,
  lease_token uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 100 or p_lease_minutes < 1 or p_lease_minutes > 30 then
    raise exception 'Invalid claim limits' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select f.id
    from public.followups f
    join public.profiles p on p.id = f.assigned_to and p.is_active = true
    where f.completed = false
      and f.due_date <= p_today
      and f.email_reminder_sent_at is null
      and f.assigned_to is not null
      and f.email_reminder_attempt_count < 5
      and coalesce(f.email_reminder_next_attempt_at, '-infinity'::timestamptz) <= now()
      and coalesce(f.email_reminder_lease_until, '-infinity'::timestamptz) <= now()
    order by f.due_date, f.id
    for update of f skip locked
    limit p_limit
  ), claimed as (
    update public.followups f
    set email_reminder_lease_token = gen_random_uuid(),
        email_reminder_lease_until = now() + make_interval(mins => p_lease_minutes),
        email_reminder_attempt_count = f.email_reminder_attempt_count + 1,
        email_reminder_error = null
    from candidates c
    where f.id = c.id
    returning f.*
  )
  select c.id, c.title, c.due_date, c.assigned_to, co.name,
         c.email_reminder_lease_token, c.email_reminder_attempt_count
  from claimed c
  left join public.companies co on co.id = c.company_id;
end;
$$;

revoke all on function public.claim_due_followup_email_reminders(date, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_due_followup_email_reminders(date, integer, integer) to service_role;

comment on function public.claim_due_followup_email_reminders(date, integer, integer) is
  'Atomically leases due reminders to the service role so concurrent workers cannot send duplicates.';
comment on column public.followups.email_reminder_sent_at is
  'Timestamp when the email provider accepted the reminder. This does not prove inbox delivery.';
comment on column public.followups.email_reminder_provider_id is
  'Provider message identifier used for operational tracing; message content is not stored.';

