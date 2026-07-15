-- Web push subscriptions for the Ctrl+P PWA.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

-- All reads/writes go through the server using the service role key, which
-- bypasses RLS. Enable RLS with no public policies so nothing is exposed to
-- anon/authenticated clients directly.
alter table public.push_subscriptions enable row level security;
