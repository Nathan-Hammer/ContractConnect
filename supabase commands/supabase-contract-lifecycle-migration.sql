-- ContractConnect contract lifecycle and renewal fields
-- Run in the Supabase SQL Editor.

alter table public.contracts add column if not exists renewal_notice_days integer not null default 60
  check (renewal_notice_days in (30, 60, 90, 120, 180));
alter table public.contracts add column if not exists auto_renew boolean not null default false;
alter table public.contracts add column if not exists termination_notice_date date;

create index if not exists contracts_termination_notice_idx
  on public.contracts(termination_notice_date) where termination_notice_date is not null;
