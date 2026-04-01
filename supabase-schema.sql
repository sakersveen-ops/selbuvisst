-- Run this in your Supabase SQL editor
-- (safe to re-run; uses IF NOT EXISTS and DROP POLICY IF EXISTS)

-- Rooms table
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  host_id uuid references auth.users(id),
  host_name text,
  players jsonb default '[]'::jsonb,
  max_players integer default 5,
  max_rounds integer default 10,
  state jsonb,
  bid_staging jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Add columns if upgrading from old schema
alter table rooms add column if not exists max_players integer default 5;
alter table rooms add column if not exists max_rounds integer default 10;

-- Scores table (permanent leaderboard)
create table if not exists scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  player_name text not null,
  total_score integer not null,
  room_code text,
  played_at timestamptz default now()
);

-- RLS
alter table rooms enable row level security;
alter table scores enable row level security;

drop policy if exists "rooms_select" on rooms;
drop policy if exists "rooms_insert" on rooms;
drop policy if exists "rooms_update" on rooms;
drop policy if exists "scores_select" on scores;
drop policy if exists "scores_insert" on scores;

create policy "rooms_select" on rooms for select to authenticated using (true);
create policy "rooms_insert" on rooms for insert to authenticated with check (true);
create policy "rooms_update" on rooms for update to authenticated using (true);
create policy "scores_select" on scores for select using (true);
create policy "scores_insert" on scores for insert to authenticated with check (true);

-- Realtime
alter publication supabase_realtime add table rooms;

-- ── ANONYMOUS AUTH ──────────────────────────────────────────────────────────
-- Enable in: Supabase Dashboard → Authentication → Providers → Anonymous Sign-ins → Enable
-- No SQL needed, but scores policy should exclude anonymous users from global board:

-- Optional: view that only shows non-anonymous scores on global leaderboard
create or replace view public_scores as
  select s.*, u.is_anonymous
  from scores s
  left join auth.users u on u.id = s.user_id
  where u.is_anonymous is not true or u.is_anonymous is null;
