-- ContractConnect private contract document repository
-- Run in the Supabase SQL Editor.

create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id text not null references public.contracts(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  category text not null check (category in ('Agreement', 'Amendment', 'Supporting document', 'Certificate', 'Other')),
  version integer not null default 1 check (version > 0),
  file_size bigint not null default 0,
  mime_type text,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists contract_documents_contract_idx on public.contract_documents(contract_id);
alter table public.contract_documents enable row level security;
drop policy if exists "Authenticated users manage contract documents" on public.contract_documents;
create policy "Authenticated users manage contract documents" on public.contract_documents
for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-documents', 'contract-documents', false, 20971520,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users read contract files" on storage.objects;
drop policy if exists "Authenticated users upload contract files" on storage.objects;
drop policy if exists "Authenticated users delete contract files" on storage.objects;
create policy "Authenticated users read contract files" on storage.objects for select to authenticated using (bucket_id = 'contract-documents');
create policy "Authenticated users upload contract files" on storage.objects for insert to authenticated with check (bucket_id = 'contract-documents');
create policy "Authenticated users delete contract files" on storage.objects for delete to authenticated using (bucket_id = 'contract-documents');
