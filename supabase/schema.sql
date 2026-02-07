create extension if not exists "pgcrypto";

create table if not exists public.user_teams (
  user_id uuid primary key references auth.users (id) on delete cascade,
  team_name text,
  working_team jsonb,
  locked_teams jsonb,
  subs_used integer default 0,
  updated_at timestamptz default now()
);

alter table public.user_teams enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_teams'
      and policyname = 'Users can view their team'
  ) then
    create policy "Users can view their team" on public.user_teams
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_teams'
      and policyname = 'Users can upsert their team'
  ) then
    create policy "Users can upsert their team" on public.user_teams
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_teams'
      and policyname = 'Users can update their team'
  ) then
    create policy "Users can update their team" on public.user_teams
      for update
      using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  team_name text,
  joined_at timestamptz default now(),
  unique (league_id, user_id)
);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

drop policy if exists "Users can view leagues they belong to" on public.leagues;
drop policy if exists "Users can create leagues" on public.leagues;
drop policy if exists "Owners can update leagues" on public.leagues;
drop policy if exists "Owners can delete leagues" on public.leagues;
drop policy if exists "Members can view league members" on public.league_members;
drop policy if exists "Users can join leagues" on public.league_members;
drop policy if exists "Users can leave leagues" on public.league_members;

create or replace function public.is_league_owner(lid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leagues l
    where l.id = lid and l.owner_id = auth.uid()
  );
$$;

create or replace function public.is_league_member(lid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members m
    where m.league_id = lid and m.user_id = auth.uid()
  );
$$;

create policy "Users can view leagues they belong to" on public.leagues
  for select
  using (public.is_league_owner(id) or public.is_league_member(id));

create policy "Users can create leagues" on public.leagues
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update leagues" on public.leagues
  for update
  using (owner_id = auth.uid());

create policy "Owners can delete leagues" on public.leagues
  for delete
  using (owner_id = auth.uid());

create policy "Members can view league members" on public.league_members
  for select
  using (
    user_id = auth.uid()
    or public.is_league_owner(league_id)
    or public.is_league_member(league_id)
  );

create policy "Users can join leagues" on public.league_members
  for insert
  to public
  with check (user_id = auth.uid());

create policy "Users can leave leagues" on public.league_members
  for delete
  using (user_id = auth.uid());

drop trigger if exists set_league_owner on public.leagues;

create or replace function public.create_league(
  p_name text,
  p_code text,
  p_team_name text
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row public.leagues;
begin
  insert into public.leagues (name, code, owner_id)
  values (p_name, p_code, auth.uid())
  returning * into new_row;

  insert into public.league_members (league_id, user_id, team_name)
  values (new_row.id, auth.uid(), p_team_name);

  return new_row;
end;
$$;

grant execute on function public.create_league(text, text, text) to authenticated;

create or replace function public.join_league(
  p_code text,
  p_team_name text
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.leagues;
begin
  select * into target
  from public.leagues
  where code = p_code;

  if target.id is null then
    raise exception 'Invalid league code';
  end if;

  insert into public.league_members (league_id, user_id, team_name)
  values (target.id, auth.uid(), p_team_name)
  on conflict (league_id, user_id) do nothing;

  return target;
end;
$$;

grant execute on function public.join_league(text, text) to authenticated;

create or replace function public.leave_league(
  p_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.league_members
  where league_id = p_league_id
    and user_id = auth.uid();
  return true;
end;
$$;

grant execute on function public.leave_league(uuid) to authenticated;

create or replace function public.delete_league(
  p_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.leagues
  where id = p_league_id
    and owner_id = auth.uid();
  return true;
end;
$$;

grant execute on function public.delete_league(uuid) to authenticated;

create table if not exists public.match_stats (
  player_id text not null,
  match_id integer not null,
  in_playing_xi boolean default false,
  impact_player boolean default false,
  batting jsonb,
  bowling jsonb,
  fielding jsonb,
  man_of_the_match boolean default false,
  updated_at timestamptz default now(),
  primary key (player_id, match_id)
);

alter table public.match_stats enable row level security;

drop policy if exists "Public can view match stats" on public.match_stats;
drop policy if exists "Authenticated can upsert match stats" on public.match_stats;
drop policy if exists "Authenticated can update match stats" on public.match_stats;
drop policy if exists "Admins can upsert match stats" on public.match_stats;
drop policy if exists "Admins can update match stats" on public.match_stats;

create policy "Public can view match stats" on public.match_stats
  for select
  to public
  using (true);

create policy "Admins can upsert match stats" on public.match_stats
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update match stats" on public.match_stats
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.get_leaderboard_teams()
returns table (
  user_id uuid,
  team_name text,
  working_team jsonb,
  subs_used integer
)
language sql
security definer
set search_path = public
as $$
  select
    user_id,
    team_name,
    case
      when user_id = auth.uid() then working_team
      else null
    end as working_team,
    subs_used
  from public.user_teams;
$$;

grant execute on function public.get_leaderboard_teams() to authenticated;

create table if not exists public.locked_team_history (
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id integer not null,
  players jsonb not null,
  captain_id text not null,
  vice_captain_id text not null,
  subs_used integer not null default 0,
  locked_at timestamptz default now(),
  primary key (user_id, match_id)
);

alter table public.locked_team_history enable row level security;

drop policy if exists "Users can view lock history" on public.locked_team_history;
drop policy if exists "Users can insert lock history" on public.locked_team_history;

create policy "Users can view lock history" on public.locked_team_history
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert lock history" on public.locked_team_history
  for insert
  to authenticated
  with check (user_id = auth.uid());

create table if not exists public.admin_users (
  email text primary key
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read admin users" on public.admin_users;

create policy "Admins can read admin users" on public.admin_users
  for select
  to authenticated
  using (auth.jwt()->>'email' = email);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where email = auth.jwt()->>'email'
  );
$$;

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  from_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.feedback_messages enable row level security;

drop policy if exists "Users can view own feedback" on public.feedback_messages;
drop policy if exists "Users can send feedback" on public.feedback_messages;
drop policy if exists "Admins can view all feedback" on public.feedback_messages;
drop policy if exists "Admins can reply feedback" on public.feedback_messages;

create policy "Users can view own feedback" on public.feedback_messages
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can send feedback" on public.feedback_messages
  for insert
  to authenticated
  with check (user_id = auth.uid() and from_admin = false);

create policy "Admins can view all feedback" on public.feedback_messages
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can reply feedback" on public.feedback_messages
  for insert
  to authenticated
  with check (public.is_admin() and from_admin = true);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  team_name text not null,
  contact_number text not null,
  country text not null,
  state text not null,
  favorite_team text not null,
  team_photo_url text,
  full_name_edit_used boolean default false,
  team_name_edit_used boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
drop policy if exists "Users can upsert own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;

create policy "Users can view own profile" on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can upsert own profile" on public.user_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own profile" on public.user_profiles
  for update
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.fixtures (
  match_id integer primary key,
  team_a text not null,
  team_b text not null,
  start_time_utc timestamptz not null
);

insert into public.fixtures (match_id, team_a, team_b, start_time_utc) values
  (1, 'Pakistan', 'Netherlands', '2026-02-07T05:30:00Z'),
  (2, 'West Indies', 'Scotland', '2026-02-07T09:30:00Z'),
  (3, 'India', 'United States of America', '2026-02-07T13:30:00Z'),
  (4, 'New Zealand', 'Afghanistan', '2026-02-08T05:30:00Z'),
  (5, 'England', 'Nepal', '2026-02-08T09:30:00Z'),
  (6, 'Sri Lanka', 'Ireland', '2026-02-08T13:30:00Z'),
  (7, 'Scotland', 'Italy', '2026-02-09T05:30:00Z'),
  (8, 'Zimbabwe', 'Oman', '2026-02-09T09:30:00Z'),
  (9, 'South Africa', 'Canada', '2026-02-09T13:30:00Z'),
  (10, 'Netherlands', 'Namibia', '2026-02-10T05:30:00Z'),
  (11, 'New Zealand', 'United Arab Emirates', '2026-02-10T09:30:00Z'),
  (12, 'Pakistan', 'United States of America', '2026-02-10T13:30:00Z'),
  (13, 'South Africa', 'Afghanistan', '2026-02-11T05:30:00Z'),
  (14, 'Australia', 'Ireland', '2026-02-11T09:30:00Z'),
  (15, 'England', 'West Indies', '2026-02-11T13:30:00Z'),
  (16, 'Sri Lanka', 'Oman', '2026-02-12T05:30:00Z'),
  (17, 'Nepal', 'Italy', '2026-02-12T09:30:00Z'),
  (18, 'India', 'Namibia', '2026-02-12T13:30:00Z'),
  (19, 'Australia', 'Zimbabwe', '2026-02-13T05:30:00Z'),
  (20, 'Canada', 'United Arab Emirates', '2026-02-13T09:30:00Z'),
  (21, 'United States of America', 'Netherlands', '2026-02-13T13:30:00Z'),
  (22, 'Ireland', 'Oman', '2026-02-14T05:30:00Z'),
  (23, 'England', 'Scotland', '2026-02-14T09:30:00Z'),
  (24, 'New Zealand', 'South Africa', '2026-02-14T13:30:00Z'),
  (25, 'West Indies', 'Nepal', '2026-02-15T05:30:00Z'),
  (26, 'United States of America', 'Namibia', '2026-02-15T09:30:00Z'),
  (27, 'India', 'Pakistan', '2026-02-15T13:30:00Z'),
  (28, 'Afghanistan', 'United Arab Emirates', '2026-02-16T05:30:00Z'),
  (29, 'England', 'Italy', '2026-02-16T09:30:00Z'),
  (30, 'Australia', 'Sri Lanka', '2026-02-16T13:30:00Z'),
  (31, 'New Zealand', 'Canada', '2026-02-17T05:30:00Z'),
  (32, 'Ireland', 'Zimbabwe', '2026-02-17T09:30:00Z'),
  (33, 'Scotland', 'Nepal', '2026-02-17T13:30:00Z'),
  (34, 'South Africa', 'United Arab Emirates', '2026-02-18T05:30:00Z'),
  (35, 'Pakistan', 'Namibia', '2026-02-18T09:30:00Z'),
  (36, 'India', 'Netherlands', '2026-02-18T13:30:00Z'),
  (37, 'West Indies', 'Italy', '2026-02-19T05:30:00Z'),
  (38, 'Sri Lanka', 'Zimbabwe', '2026-02-19T09:30:00Z'),
  (39, 'Afghanistan', 'Canada', '2026-02-19T13:30:00Z'),
  (40, 'Australia', 'Oman', '2026-02-20T13:30:00Z'),
  (41, 'TBC', 'TBC', '2026-02-21T13:30:00Z'),
  (42, 'TBC', 'TBC', '2026-02-22T09:30:00Z'),
  (43, 'TBC', 'TBC', '2026-02-22T13:30:00Z'),
  (44, 'TBC', 'TBC', '2026-02-23T13:30:00Z'),
  (45, 'TBC', 'TBC', '2026-02-24T13:30:00Z'),
  (46, 'TBC', 'TBC', '2026-02-25T13:30:00Z'),
  (47, 'TBC', 'TBC', '2026-02-26T09:30:00Z'),
  (48, 'TBC', 'TBC', '2026-02-26T13:30:00Z'),
  (49, 'TBC', 'TBC', '2026-02-27T13:30:00Z'),
  (50, 'TBC', 'TBC', '2026-02-28T13:30:00Z'),
  (51, 'TBC', 'TBC', '2026-03-01T09:30:00Z'),
  (52, 'TBC', 'TBC', '2026-03-01T13:30:00Z'),
  (53, 'TBC', 'TBC', '2026-03-04T13:30:00Z'),
  (54, 'TBC', 'TBC', '2026-03-05T13:30:00Z'),
  (55, 'TBC', 'TBC', '2026-03-08T13:30:00Z')
on conflict (match_id) do update set
  team_a = excluded.team_a,
  team_b = excluded.team_b,
  start_time_utc = excluded.start_time_utc;

create table if not exists public.locked_team_public (
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id integer not null,
  players jsonb not null,
  captain_id text not null,
  vice_captain_id text not null,
  subs_used integer not null default 0,
  locked_at timestamptz default now(),
  primary key (user_id, match_id)
);

alter table public.locked_team_public enable row level security;

drop policy if exists "Authenticated can read locked teams" on public.locked_team_public;

create policy "Authenticated can read locked teams" on public.locked_team_public
  for select
  to authenticated
  using (true);

create or replace function public.insert_locked_team_history(
  p_user_id uuid,
  p_match_id integer,
  p_players jsonb,
  p_captain_id text,
  p_vice_captain_id text,
  p_subs_used integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  match_start timestamptz;
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null then
    raise exception 'Authentication required';
  end if;

  if p_user_id is distinct from auth_user then
    raise exception 'Cannot lock team for another user';
  end if;

  select start_time_utc into match_start
  from public.fixtures
  where match_id = p_match_id;

  if match_start is null then
    raise exception 'Unknown match id';
  end if;

  if now() < match_start then
    raise exception 'Match not locked yet';
  end if;

  insert into public.locked_team_history (
    user_id,
    match_id,
    players,
    captain_id,
    vice_captain_id,
    subs_used
  )
  values (
    auth_user,
    p_match_id,
    p_players,
    p_captain_id,
    p_vice_captain_id,
    p_subs_used
  )
  on conflict (user_id, match_id) do nothing;

  insert into public.locked_team_public (
    user_id,
    match_id,
    players,
    captain_id,
    vice_captain_id,
    subs_used
  )
  values (
    auth_user,
    p_match_id,
    p_players,
    p_captain_id,
    p_vice_captain_id,
    p_subs_used
  )
  on conflict (user_id, match_id) do nothing;

  return true;
end;
$$;

grant execute on function public.insert_locked_team_history(
  uuid,
  integer,
  jsonb,
  text,
  text,
  integer
) to authenticated;

create or replace function public.get_all_locked_teams()
returns setof public.locked_team_public
language sql
security definer
set search_path = public
as $$
  select * from public.locked_team_public;
$$;

grant execute on function public.get_all_locked_teams() to authenticated;
