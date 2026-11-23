-- Ctrl+P MCP connector (Claude, ChatGPT, Codex).
-- The MCP server writes these with the service-role key after verifying the
-- caller's OAuth token and staff role. Clients (anon/authenticated) can only
-- read the audit log, and only admins can.

-- ---------------------------------------------------------------------------
-- Audit log: one row per tool call, append-only.
-- ---------------------------------------------------------------------------
create table if not exists public.mcp_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text check (char_length(client_id) <= 200),
  tool text not null check (char_length(tool) <= 100),
  target_table text check (char_length(target_table) <= 100),
  target_id text check (char_length(target_id) <= 200),
  ok boolean not null,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists mcp_audit_log_created_idx on public.mcp_audit_log (created_at desc);
create index if not exists mcp_audit_log_user_created_idx on public.mcp_audit_log (user_id, created_at desc);

create or replace function public.mcp_audit_log_block_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'mcp_audit_log is append-only';
end;
$$;

drop trigger if exists mcp_audit_log_append_only on public.mcp_audit_log;
create trigger mcp_audit_log_append_only
  before update or delete on public.mcp_audit_log
  for each row execute function public.mcp_audit_log_block_changes();

-- ---------------------------------------------------------------------------
-- Confirmations: high-risk actions (deletes, bulk changes, sends) are stored
-- here as a preview and run only once the person says yes (confirm_action).
-- Each works once, within 15 minutes, for the same person and connected app.
-- ---------------------------------------------------------------------------
create table if not exists public.mcp_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text check (char_length(client_id) <= 200),
  tool text not null check (char_length(tool) <= 80),
  payload jsonb not null check (pg_column_size(payload) <= 262144),
  summary text check (char_length(summary) <= 2000),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mcp_confirmations_user_idx on public.mcp_confirmations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------
revoke all on public.mcp_audit_log, public.mcp_confirmations from anon, authenticated;
grant select on public.mcp_audit_log to authenticated;

alter table public.mcp_audit_log enable row level security;
alter table public.mcp_confirmations enable row level security;

drop policy if exists "mcp_audit_log_admin_select" on public.mcp_audit_log;
create policy "mcp_audit_log_admin_select" on public.mcp_audit_log
  for select to authenticated using (public.is_admin());
