# Group Trip Decider

Gets a group of friends to **one destination and one date window**. Everyone submits preferences through one shared link (no login). Once all of them have submitted, or the deadline passes, the app shows **3 trip options** with a per-person fit matrix. The coordinator reviews the options before anyone else sees them, the group votes once, and the coordinator locks the result.

> This gets all five of you to one destination and one set of dates, but it doesn't quote live prices or book anything. Whoever books checks the price on the day.

Spec: `docs/ShrikarAssessment_Riya_Group_Trip_Solution.docx` (Automation Brief, Nine Checks, the Cut, Components Map).

## Stack

Next.js (App Router, TypeScript strict) on Vercel Hobby · Tailwind · Supabase Postgres (server-only access, RLS on, no policies) · Zod · Vitest · Claude (`@anthropic-ai/sdk`) · Gemini with Google Search grounding (`@google/genai`) · Open-Meteo · Wikivoyage.

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
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude: candidates + option cards |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Grounded indicative costs (optional; costs show "unavailable" without it) |
| `CRON_SECRET` | Auth for the daily deadline cron |
| `WIKIVOYAGE_USER_AGENT` | Required descriptive User-Agent for the MediaWiki API |
| `NEXT_PUBLIC_APP_URL` | Production URL used in share links |

## Database

1. Create a Supabase project (region Mumbai).
2. In the SQL Editor, run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql` (a demo trip).
3. Check that every table shows RLS enabled.

## Deploy (Vercel Hobby)

1. Import the GitHub repo in Vercel (Next.js preset, default build settings).
2. Add every variable from `.env.example` to Production and Preview. Mark the keys as Sensitive.
3. Deploy, set `NEXT_PUBLIC_APP_URL` to the production domain, then redeploy.
4. `vercel.json` sets a daily cron on `/api/cron/deadlines` (authorised with `CRON_SECRET`). Check that it appears under Settings → Cron Jobs.
5. Share only the **production** domain. Preview URLs sit behind Vercel Authentication.

## Out of scope (the Cut)

Live flight/hotel prices, availability, booking, scraping, itineraries, accounts, notifications, payments.
