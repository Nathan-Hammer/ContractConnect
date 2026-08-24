-- ContractConnect Microsoft Outlook delegated integration.
-- Run after supabase-production-business-data-migration.sql.

create table if not exists public.integration_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('microsoft_outlook')),
  status text not null default 'disconnected' check (status in ('connected','disconnected','error')),
  email_enabled boolean not null default false,
  calendar_enabled boolean not null default false,
  provider_account_id text,
  provider_email text,
  granted_scopes text[] not null default '{}',
  last_success_at timestamptz,
  last_error text,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- No RLS policies are created for credential/state tables. Only service-role Edge
-- Functions can access them; authenticated browser clients receive no rows.
create table if not exists public.integration_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  access_token_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider),
  foreign key (user_id, provider) references public.integration_connections(user_id, provider) on delete cascade
);

create table if not exists public.integration_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_code_verifier text not null,
  email_requested boolean not null default false,
  calendar_requested boolean not null default false,
  return_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists integration_oauth_states_expiry_idx on public.integration_oauth_states(expires_at);

alter table public.integration_connections enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.integration_oauth_states enable row level security;

drop policy if exists "Users read own integration metadata" on public.integration_connections;
create policy "Users read own integration metadata" on public.integration_connections for select to authenticated
using (public.is_active_member() and user_id = auth.uid());

create or replace function public.write_integration_connection_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_provider text := case when tg_op = 'DELETE' then old.provider else new.provider end;
begin
  insert into public.audit_logs(table_name, record_id, action, changed_by, old_data, new_data)
  values (
    tg_table_name,
    v_user_id::text || ':' || v_provider,
    tg_op,
    coalesce(auth.uid(), v_user_id),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists audit_integration_connections on public.integration_connections;
create trigger audit_integration_connections after insert or update or delete on public.integration_connections
for each row execute function public.write_integration_connection_audit();

comment on table public.integration_credentials is 'Encrypted OAuth credentials; service-role access only and intentionally excluded from audit JSON.';
comment on table public.integration_oauth_states is 'Short-lived, one-time OAuth state and encrypted PKCE verifier; service-role access only.';
