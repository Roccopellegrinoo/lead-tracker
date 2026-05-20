create table if not exists public.tracker_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tracker_state enable row level security;

-- The app writes through the Vercel API with SUPABASE_SERVICE_ROLE_KEY.
-- No public RLS policy is needed for browser access.
