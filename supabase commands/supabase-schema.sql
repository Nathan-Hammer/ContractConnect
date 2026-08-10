-- ContractConnect initial database schema
-- Run this file in the Supabase SQL Editor.

create table if not exists public.companies (
  id text primary key,
  name text not null,
  industry text not null,
  location text not null,
  status text not null check (status in ('Active', 'Prospect', 'Renewal due', 'Inactive')),
  website text,
  phone text,
  owner text not null,
  initials text not null,
  color text not null default '#498f81',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'Account Manager',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.contacts (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  role text not null,
  email text not null,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  title text not null,
  value numeric(14, 2) not null default 0 check (value >= 0),
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('Draft', 'Active', 'Expiring soon', 'Expired', 'Terminated')),
  created_at timestamptz not null default now(),
  constraint contract_dates_valid check (end_date >= start_date)
);

create table if not exists public.interactions (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  contact_id text references public.contacts(id) on delete set null,
  type text not null check (type in ('Call', 'Meeting', 'Email', 'Note')),
  interaction_date date not null default current_date,
  summary text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists contacts_company_id_idx on public.contacts(company_id);
create index if not exists contracts_company_id_idx on public.contracts(company_id);
create index if not exists contracts_end_date_idx on public.contracts(end_date);
create index if not exists interactions_company_id_idx on public.interactions(company_id);
create index if not exists interactions_date_idx on public.interactions(interaction_date desc);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.contracts enable row level security;
alter table public.interactions enable row level security;

-- CRM data is available only to signed-in users. Authentication UI is the next setup phase.
create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Authenticated users manage companies" on public.companies for all to authenticated using (true) with check (true);
create policy "Authenticated users manage contacts" on public.contacts for all to authenticated using (true) with check (true);
create policy "Authenticated users manage contracts" on public.contracts for all to authenticated using (true) with check (true);
create policy "Authenticated users manage interactions" on public.interactions for all to authenticated using (true) with check (true);
