-- ContractConnect roles, ownership, audit trail, and restricted documents
-- Run only after the contract lifecycle and document migrations.

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'Contributor' where role not in ('Administrator', 'Manager', 'Contributor', 'Read-only');
with first_user as (select id from public.profiles order by created_at limit 1)
update public.profiles set role = 'Administrator' where id in (select id from first_user);
alter table public.profiles add constraint profiles_role_check check (role in ('Administrator', 'Manager', 'Contributor', 'Read-only'));

alter table public.companies add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.contracts add column if not exists owner_id uuid references public.profiles(id) on delete set null;
update public.companies set owner_id = (select id from public.profiles order by created_at limit 1) where owner_id is null;
update public.contracts set owner_id = (select id from public.profiles order by created_at limit 1) where owner_id is null;
alter table public.contract_documents add column if not exists access_level text not null default 'All team'
  check (access_level in ('All team', 'Managers only'));

create or replace function public.current_app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and public.current_app_role() <> 'Administrator' then
    raise exception 'Only administrators may change user roles';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role_change on public.profiles;
create trigger protect_profile_role_change before update on public.profiles
for each row execute function public.protect_profile_role();

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null,
  changed_by uuid references auth.users(id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
alter table public.audit_logs enable row level security;
drop policy if exists "Managers view audit logs" on public.audit_logs;
create policy "Managers view audit logs" on public.audit_logs for select to authenticated
using (public.current_app_role() in ('Administrator', 'Manager'));

create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(table_name, record_id, action, changed_by, old_data, new_data)
  values (tg_table_name, coalesce(new.id::text, old.id::text), tg_op, auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$ declare t text; begin
  foreach t in array array['companies','contacts','contracts','interactions','followups','contract_documents'] loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.write_audit_log()', t, t);
  end loop;
end $$;

-- Replace broad write policies with role-aware policies.
drop policy if exists "Authenticated users manage companies" on public.companies;
drop policy if exists "Authenticated users manage contacts" on public.contacts;
drop policy if exists "Authenticated users manage contracts" on public.contracts;
drop policy if exists "Authenticated users manage interactions" on public.interactions;
drop policy if exists "Authenticated users manage followups" on public.followups;
drop policy if exists "Authenticated users manage contract documents" on public.contract_documents;

do $$ declare t text; begin
  foreach t in array array['companies','contacts','contracts','interactions','followups'] loop
    execute format('create policy "Team reads %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "Contributors write %1$s" on public.%1$I for all to authenticated using (public.current_app_role() in (''Administrator'',''Manager'',''Contributor'')) with check (public.current_app_role() in (''Administrator'',''Manager'',''Contributor''))', t);
  end loop;
end $$;

create policy "Role-based document reads" on public.contract_documents for select to authenticated
using (access_level = 'All team' or public.current_app_role() in ('Administrator', 'Manager'));
create policy "Contributors write documents" on public.contract_documents for all to authenticated
using (public.current_app_role() in ('Administrator','Manager','Contributor'))
with check (public.current_app_role() in ('Administrator','Manager','Contributor'));

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Administrators manage profiles" on public.profiles;
create policy "Administrators manage profiles" on public.profiles for update to authenticated
using (public.current_app_role() = 'Administrator') with check (public.current_app_role() = 'Administrator');

-- Storage paths begin with all/ or restricted/.
drop policy if exists "Authenticated users read contract files" on storage.objects;
drop policy if exists "Authenticated users upload contract files" on storage.objects;
drop policy if exists "Authenticated users delete contract files" on storage.objects;
create policy "Role-based contract file reads" on storage.objects for select to authenticated using (
  bucket_id = 'contract-documents' and ((storage.foldername(name))[1] = 'all' or public.current_app_role() in ('Administrator','Manager'))
);
create policy "Contributors upload contract files" on storage.objects for insert to authenticated with check (
  bucket_id = 'contract-documents' and public.current_app_role() in ('Administrator','Manager','Contributor')
);
create policy "Contributors delete contract files" on storage.objects for delete to authenticated using (
  bucket_id = 'contract-documents' and public.current_app_role() in ('Administrator','Manager','Contributor')
);
