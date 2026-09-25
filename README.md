# Group Trip Decider

Gets a group of friends to **one destination and one date window**. Everyone submits preferences through one shared link (no login). Once all of them have submitted, or the deadline passes, the app shows **3 trip options** with a per-person fit matrix. The coordinator reviews the options before anyone else sees them, the group votes once, and the coordinator locks the result.

> This gets all five of you to one destination and one set of dates, but it doesn't quote live prices or book anything. Whoever books checks the price on the day.

Spec: `docs/ShrikarAssessment_Riya_Group_Trip_Solution.docx` (Automation Brief, Nine Checks, the Cut, Components Map).

## Stack

Next.js (App Router, TypeScript strict) on Vercel Hobby · Tailwind · Supabase Postgres (server-only access, RLS on, no policies) · Zod · Vitest · Gemini free tier (`@google/genai`) · Open-Meteo · Wikivoyage. Claude (`@anthropic-ai/sdk`) is supported but optional.

## How it works

1. The coordinator creates a trip and shares **one link**. Friends pick their name (no login) and submit budget, dates, starting city, trip types and hard "won't do"s. They can edit until the lock.
2. **Trigger**: everyone has submitted, or the deadline passes. It fires on the final submission, on any page visit after the deadline, or from the daily cron, and only runs once.
3. **Pipeline** (`src/lib/server/pipeline.ts`):
   - Code aggregates the constraints (date overlap, budget floor, hard no's).
   - AI step 1 proposes 6–8 destinations.
   - Open-Meteo weather and Wikivoyage info are added for each one.
   - Indicative costs are extracted **only from the Wikivoyage text**, and code verifies each quoted price is on the page.
   - Code applies the **hard veto**, scores every person × option 0–100, and ranks by the lowest person's score, then the average.
   - AI step 2 writes 3 cards with a "where you stand" line for each person.
4. **Review gate**: only the coordinator sees the shortlist. They can drop (the next best fills the slot), re-run or publish.
5. The group votes **once**. The coordinator **locks**, and the database then refuses any edit, vote or unlock. The coordinator copies the WhatsApp message.

**AI provider.** By default everything runs on the Gemini free tier with no billing. `gemini-3.1-flash-lite` is primary and `gemini-3.5-flash` is the fallback. If `ANTHROPIC_API_KEY` is set, Claude writes steps 1 and 2 instead. The free tier has no Google Search grounding, which is why costs come from Wikivoyage and otherwise show "cost unavailable". Prompts use P1…P5 instead of names.

## Demo trip

`supabase/seed.sql` creates `/t/demo-trip` with 4 of 5 submitted. Coordinator page: `/t/demo-trip/admin?k=demo-admin-riya-2026` (the token is public in the seed file, so use it for testing only). To fire the pipeline, claim **Preethi** and submit.

## Local setup

Requires Node 22+ (LTS).

```bash
npm install
cp .env.example .env.local   # fill in values, or: vercel env pull .env.local
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm run lint
npm run typecheck
npm run test
```

## Environment variables

See `.env.example`. Every secret is server-only. Never give a secret a `NEXT_PUBLIC_` prefix.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Database (secret key, server-side only) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Free-tier AI for candidates, cards and reading prices off Wikivoyage |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Optional (paid). If set, Claude writes the candidates and cards |
| `CRON_SECRET` | Auth for the daily deadline cron |
| `WIKIVOYAGE_USER_AGENT` | Required descriptive User-Agent for the MediaWiki API |
| `NEXT_PUBLIC_APP_URL` | Production URL used in share links |

## Database

1. Create a Supabase project. This one is in Seoul (ap-northeast-2), and `vercel.json` pins the functions to `icn1` to match.
2. In the SQL Editor, run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql` (a demo trip).
3. Check that every table shows RLS enabled.

## Deploy (Vercel Hobby)

1. Import the GitHub repo in Vercel (Next.js preset, default build settings).
2. Add every variable from `.env.example` to Production and Preview. Mark the keys as Sensitive.
3. Deploy, set `NEXT_PUBLIC_APP_URL` to the production domain, then redeploy.
4. `vercel.json` sets a daily cron on `/api/cron/deadlines` (authorised with `CRON_SECRET`). Check that it appears under Settings → Cron Jobs.
5. Share only the **production** domain. Preview URLs sit behind Vercel Authentication.

## Safety

- The hard veto runs in code (`src/lib/logic/veto.ts`, tested) on top of whatever the AI suggests.
- The lock is enforced by Postgres triggers (`supabase/migrations/0001_init.sql`) as well as by server checks.
- One vote per person is a unique constraint.
- There are in-memory rate limits on every action, plus AI-action limits per trip.
- Every input and every AI response is validated with Zod.
- The coordinator key and participant tokens are stored only as SHA-256 hashes, with `Referrer-Policy: no-referrer`.
- No secret reaches the client bundle (checked with a grep of `.next/static`).

## Out of scope (the Cut)

Live flight/hotel prices, availability, booking, scraping, itineraries, accounts, notifications, payments.
