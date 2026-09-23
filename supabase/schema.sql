-- Two for Tonight — database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "uuid-ossp";

-- One row per "movie night" session shared by two partners.
create table if not exists sessions (
  id uuid primary key default uuid_generate_v4(),
  status text not null default 'waiting_for_b'
    check (status in (
      'waiting_for_b',   -- A has joined and set prefs, waiting for B to scan/join
      'waiting_for_prefs', -- both joined, waiting for one or both to submit prefs
      'building_pool',   -- Claude + TMDB are assembling the round's 30 titles
      'swiping',         -- both partners are swiping the current round
      'matched',         -- a mutual right-swipe was found
      'final_call',      -- two rounds with no match; showing top 5 for manual pick
      'completed'        -- partners picked a title and (optionally) rated it
    )),
  round int not null default 1,
  matched_tmdb_id int,
  matched_media_type text check (matched_media_type in ('movie','tv')),
  matched_at timestamptz,
  final_pick_tmdb_id int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stable per-device identity so returning partners build up a taste history
-- without requiring a login. Stored in the browser's localStorage.
create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now()
);

-- Each partner's preference submission for a given session.
create table if not exists session_partners (
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('A','B')),
  partner_id uuid references partners(id),
  joined_at timestamptz not null default now(),
  mood text[] not null default '{}',
  mood_free_text text,
  languages text[] not null default '{}',
  content_type text check (content_type in ('movies_only','include_series')),
  min_rating numeric,
  eras text[] not null default '{}',
  submitted_at timestamptz,
  primary key (session_id, role)
);

-- The pool of candidate titles shown for a given round (shared by both partners;
-- swipe order is randomised client-side per partner).
create table if not exists round_pools (
  session_id uuid not null references sessions(id) on delete cascade,
  round int not null,
  tmdb_id int not null,
  imdb_id text,
  media_type text not null check (media_type in ('movie','tv')),
  title text not null,
  year int,
  poster_path text,
  imdb_rating numeric,
  runtime_minutes int,
  synopsis text,
  created_at timestamptz not null default now(),
  primary key (session_id, round, tmdb_id)
);

-- Claude's generated search brief for each round, kept for transparency/debugging.
create table if not exists round_briefs (
  session_id uuid not null references sessions(id) on delete cascade,
  round int not null,
  brief jsonb not null,
  rationale text,
  created_at timestamptz not null default now(),
  primary key (session_id, round)
);

-- Every swipe, from both partners, across all rounds.
create table if not exists swipes (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  round int not null,
  role text not null check (role in ('A','B')),
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie','tv')),
  direction text not null check (direction in ('left','right')),
  created_at timestamptz not null default now(),
  unique (session_id, round, role, tmdb_id)
);

-- Post-watch rating, and the durable per-partner taste history used to
-- personalise future sessions ("liked together" vs. "thought they would like").
create table if not exists ratings (
  session_id uuid not null references sessions(id) on delete cascade,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie','tv')),
  score int check (score between 1 and 5),
  note text,
  rated_at timestamptz not null default now(),
  primary key (session_id, tmdb_id)
);

create table if not exists partner_history (
  partner_id uuid not null references partners(id) on delete cascade,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie','tv')),
  liked boolean not null, -- true = right swipe, false = left swipe
  session_id uuid not null references sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partner_id, session_id, tmdb_id)
);

create index if not exists idx_swipes_session_round on swipes(session_id, round);
create index if not exists idx_round_pools_session on round_pools(session_id, round);
create index if not exists idx_partner_history_partner on partner_history(partner_id);

-- Realtime: let the client subscribe to session status changes (join, pool ready,
-- match found) instead of polling.
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table swipes;

-- Keep updated_at current.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sessions_updated_at on sessions;
create trigger sessions_updated_at before update on sessions
  for each row execute function set_updated_at();

-- Row Level Security: sessions are ephemeral and keyed by an unguessable UUID
-- (the "link/QR code is the password" model used by tools like Doodle/Figjam).
-- Anonymous read/write is allowed via the anon key; all writes still go through
-- the app's API routes using the service role key for anything sensitive.
alter table sessions enable row level security;
alter table session_partners enable row level security;
alter table round_pools enable row level security;
alter table round_briefs enable row level security;
alter table swipes enable row level security;
alter table ratings enable row level security;
alter table partners enable row level security;
alter table partner_history enable row level security;

create policy "anon can read sessions" on sessions for select using (true);
create policy "anon can read session_partners" on session_partners for select using (true);
create policy "anon can read round_pools" on round_pools for select using (true);
create policy "anon can read swipes" on swipes for select using (true);
create policy "anon can read partners" on partners for select using (true);
-- All INSERT/UPDATE goes through server-side API routes using the service role
-- key, which bypasses RLS — so no anon write policies are defined here.
