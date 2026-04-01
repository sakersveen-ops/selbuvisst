-- Run this in your Supabase SQL editor

-- Rooms table (game sessions)
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  host_id uuid references auth.users(id),
  host_name text,
  players jsonb default '[]'::jsonb,
  state jsonb,
  bid_staging jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Scores table (permanent leaderboard)
create table if not exists scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  player_name text not null,
  total_score integer not null,
  room_code text,
  played_at timestamptz default now()
);

-- Enable Row Level Security
alter table rooms enable row level security;
alter table scores enable row level security;

-- Rooms: anyone authenticated can read/write (game rooms are shared)
create policy "Authenticated users can read rooms"
  on rooms for select to authenticated using (true);

create policy "Authenticated users can insert rooms"
  on rooms for insert to authenticated with check (true);

create policy "Authenticated users can update rooms"
  on rooms for update to authenticated using (true);

-- Scores: anyone can read, authenticated can insert their own
create policy "Anyone can read scores"
  on scores for select using (true);

create policy "Authenticated users can insert scores"
  on scores for insert to authenticated with check (true);

-- Enable realtime for rooms table
alter publication supabase_realtime add table rooms;
