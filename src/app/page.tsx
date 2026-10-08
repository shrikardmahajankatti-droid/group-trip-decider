import Link from "next/link";
import { connection } from "next/server";
import { CreateTripForm } from "@/components/CreateTripForm";
import { SiteHeader } from "@/components/SiteHeader";
import { DEMO_ADMIN_KEY, DEMO_SLUG } from "@/lib/demo";
import { defaultDeadlineLocal } from "@/lib/logic/dates";

const STAGES = [
  {
    n: "1",
    title: "Collect",
    fixes: "Fixes the Google Form problem",
    color: "from-amber-500 to-orange-500",
    steps: [
      ["Riya", "Creates the trip and pastes ONE link in WhatsApp."],
      ["Friends", "Each answers in ~3 minutes: budget, dates, city, trip type, hard “won’t do”. No login."],
      ["App", "Waits until all 5 answer or the deadline passes. Nobody sees options early."],
    ],
  },
  {
    n: "2",
    title: "Generate",
    fixes: "~30 seconds, shown live",
    color: "from-indigo-600 to-violet-600",
    steps: [
      ["App", "Finds the dates that fit everyone, the lowest budget, and all hard no’s."],
      ["AI + free data", "Proposes destinations; adds weather (Open-Meteo), info and verified prices (Wikivoyage)."],
      ["App", "Removes anything that breaks a hard no, in code. Scores each person 0–100. Picks the top 3."],
    ],
  },
  {
    n: "3",
    title: "Decide",
    fixes: "Fixes the poll problem",
    color: "from-emerald-500 to-teal-600",
    steps: [
      ["◆ Riya", "Reviews privately: can drop an option or re-run. Then publishes."],
      ["Friends", "See the 3 options and exactly where they stand. Vote once. Votes are final."],
      ["Riya", "Locks the winner and shares a ready WhatsApp message. Nothing can change after."],
    ],
  },
] as const;

const GUARANTEES = [
  ["🙋", "No one is ignored", "Options appear only when all 5 answer or at the deadline. Missing people show as “no data”."],
  ["🚫", "Hard no’s are enforced by code", "Any option breaking someone’s “won’t do” is removed before scoring, whatever the AI says."],
  ["◆", "A human decides", "The tool recommends. Riya approves, the group votes once, Riya locks. Nothing is booked."],
  ["🔒", "0 reversals", "After the lock, the database rejects every edit and vote."],
] as const;

export default async function Home() {
  await connection(); // the default deadline depends on "now"
  const defaultDeadline = defaultDeadlineLocal();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 text-white">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
            <div className="space-y-6">
              <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
                For the friend who always ends up planning
              </p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                Get five friends to one trip.
                <br />
                <span className="text-indigo-200">With one link.</span>
              </h1>
              <p className="max-w-xl text-lg text-indigo-100">
                Everyone answers in 3 minutes. You get 3 options showing exactly where each person stands. The group
                votes once, you lock it, and it&apos;s done.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 font-semibold text-indigo-700 shadow-lg hover:bg-indigo-50"
                >
                  ▶ Watch the live demo
                </Link>
                <a
                  href="#create"
                  className="inline-flex items-center justify-center rounded-xl border border-white/40 px-5 py-3 font-semibold text-white hover:bg-white/10"
                >
                  Create your trip
                </a>
              </div>
            </div>

            <div className="self-center rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
              <p className="text-sm font-semibold text-indigo-100">Riya&apos;s group, before this tool</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  ["3", "months"],
                  ["1,200+", "messages"],
                  ["0", "plans"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-2xl bg-white/10 p-3">
                    <p className="text-2xl font-bold">{v}</p>
                    <p className="text-xs text-indigo-100">{l}</p>
                  </div>
                ))}
              </div>
              <ul className="mt-4 space-y-2 text-sm text-indigo-50">
                <li>📝 Google Form: only <b>3 of 5</b> replied, so the data was useless.</li>
                <li>📊 WhatsApp poll: <b>2 people changed their minds</b> the next day.</li>
                <li>😩 Riya got the blame for a trip only she was trying to plan.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14" id="how">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Three stages. People decide; the app does the reconciling; the AI only suggests and writes.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {STAGES.map((s) => (
              <div key={s.n} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className={`bg-gradient-to-br ${s.color} px-5 py-4 text-white`}>
                  <p className="text-sm font-semibold opacity-90">Stage {s.n}</p>
                  <p className="text-2xl font-bold">{s.title}</p>
                  <p className="text-xs opacity-90">{s.fixes}</p>
                </div>
                <ol className="space-y-3 p-5">
                  {s.steps.map(([who, what]) => (
                    <li key={what} className="text-sm">
                      <span className="mr-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">{who}</span>
                      <span className="text-slate-700">{what}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* Guarantees */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {GUARANTEES.map(([icon, title, text]) => (
              <div key={title} className="space-y-2">
                <p className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg">{icon}</p>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Demo CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="grid gap-6 rounded-3xl bg-slate-900 p-8 text-white md:grid-cols-[1.4fr_1fr] md:items-center">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">See it work in 2 minutes</h2>
              <p className="text-slate-300">
                The demo trip has four friends who already answered. Play Preethi, the last one, and watch the options
                appear. Then be Riya: review, publish, vote and lock. Phone and laptop side by side, with a guide.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/demo" className="rounded-xl bg-indigo-500 px-5 py-3 text-center font-semibold hover:bg-indigo-400">
                ▶ Open the demo studio
              </Link>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Link href={`/t/${DEMO_SLUG}`} className="rounded-xl border border-white/20 px-3 py-2 text-center hover:bg-white/10">
                  Friend&apos;s view
                </Link>
                <Link
                  href={`/t/${DEMO_SLUG}/admin?k=${DEMO_ADMIN_KEY}`}
                  className="rounded-xl border border-white/20 px-3 py-2 text-center hover:bg-white/10"
                >
                  Riya&apos;s view
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Create */}
        <section id="create" className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 md:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Create your trip</h2>
            <p className="text-slate-600">
              Takes a minute. You get one link for the group and a private coordinator link for you. No accounts for
              anyone.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">What it won&apos;t do</p>
              <p className="mt-1">
                No live flight or hotel prices, no availability checks, no booking, no itineraries. Costs are indicative
                and sourced, so whoever books checks the price on the day.
              </p>
            </div>
          </div>
          <CreateTripForm defaultDeadline={defaultDeadline} />
        </section>
      </main>
    </>
  );
}
