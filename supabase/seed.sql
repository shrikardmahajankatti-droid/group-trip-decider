-- Demo trip for end-to-end testing and demos. Safe to re-run at any time,
-- including after the demo has been locked. Requires migrations 0001 + 0002.
--
--   Group link:  /t/demo-trip
--   Admin link:  /t/demo-trip/admin?k=demo-admin-riya-2026
--
-- The admin key is public on purpose (it's a demo), so create a fresh trip from
-- the landing page for a real group.
--
-- State: 4 of 5 have submitted (Preethi hasn't). Trip = 3 nights.
--   Everyone who submitted is free Oct 30 → Nov 2 (exactly 3 nights).
--   Budget floor = ₹15,000 (Siddharth).
--   One hard veto: Siddharth won't do Beach (so a beach favourite like Goa is
--   removed in code). Aisha's knee note is free text: shown, not enforced.
-- The same reset is on the demo's coordinator page ("Reset demo").

select public.reset_demo_trip();
