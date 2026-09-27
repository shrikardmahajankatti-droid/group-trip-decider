import { formatInr } from "@/lib/format";
import type { RunTrace } from "@/lib/pipelineTypes";

const secs = (ms?: number) => (ms ? `${(ms / 1000).toFixed(1)}s` : "–");

/** How the shortlist was produced, step by step (matches the Components Map). */
export function PipelineTrace({ trace }: { trace: RunTrace }) {
  const ai = trace.provider === "claude" ? "Claude" : "Gemini";
  const steps: { who: string; what: React.ReactNode; ms?: number }[] = [
    {
      who: "Trip App",
      what: (
        <>
          Aggregated {trace.submitted} submission{trace.submitted === 1 ? "" : "s"}
          {trace.noData ? ` (${trace.noData} no data)` : ""}: {trace.windows} date window
          {trace.windows === 1 ? "" : "s"}
          {trace.fullOverlap ? " that fit everyone" : " (best partial overlap)"}, budget floor{" "}
          {trace.budgetFloorInr !== null ? formatInr(trace.budgetFloorInr) : "–"}, {trace.hardNos} hard no
          {trace.hardNos === 1 ? "" : "'s"}.
        </>
      ),
      ms: trace.ms.aggregate,
    },
    {
      who: `${ai} · step 1`,
      what: <>Proposed {trace.candidates} candidate destinations{trace.models.step1 ? ` (${trace.models.step1})` : ""}.</>,
      ms: trace.ms.step1,
    },
    {
      who: "Open-Meteo · Wikivoyage",
      what: (
        <>
          Weather for {trace.weatherOk}/{trace.candidates}, destination info for {trace.wikivoyageOk}/{trace.candidates}.
        </>
      ),
      ms: trace.ms.context,
    },
    {
      who: `${ai} + code check`,
      what: (
        <>
          Sourced indicative costs for {trace.costsSourced}/{trace.candidates} from Wikivoyage (every price verified
          against the page; the rest show &quot;cost unavailable&quot;).
        </>
      ),
      ms: trace.ms.costs,
    },
    {
      who: "Trip App · hard veto",
      what:
        trace.vetoed.length === 0 ? (
          <>No candidate broke a hard &quot;won&apos;t do&quot;. Scored and ranked {trace.survivors}.</>
        ) : (
          <>
            Removed {trace.vetoed.length} in code:{" "}
            {trace.vetoed.map((v, i) => (
              <span key={v.name}>
                {i > 0 && "; "}
                <strong>{v.name}</strong> ✗ {v.reasons.join(", ")}
              </span>
            ))}
            . Scored every person × {trace.survivors} survivors 0–100 and ranked by the lowest person&apos;s score.
          </>
        ),
      ms: trace.ms.scoring,
    },
    {
      who: `${ai} · step 2`,
      what: (
        <>
          Wrote {trace.shortlisted} option card{trace.shortlisted === 1 ? "" : "s"} with a &quot;where you stand&quot; line
          per person{trace.models.step2 ? ` (${trace.models.step2})` : ""}.
        </>
      ),
      ms: trace.ms.step2,
    },
  ];

  return (
    <details className="card" open>
      <summary className="cursor-pointer font-semibold">
        How these options were made <span className="font-normal text-slate-500">· {secs(trace.totalMs)} total</span>
      </summary>
      <ol className="mt-3 space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
              {i + 1}
            </span>
            <span>
              <span className="font-semibold">{s.who}</span>{" "}
              <span className="text-xs text-slate-500">{secs(s.ms)}</span>
              <br />
              <span className="text-slate-700">{s.what}</span>
            </span>
          </li>
        ))}
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
            ◆
          </span>
          <span className="text-slate-700">
            <span className="font-semibold">You (review gate):</span> nothing reaches the group until you publish.
          </span>
        </li>
      </ol>
    </details>
  );
}
