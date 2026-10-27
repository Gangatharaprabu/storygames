-- Storygames: player accounts and sync.
-- Run once in the Supabase dashboard (SQL Editor → New query → paste → Run),
-- or with the Supabase CLI: supabase db push.
--
-- Every table is protected by row-level security: a signed-in player can only read and
-- write their own rows. The app uses the public "anon" key; nothing here is readable
-- without signing in.

-- Display info (name and avatar), one row per player.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Traveller' check (char_length(name) between 1 and 40),
  avatar text not null default '🌙' check (char_length(avatar) <= 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The player's library: saved stories, progress, finished stories and the saga (choices
-- carried into sequels). One JSON document per player, merged by the app across devices.
create table if not exists public.player_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- In-progress game saves, one per player per story.
create table if not exists public.game_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  story_id text not null check (char_length(story_id) <= 100),
  data jsonb not null,
  saved_at timestamptz not null,
  primary key (user_id, story_id)
);

alter table public.profiles enable row level security;
alter table public.player_state enable row level security;
alter table public.game_saves enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own state" on public.player_state
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own saves" on public.game_saves
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Keep documents to a sane size (a player's state is a few KB; a save a few KB).
alter table public.player_state add constraint player_state_size check (pg_column_size(data) < 512000);
alter table public.game_saves add constraint game_saves_size check (pg_column_size(data) < 256000);
