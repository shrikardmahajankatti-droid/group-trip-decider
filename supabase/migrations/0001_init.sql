-- Group Trip Decider: initial schema.
-- All access is server-side with the Supabase secret key (bypasses RLS).
-- RLS is enabled on every table with NO policies, so anon/authenticated
-- clients can read or write nothing.

-- ---------------------------------------------------------------- trips
create table public.trips (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null check (char_length(name) between 1 and 80),
  coordinator_name text not null check (char_length(coordinator_name) between 1 and 40),
  deadline         timestamptz not null,
  trip_nights      integer not null check (trip_nights between 1 and 30),
  status           text not null default 'collecting'
                   check (status in ('collecting', 'generating', 'review', 'published', 'locked')),
  admin_token_hash text not null,
  created_at       timestamptz not null default now(),
  generated_at     timestamptz,
  published_at     timestamptz,
  locked_at        timestamptz,
  locked_option_id uuid
);

-- ---------------------------------------------------------- participants
create table public.participants (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 40),
  is_coordinator boolean not null default false,
  token_hash     text,
  claimed_at     timestamptz,
  unique (trip_id, name) -- also serves as the trip_id FK index
);

-- ----------------------------------------------------------- submissions
create table public.submissions (
  participant_id    uuid primary key references public.participants (id) on delete cascade,
  budget_cap_inr    integer not null check (budget_cap_inr between 1000 and 10000000),
  starting_city     text not null check (char_length(starting_city) between 1 and 120),
  start_lat         double precision not null check (start_lat between -90 and 90),
  start_lon         double precision not null check (start_lon between -180 and 180),
  date_windows      jsonb not null check (jsonb_typeof(date_windows) = 'array'),
  destination_types text[] not null default '{}',
  wont_do           text[] not null default '{}',
  wont_do_note      text check (wont_do_note is null or char_length(wont_do_note) <= 500),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------------ runs
create table public.runs (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  status      text not null default 'running'
              check (status in ('running', 'done', 'failed', 'stale')),
  error       text,
  constraints jsonb,
  created_at  timestamptz not null default now()
);
create index runs_trip_id_created_at_idx on public.runs (trip_id, created_at desc);

-- ------------------------------------------------------------ candidates
create table public.candidates (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.runs (id) on delete cascade,
  data         jsonb not null,           -- Claude step 1
  weather      jsonb,
  wikivoyage   jsonb,
  costs        jsonb,
  sources      jsonb,
  vetoed       boolean not null default false,
  veto_reasons jsonb,
  scores       jsonb,                    -- per participant: budget/dates/type/total/no_data
  min_score    numeric,
  avg_score    numeric,
  rank         integer
);
create index candidates_run_id_idx on public.candidates (run_id);

-- --------------------------------------------------------------- options
create table public.options (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.runs (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  position     smallint not null check (position between 1 and 3),
  card         jsonb,                    -- Claude step 2
  dropped      boolean not null default false
);
create index options_run_id_idx on public.options (run_id);
create index options_candidate_id_idx on public.options (candidate_id);
create unique index options_live_position_uq on public.options (run_id, position) where not dropped;

alter table public.trips
  add constraint trips_locked_option_id_fkey
  foreign key (locked_option_id) references public.options (id) on delete set null;
create index trips_locked_option_id_idx on public.trips (locked_option_id);

-- ----------------------------------------------------------------- votes
create table public.votes (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  participant_id uuid not null unique references public.participants (id) on delete cascade,
  option_id      uuid not null references public.options (id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index votes_trip_id_idx on public.votes (trip_id);
create index votes_option_id_idx on public.votes (option_id);

-- ---------------------------------------------------------------- events
create table public.events (
  id      uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type    text not null
          check (type in ('created', 'submission', 'trigger', 'publish', 'lock', 'rerun', 'reversal_blocked')),
  at      timestamptz not null default now()
);
create index events_trip_id_idx on public.events (trip_id, at);

-- ------------------------------------------------- lock enforcement (DB)
-- Belt and braces: the app checks status in every server action, and the
-- database also refuses changes to a locked trip's answers or votes.

create function public.assert_trip_not_locked(p_trip_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.trips where id = p_trip_id and status = 'locked') then
    raise exception 'TRIP_LOCKED' using errcode = 'P0001';
  end if;
end;
$$;

create function public.guard_submission_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trip uuid;
begin
  select trip_id into v_trip
  from public.participants
  where id = coalesce(new.participant_id, old.participant_id);
  perform public.assert_trip_not_locked(v_trip);
  return coalesce(new, old);
end;
$$;

create trigger submissions_lock_guard
  before insert or update or delete on public.submissions
  for each row execute function public.guard_submission_lock();

create function public.guard_vote_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_trip_not_locked(coalesce(new.trip_id, old.trip_id));
  if tg_op = 'UPDATE' then
    raise exception 'VOTE_FINAL' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger votes_lock_guard
  before insert or update or delete on public.votes
  for each row execute function public.guard_vote_lock();

-- A locked trip can never be unlocked or have its winner changed.
create function public.guard_trip_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'locked' and (
       new.status <> 'locked'
       or new.locked_option_id is distinct from old.locked_option_id
     ) then
    raise exception 'TRIP_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trips_lock_guard
  before update on public.trips
  for each row execute function public.guard_trip_lock();

-- --------------------------------------------------------------- security
alter table public.trips        enable row level security;
alter table public.participants enable row level security;
alter table public.submissions  enable row level security;
alter table public.runs         enable row level security;
alter table public.candidates   enable row level security;
alter table public.options      enable row level security;
alter table public.votes        enable row level security;
alter table public.events       enable row level security;

-- No public policies. Also strip grants from the browser-facing roles.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
grant all on all tables in schema public to service_role;
grant execute on function public.assert_trip_not_locked(uuid) to service_role;
