-- Read-only SharePoint option on the existing delegated Microsoft connector.
alter table public.integration_connections
  add column if not exists sharepoint_enabled boolean not null default false;

alter table public.integration_oauth_states
  add column if not exists sharepoint_requested boolean not null default false;

comment on column public.integration_connections.sharepoint_enabled is
  'Allows on-demand read-only listing of the configured SharePoint contract folder.';

