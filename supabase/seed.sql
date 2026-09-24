-- Demo trip for end-to-end testing. Safe to re-run: it replaces the demo trip.
--
--   Group link:  /t/demo-trip
--   Admin link:  /t/demo-trip/admin?k=demo-admin-riya-2026
--
-- The admin token is public in this file, so use the demo only for testing and
-- create a fresh trip from the landing page for the real group.
--
-- State: 4 of 5 have submitted, and Preethi hasn't yet. Claim "Preethi" on the
-- group link and submit to fire the trigger. Trip = 3 nights.
--   Everyone (of the 4) is free Oct 30 → Nov 2 (exactly 3 nights).
--   Nov 20 → 23 works for Riya, Siddharth and Karan but not Aisha.
--   Budget floor = ₹15,000 (Siddharth). Hard veto: Aisha won't do Trekking/Hiking.

begin;

-- Clearing a (possibly locked) demo trip must bypass the lock guards.
alter table public.votes       disable trigger votes_lock_guard;
alter table public.submissions disable trigger submissions_lock_guard;
alter table public.trips       disable trigger trips_lock_guard;

delete from public.trips where slug = 'demo-trip';

alter table public.votes       enable trigger votes_lock_guard;
alter table public.submissions enable trigger submissions_lock_guard;
alter table public.trips       enable trigger trips_lock_guard;

with t as (
  insert into public.trips (slug, name, coordinator_name, deadline, trip_nights, admin_token_hash)
  values (
    'demo-trip',
    'College gang trip 2026',
    'Riya',
    now() + interval '3 days',
    3,
    encode(sha256(convert_to('demo-admin-riya-2026', 'UTF8')), 'hex')
  )
  returning id
),
p as (
  insert into public.participants (trip_id, name, is_coordinator)
  select t.id, v.name, v.is_coord
  from t, (values
    ('Riya', true), ('Siddharth', false), ('Karan', false), ('Aisha', false), ('Preethi', false)
  ) as v(name, is_coord)
  returning id, name
),
s as (
  insert into public.submissions
    (participant_id, budget_cap_inr, starting_city, start_lat, start_lon,
     date_windows, destination_types, wont_do, wont_do_note)
  select p.id, v.budget, v.city, v.lat, v.lon, v.windows::jsonb, v.types, v.wont, v.note
  from p
  join (values
    ('Riya',      25000, 'Bengaluru, Karnataka',  12.97194, 77.59369,
     '[{"start":"2026-10-29","end":"2026-11-08"},{"start":"2026-11-19","end":"2026-11-23"}]',
     array['Beach','Relaxation','Heritage/Culture'], array[]::text[], null),
    ('Siddharth', 15000, 'Mumbai, Maharashtra',   19.07283, 72.88261,
     '[{"start":"2026-10-30","end":"2026-11-03"},{"start":"2026-11-20","end":"2026-11-24"}]',
     array['Mountains','Adventure','Nature/Wildlife'], array[]::text[], null),
    ('Karan',     30000, 'Delhi',                 28.65195, 77.23149,
     '[{"start":"2026-10-30","end":"2026-11-02"},{"start":"2026-11-19","end":"2026-11-25"}]',
     array['City','Beach','Adventure'], array[]::text[], 'Somewhere with a bit of nightlife would be nice'),
    ('Aisha',     20000, 'Hyderabad, Telangana',  17.38405, 78.45636,
     '[{"start":"2026-10-30","end":"2026-11-04"}]',
     array['Heritage/Culture','Nature/Wildlife','Relaxation'], array['Trekking/Hiking'],
     'Knee injury, so no long walks or steep climbs. Vegetarian food options please.')
  ) as v(name, budget, city, lat, lon, windows, types, wont, note)
    on v.name = p.name
  returning participant_id
)
insert into public.events (trip_id, type)
select t.id, 'created' from t
union all
select t.id, 'submission' from t, s;

commit;
