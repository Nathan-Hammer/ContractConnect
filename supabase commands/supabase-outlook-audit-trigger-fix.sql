-- Fix for environments where supabase-outlook-integration-migration.sql was
-- applied with the generic audit trigger. The integration_connections table
-- uses (user_id, provider), not an id column.

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

comment on function public.write_integration_connection_audit() is
  'Audits non-secret Outlook connection metadata using the composite connection key.';
