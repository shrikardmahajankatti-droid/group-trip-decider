"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { resetDemo } from "@/app/actions/admin";
import { DEMO_ADMIN_KEY, DEMO_SLUG } from "@/lib/demo";
import { PIPELINE_STAGES } from "@/lib/pipelineStages";
import { TripStepper } from "./TripStepper";

type DemoState = {
  exists: boolean;
  status: string;
  submitted: number;
  total: number;
  missing: string[];
  stage: string | null;
  runFailed: boolean;
  vetoed: { name: string; reasons: string[] }[];
  options: { name: string; votes: number }[];
  votes: number;
  locked: string | null;
};

type Guide = {
  stage: string;
  map: string;
  what: React.ReactNode;
  todo: React.ReactNode[];
};

function guideFor(s: DemoState): Guide {
  switch (s.status) {
    case "collecting":
      return {
        stage: "Stage 1 · Collect",
        map: "Riya → Trigger · Friends → Input",
        what: (
          <>
            Riya created the trip and shared <b>one link</b>. {s.submitted} of {s.total} friends have answered
            {s.missing.length ? (
              <>
                ; <b>{s.missing.join(", ")}</b> hasn&apos;t
              </>
            ) : null}
            . The laptop shows names only, never answers.
          </>
        ),
        todo: [
          <>📱 Tap <b>Preethi</b>. No login, the phone remembers her.</>,
          <>Fill in: <b>₹20,000</b> · <b>Chennai</b> · <b>30 Oct → 3 Nov</b> · <b>Beach + Heritage</b>.</>,
          <>Point out: ticked &quot;won&apos;t do&quot;s are enforced, the note is not.</>,
          <>Tap <b>Submit</b>. That&apos;s 5 of 5, so the app fires.</>,
        ],
      };
    case "generating": {
      const i = PIPELINE_STAGES.findIndex((p) => p.id === s.stage);
      return {
        stage: "Stage 2 · Generate",
        map: "Trip App · Gemini · Free data APIs",
        what: <>All answers are in, so the app starts on its own. Both screens tick through the steps (~30 s).</>,
        todo: PIPELINE_STAGES.map((p, k) => (
          <span key={p.id} className={k === i ? "font-semibold text-indigo-700" : k < i ? "text-slate-500 line-through" : ""}>
            {k === i ? "▶ " : ""}
            <b>{p.actor}:</b> {p.label}
          </span>
        )),
      };
    }
    case "review":
      return {
        stage: "Stage 3 · ◆ Review gate",
        map: "Review Gate → Processing (human)",
        what: s.runFailed ? (
          <>Generation failed this time (free AI quota or a timeout). Click <b>Re-run</b> on the laptop.</>
        ) : (
          <>
            Only Riya sees the options. The phone still just says <i>&quot;Riya is reviewing&quot;</i>.
          </>
        ),
        todo: [
          <>💻 Read <b>How these options were made</b>.</>,
          s.vetoed.length ? (
            <>
              Point at the veto: <b>{s.vetoed[0].name}</b> ✗ {s.vetoed[0].reasons.join(", ")}. Removed by code.
            </>
          ) : (
            <>Point out the hard-veto step: anything breaking a &quot;won&apos;t do&quot; is removed in code.</>
          ),
          <>Scroll to the <b>fit matrix</b> and a <b>where you stand</b> line.</>,
          <>Optional: <b>Drop</b> an option, and the next best fills the slot.</>,
          <>Click <b>Publish to group</b>.</>,
        ],
      };
    case "published":
      return {
        stage: "Stage 4 · Vote",
        map: "Friends → Output",
        what: (
          <>
            The phone now shows {s.options.length} options with Preethi&apos;s own row and line highlighted.{" "}
            <b>
              {s.votes} of {s.total}
            </b>{" "}
            voted.
          </>
        ),
        todo: [
          <>📱 Vote. It&apos;s final, so there&apos;s no changing it.</>,
          <>Tap <b>Not you? Switch person</b>, pick <b>Karan</b>, vote again.</>,
          <>💻 Watch the tally update, then <b>Lock this option</b>.</>,
        ],
      };
    case "locked":
      return {
        stage: "Stage 5 · Locked",
        map: "Riya → Output",
        what: (
          <>
            Decided: <b>{s.locked ?? "the winner"}</b>. The database now refuses any edit or vote: 0 reversals.
          </>
        ),
        todo: [
          <>💻 Click <b>Copy WhatsApp message</b>: destination, dates, indicative cost each.</>,
          <>📱 No edit form, no vote buttons anymore.</>,
          <>Press <b>Reset demo</b> before the next take.</>,
        ],
      };
    default:
      return { stage: "Loading…", map: "", what: null, todo: [] };
  }
}

export function DemoStudio({ friendUrl, riyaUrl }: { friendUrl: string; riyaUrl: string }) {
  const [s, setS] = useState<DemoState | null>(null);
  const [frameKey, setFrameKey] = useState({ friend: 0, riya: 0 });
  const [resetting, startReset] = useTransition();
  const prev = useRef<{ status?: string; votes?: number }>({});

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/demo/status", { cache: "no-store" });
        const next = (await res.json()) as DemoState;
        if (!alive) return;
        const p = prev.current;
        // Keep both screens in sync: reload a frame when the trip moves on.
        if (p.status !== undefined && p.status !== next.status) {
          setFrameKey((k) => ({ friend: k.friend + 1, riya: k.riya + 1 }));
        } else if (p.votes !== undefined && p.votes !== next.votes) {
          setFrameKey((k) => ({ ...k, riya: k.riya + 1 }));
        }
        prev.current = { status: next.status, votes: next.votes };
        setS(next);
      } catch {
        // offline for a moment: keep the last state
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const guide = s ? guideFor(s) : null;

  const reset = () =>
    startReset(async () => {
      if (!window.confirm("Reset the demo to the start? Answers after the seed, votes and the lock are cleared.")) return;
      await resetDemo(DEMO_SLUG, DEMO_ADMIN_KEY);
      setFrameKey((k) => ({ friend: k.friend + 1, riya: k.riya + 1 }));
    });

  return (
    <main className="flex-1 bg-slate-100">
      <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 py-5">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm lg:flex-row lg:items-center">
          <div className="lg:w-72">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Demo studio</p>
            <h1 className="text-xl font-bold">College gang trip 2026</h1>
          </div>
          <div className="flex-1">{s && <TripStepper status={s.status} />}</div>
          <button className="btn-secondary lg:w-auto" onClick={reset} disabled={resetting}>
            {resetting ? "Resetting…" : "↺ Reset demo"}
          </button>
        </div>

        {/* Small screens: the studio needs a laptop; offer the two views instead. */}
        <div className="space-y-3 rounded-2xl bg-white p-4 text-sm lg:hidden">
          <p>The demo studio shows a phone and a laptop side by side, so open it on a computer. Or use the two views:</p>
          <div className="grid grid-cols-2 gap-2">
            <a className="btn-primary" href={friendUrl}>📱 Friend&apos;s view</a>
            <a className="btn-secondary" href={riyaUrl}>💻 Riya&apos;s view</a>
          </div>
        </div>

        <div className="hidden gap-5 lg:grid lg:grid-cols-[300px_400px_1fr]">
          {/* Guide */}
          <aside className="space-y-4 self-start rounded-2xl bg-slate-900 p-5 text-white shadow-lg">
            {guide && (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Now</p>
                  <p className="text-xl font-bold">{guide.stage}</p>
                  {guide.map && (
                    <p className="mt-1 inline-block rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                      Components Map: {guide.map}
                    </p>
                  )}
                </div>
                <p className="text-sm text-slate-200">{guide.what}</p>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-300">
                    {s?.status === "generating" ? "Pipeline" : "Do this"}
                  </p>
                  <ol className="space-y-2 text-sm text-slate-100">
                    {guide.todo.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold">
                          {i + 1}
                        </span>
                        <span className="[&_b]:text-white">{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
            <div className="border-t border-white/10 pt-3 text-xs text-slate-400">
              Open a view on its own:{" "}
              <a className="underline" href={friendUrl} target="_blank" rel="noopener noreferrer">
                friend
              </a>{" "}
              ·{" "}
              <a className="underline" href={riyaUrl} target="_blank" rel="noopener noreferrer">
                Riya
              </a>
            </div>
          </aside>

          {/* Phone */}
          <section className="space-y-2">
            <p className="text-center text-sm font-semibold text-slate-600">📱 A friend&apos;s phone (the group link)</p>
            <div className="mx-auto w-[390px] rounded-[2.6rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
              <div className="mx-auto mb-1 h-5 w-28 rounded-b-2xl bg-slate-900" />
              <iframe
                key={`f${frameKey.friend}`}
                src={friendUrl}
                title="Friend's view"
                className="h-[760px] w-full rounded-[1.8rem] bg-white"
              />
            </div>
          </section>

          {/* Laptop */}
          <section className="min-w-0 space-y-2">
            <p className="text-center text-sm font-semibold text-slate-600">💻 Riya&apos;s laptop (coordinator link)</p>
            <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 truncate rounded-md bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
                  group-trip-decider.vercel.app/t/demo-trip/admin
                </span>
              </div>
              <iframe key={`r${frameKey.riya}`} src={riyaUrl} title="Riya's view" className="h-[778px] w-full bg-white" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
