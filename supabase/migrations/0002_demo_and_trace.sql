-- Pipeline progress/trace for the review page, and a one-call demo reset.

alter table public.runs
  add column stage text,
  add column trace jsonb;

-- The lock guards gain one escape hatch: reset_demo_trip() sets a
-- transaction-local flag so it can delete a locked demo trip. Nothing else
-- sets it.
create or replace function public.assert_trip_not_locked(p_trip_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.demo_reset', true) = 'on' then
    return;
  end if;
  if exists (select 1 from public.trips where id = p_trip_id and status = 'locked') then
    raise exception 'TRIP_LOCKED' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.guard_trip_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.demo_reset', true) = 'on' then
    return new;
  end if;
  if old.status = 'locked' and (
       new.status <> 'locked'
       or new.locked_option_id is distinct from old.locked_option_id
     ) then
    raise exception 'TRIP_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Recreate the demo trip (/t/demo-trip) in its starting state: 4 of 5 have
-- submitted (Preethi hasn't), nobody has claimed a name, one hard veto
-- (Siddharth won't do Beach). Admin key: demo-admin-riya-2026.
create or replace function public.reset_demo_trip()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip uuid;
begin
  perform set_config('app.demo_reset', 'on', true);
  delete from public.trips where slug = 'demo-trip';
  perform set_config('app.demo_reset', 'off', true);

  insert into public.trips (slug, name, coordinator_name, deadline, trip_nights, admin_token_hash)
  values ('demo-trip', 'College gang trip 2026', 'Riya', now() + interval '3 days', 3,
          encode(sha256(convert_to('demo-admin-riya-2026', 'UTF8')), 'hex'))
  returning id into v_trip;

  insert into public.participants (trip_id, name, is_coordinator)
  values (v_trip, 'Riya', true), (v_trip, 'Siddharth', false), (v_trip, 'Karan', false),
         (v_trip, 'Aisha', false), (v_trip, 'Preethi', false);

  insert into public.submissions
    (participant_id, budget_cap_inr, starting_city, start_lat, start_lon,
     date_windows, destination_types, wont_do, wont_do_note)
  select p.id, v.budget, v.city, v.lat, v.lon, v.windows::jsonb, v.types, v.wont, v.note
  from public.participants p
  join (values
    ('Riya',      25000, 'Bengaluru, Karnataka',  12.97194, 77.59369,
     '[{"start":"2026-10-29","end":"2026-11-08"},{"start":"2026-11-19","end":"2026-11-23"}]',
     array['Beach','Relaxation','Heritage/Culture'], array[]::text[], null::text),
    ('Siddharth', 15000, 'Mumbai, Maharashtra',   19.07283, 72.88261,
     '[{"start":"2026-10-30","end":"2026-11-03"},{"start":"2026-11-20","end":"2026-11-24"}]',
     array['Mountains','Adventure','Nature/Wildlife'], array['Beach'], 'Had enough beach trips, want hills this time'),
    ('Karan',     30000, 'Delhi',                 28.65195, 77.23149,
     '[{"start":"2026-10-30","end":"2026-11-02"},{"start":"2026-11-19","end":"2026-11-25"}]',
     array['City','Beach','Adventure'], array[]::text[], 'Somewhere with a bit of nightlife would be nice'),
    ('Aisha',     20000, 'Hyderabad, Telangana',  17.38405, 78.45636,
     '[{"start":"2026-10-30","end":"2026-11-04"}]',
     array['Heritage/Culture','Nature/Wildlife','Relaxation'], array[]::text[],
     'Knee injury, so no long walks or steep climbs. Vegetarian food options please.')
  ) as v(name, budget, city, lat, lon, windows, types, wont, note) on v.name = p.name
  where p.trip_id = v_trip;

  insert into public.events (trip_id, type)
  select v_trip, 'created' union all
  select v_trip, 'submission' from generate_series(1, 4);
end;
$$;

revoke all on function public.reset_demo_trip() from public, anon, authenticated;
grant execute on function public.reset_demo_trip() to service_role;
grant execute on function public.assert_trip_not_locked(uuid) to service_role;
