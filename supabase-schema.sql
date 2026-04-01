-- ═══════════════════════════════════════════════════════════════════
-- SELBUVISST — Supabase schema
-- Safe to re-run (uses IF NOT EXISTS and DROP POLICY IF EXISTS)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists rooms (
  id          uuid default gen_random_uuid() primary key,
  code        text unique not null,
  host_id     uuid references auth.users(id),
  host_name   text,
  players     jsonb default '[]'::jsonb,
  max_players integer default 5,
  max_rounds  integer default 10,
  state       jsonb,
  bid_staging jsonb default '{}'::jsonb,
  kicked      jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

create table if not exists scores (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id),
  player_name text not null,
  total_score integer not null,
  room_code   text,
  played_at   timestamptz default now()
);

alter table rooms add column if not exists max_players integer default 5;
alter table rooms add column if not exists max_rounds  integer default 10;
alter table rooms add column if not exists kicked      jsonb default '[]'::jsonb;

alter table rooms  enable row level security;
alter table scores enable row level security;

drop policy if exists "rooms_select"  on rooms;
drop policy if exists "rooms_insert"  on rooms;
drop policy if exists "rooms_update"  on rooms;
drop policy if exists "scores_select" on scores;
drop policy if exists "scores_insert" on scores;

create policy "rooms_select"  on rooms for select to authenticated using (true);
create policy "rooms_insert"  on rooms for insert to authenticated with check (true);
create policy "rooms_update"  on rooms for update to authenticated using (true);
create policy "scores_select" on scores for select using (true);
create policy "scores_insert" on scores for insert to authenticated
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'is_anonymous')::boolean is not true
  );

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table rooms;
  end if;
end $$;

create or replace view public_scores as
  select s.id, s.player_name, s.total_score, s.room_code, s.played_at
  from scores s
  join auth.users u on u.id = s.user_id
  where (u.raw_app_meta_data ->> 'provider') != 'anonymous'
     or u.raw_app_meta_data ->> 'provider' is null;
