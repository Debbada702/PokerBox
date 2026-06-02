-- PokerBox minimal schema for auth + profile chips
-- Run in Supabase SQL editor.

create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  nametag text not null unique,
  email text not null unique,
  chips integer not null default 10000,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;

create policy "players can read own profile"
  on public.players
  for select
  to authenticated
  using (auth.uid() = id);

create policy "players can insert own profile"
  on public.players
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "players can update own profile"
  on public.players
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

