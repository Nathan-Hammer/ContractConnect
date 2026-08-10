-- ContractConnect production security hardening
-- Run after all previous ContractConnect migrations.
-- This migration makes new accounts inactive until an administrator approves them.

alter table public.profiles add column if not exists is_active boolean not null default false;

-- Preserve access for users that existed before this approval workflow.
update public.profiles set is_active = true where is_active = false;
update public.profiles set role = 'Contributor' where role = 'Account Manager';
alter table public.profiles alter column role set default 'Read-only';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'Read-only',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.current_app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active = true)
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_active_member() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_member() to authenticated;

create or replace function public.protect_profile_security_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and public.current_app_role() <> 'Administrator' then
    raise exception 'Only administrators may change roles or workspace access';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_change on public.profiles;
drop trigger if exists protect_profile_security_change on public.profiles;
create trigger protect_profile_security_change before update on public.profiles
for each row execute function public.protect_profile_security_fields();

-- Users can see their own approval state. Administrators and managers can list the team.
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Team managers read profiles" on public.profiles;
create policy "Users and managers read profiles" on public.profiles for select to authenticated
using (auth.uid() = id or public.current_app_role() in ('Administrator', 'Manager'));

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Administrators manage profiles" on public.profiles;
create policy "Administrators manage profiles" on public.profiles for update to authenticated
using (public.current_app_role() = 'Administrator')
with check (public.current_app_role() = 'Administrator');

-- Replace CRM policies so inactive identities cannot access workspace data.
do $$ declare t text; begin
  foreach t in array array['companies','contacts','contracts','interactions','followups'] loop
    execute format('drop policy if exists "Team reads %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Contributors write %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Authenticated users manage %1$s" on public.%1$I', t);
    execute format('create policy "Active team reads %1$s" on public.%1$I for select to authenticated using (public.is_active_member())', t);
    execute format('create policy "Active contributors write %1$s" on public.%1$I for all to authenticated using (public.current_app_role() in (''Administrator'',''Manager'',''Contributor'')) with check (public.current_app_role() in (''Administrator'',''Manager'',''Contributor''))', t);
  end loop;
end $$;

drop policy if exists "Role-based document reads" on public.contract_documents;
drop policy if exists "Contributors write documents" on public.contract_documents;
drop policy if exists "Authenticated users manage contract documents" on public.contract_documents;
create policy "Active role-based document reads" on public.contract_documents for select to authenticated
using (public.is_active_member() and (access_level = 'All team' or public.current_app_role() in ('Administrator', 'Manager')));
create policy "Active contributors write documents" on public.contract_documents for all to authenticated
using (public.current_app_role() in ('Administrator','Manager','Contributor'))
with check (public.current_app_role() in ('Administrator','Manager','Contributor'));

drop policy if exists "Role-based contract file reads" on storage.objects;
drop policy if exists "Contributors upload contract files" on storage.objects;
drop policy if exists "Contributors delete contract files" on storage.objects;
drop policy if exists "Authenticated users read contract files" on storage.objects;
drop policy if exists "Authenticated users upload contract files" on storage.objects;
drop policy if exists "Authenticated users delete contract files" on storage.objects;
create policy "Active role-based contract file reads" on storage.objects for select to authenticated using (
  bucket_id = 'contract-documents'
  and public.is_active_member()
  and ((storage.foldername(name))[1] = 'all' or public.current_app_role() in ('Administrator','Manager'))
);
create policy "Active contributors upload contract files" on storage.objects for insert to authenticated with check (
  bucket_id = 'contract-documents' and public.current_app_role() in ('Administrator','Manager','Contributor')
);
create policy "Active contributors delete contract files" on storage.objects for delete to authenticated using (
  bucket_id = 'contract-documents' and public.current_app_role() in ('Administrator','Manager','Contributor')
);

-- Runtime security telemetry. Clients may insert only events attributed to themselves.
create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 100),
  severity text not null default 'warning' check (severity in ('info','warning','high','critical')),
  context jsonb not null default '{}'::jsonb,
  page_path text,
  created_at timestamptz not null default now()
);
create index if not exists security_events_created_idx on public.security_events(created_at desc);
create index if not exists security_events_severity_idx on public.security_events(severity, created_at desc);
alter table public.security_events enable row level security;
drop policy if exists "Users record own security events" on public.security_events;
drop policy if exists "Managers read security events" on public.security_events;
create policy "Users record own security events" on public.security_events for insert to authenticated
with check (actor_id = auth.uid());
create policy "Managers read security events" on public.security_events for select to authenticated
using (public.current_app_role() in ('Administrator','Manager'));

-- Include approval changes and security events in the existing audit trail.
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after update on public.profiles
for each row execute function public.write_audit_log();

comment on table public.security_events is 'Sanitised client runtime security telemetry; no passwords, tokens, or full URLs.';

