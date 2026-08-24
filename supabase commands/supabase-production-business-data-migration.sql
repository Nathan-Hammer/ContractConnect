-- ContractConnect production persistence for financial years, partner targets,
-- partner sales, service-level agreements, and notification read state.
-- Run after supabase-security-hardening-migration.sql.

create extension if not exists pgcrypto;

create table if not exists public.financial_years (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_year_dates_valid check (end_date >= start_date),
  constraint financial_year_period_unique unique (start_date, end_date)
);
create unique index if not exists one_active_financial_year on public.financial_years(is_active) where is_active;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  product_category text not null check (char_length(trim(product_category)) between 1 and 250),
  owner_name text not null check (char_length(trim(owner_name)) between 1 and 160),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists partners_name_unique on public.partners(lower(name));

create table if not exists public.partner_targets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  financial_year_id uuid not null references public.financial_years(id) on delete restrict,
  target_amount numeric(15,2) not null check (target_amount > 0),
  opening_sales_amount numeric(15,2) not null default 0 check (opening_sales_amount >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_target_year_unique unique (partner_id, financial_year_id)
);

create table if not exists public.partner_sales (
  id uuid primary key default gen_random_uuid(),
  partner_target_id uuid not null references public.partner_targets(id) on delete restrict,
  company_id text references public.companies(id) on delete restrict,
  manual_client_name text,
  product text not null check (char_length(trim(product)) between 1 and 250),
  amount numeric(15,2) not null check (amount > 0),
  sale_date date not null,
  reference text check (reference is null or char_length(reference) <= 250),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint partner_sale_client_valid check (
    (company_id is not null and manual_client_name is null)
    or (company_id is null and char_length(trim(manual_client_name)) between 1 and 160)
  )
);
create index if not exists partner_sales_target_date_idx on public.partner_sales(partner_target_id, sale_date desc);

create table if not exists public.service_level_agreements (
  id uuid primary key default gen_random_uuid(),
  contract_id text not null references public.contracts(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  service text not null check (char_length(trim(service)) between 1 and 2000),
  availability_target numeric(5,2) not null check (availability_target between 0 and 100),
  response_hours numeric(10,2) not null check (response_hours >= 0),
  resolution_hours numeric(10,2) not null check (resolution_hours >= 0),
  start_date date not null,
  end_date date not null,
  review_frequency text not null check (review_frequency in ('Monthly','Quarterly','Biannual','Annual')),
  status text not null check (status in ('Draft','Active','Under review','Expired','Terminated')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sla_dates_valid check (end_date >= start_date)
);
create index if not exists sla_contract_idx on public.service_level_agreements(contract_id);

create table if not exists public.notification_reads (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  followup_id text not null references public.followups(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, followup_id)
);

alter table public.financial_years enable row level security;
alter table public.partners enable row level security;
alter table public.partner_targets enable row level security;
alter table public.partner_sales enable row level security;
alter table public.service_level_agreements enable row level security;
alter table public.notification_reads enable row level security;

do $$ declare t text; begin
  foreach t in array array['financial_years','partners','partner_targets','partner_sales','service_level_agreements'] loop
    execute format('drop policy if exists "Active team reads %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Active contributors write %1$s" on public.%1$I', t);
    execute format('create policy "Active team reads %1$s" on public.%1$I for select to authenticated using (public.is_active_member())', t);
    execute format('create policy "Active contributors write %1$s" on public.%1$I for all to authenticated using (public.current_app_role() in (''Administrator'',''Manager'',''Contributor'')) with check (public.current_app_role() in (''Administrator'',''Manager'',''Contributor''))', t);
  end loop;
end $$;

drop policy if exists "Users read own notification state" on public.notification_reads;
drop policy if exists "Users manage own notification state" on public.notification_reads;
create policy "Users read own notification state" on public.notification_reads for select to authenticated
using (public.is_active_member() and user_id = auth.uid());
create policy "Users manage own notification state" on public.notification_reads for all to authenticated
using (public.is_active_member() and user_id = auth.uid())
with check (public.is_active_member() and user_id = auth.uid());

create or replace function public.set_active_financial_year(p_start date, p_end date)
returns public.financial_years language plpgsql security invoker set search_path = public as $$
declare result public.financial_years;
begin
  if public.current_app_role() not in ('Administrator','Manager','Contributor') then raise exception 'Insufficient permission'; end if;
  if p_start is null or p_end is null or p_end < p_start then raise exception 'Invalid financial year'; end if;
  update public.financial_years set is_active = false, updated_at = now() where is_active;
  insert into public.financial_years(name, start_date, end_date, is_active)
  values ('FY ' || extract(year from p_start)::text || '/' || extract(year from p_end)::text, p_start, p_end, true)
  on conflict (start_date, end_date) do update set is_active = true, updated_at = now()
  returning * into result;
  return result;
end $$;

create or replace function public.save_partner_target(
  p_partner_id uuid, p_name text, p_product_category text, p_owner_name text,
  p_financial_year_id uuid, p_target_amount numeric, p_opening_sales_amount numeric
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_partner_id uuid;
begin
  if public.current_app_role() not in ('Administrator','Manager','Contributor') then raise exception 'Insufficient permission'; end if;
  if p_financial_year_id is null then raise exception 'An active financial year is required'; end if;
  if p_partner_id is null then
    insert into public.partners(name, product_category, owner_name)
    values (trim(p_name), trim(p_product_category), trim(p_owner_name)) returning id into v_partner_id;
  else
    update public.partners set name=trim(p_name), product_category=trim(p_product_category), owner_name=trim(p_owner_name), updated_at=now()
    where id=p_partner_id returning id into v_partner_id;
    if v_partner_id is null then raise exception 'Partner not found'; end if;
  end if;
  insert into public.partner_targets(partner_id, financial_year_id, target_amount, opening_sales_amount)
  values (v_partner_id, p_financial_year_id, p_target_amount, coalesce(p_opening_sales_amount,0))
  on conflict (partner_id, financial_year_id) do update
    set target_amount=excluded.target_amount, opening_sales_amount=excluded.opening_sales_amount, updated_at=now();
  return v_partner_id;
end $$;

create or replace function public.record_partner_sale(
  p_partner_target_id uuid, p_company_id text, p_manual_client_name text,
  p_product text, p_amount numeric, p_sale_date date, p_reference text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if public.current_app_role() not in ('Administrator','Manager','Contributor') then raise exception 'Insufficient permission'; end if;
  insert into public.partner_sales(partner_target_id, company_id, manual_client_name, product, amount, sale_date, reference)
  values (p_partner_target_id, p_company_id, nullif(trim(p_manual_client_name),''), trim(p_product), p_amount, p_sale_date, nullif(trim(p_reference),''))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.set_active_financial_year(date,date) from public;
revoke all on function public.save_partner_target(uuid,text,text,text,uuid,numeric,numeric) from public;
revoke all on function public.record_partner_sale(uuid,text,text,text,numeric,date,text) from public;
grant execute on function public.set_active_financial_year(date,date) to authenticated;
grant execute on function public.save_partner_target(uuid,text,text,text,uuid,numeric,numeric) to authenticated;
grant execute on function public.record_partner_sale(uuid,text,text,text,numeric,date,text) to authenticated;

do $$ declare t text; begin
  foreach t in array array['financial_years','partners','partner_targets','partner_sales','service_level_agreements'] loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.write_audit_log()', t, t);
  end loop;
end $$;

comment on table public.partner_sales is 'Immutable partner sale transactions; corrections should be audited updates, never rolled into target totals.';
comment on table public.notification_reads is 'Per-user server-side read state for follow-up notifications.';
