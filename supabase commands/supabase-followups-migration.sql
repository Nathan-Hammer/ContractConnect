-- ContractConnect follow-up task migration
-- Run this file in the Supabase SQL Editor.

create table if not exists public.followups (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  contact_id text references public.contacts(id) on delete set null,
  title text not null,
  due_date date not null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists followups_due_date_idx on public.followups(due_date);
create index if not exists followups_company_id_idx on public.followups(company_id);
alter table public.followups enable row level security;
drop policy if exists "Authenticated users manage followups" on public.followups;
create policy "Authenticated users manage followups" on public.followups
for all to authenticated using (true) with check (true);
