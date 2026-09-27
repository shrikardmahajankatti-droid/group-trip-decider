import { PIPELINE_STAGES } from "@/lib/pipelineStages";

/** Live view of the generation pipeline (the page auto-refreshes while it runs). */
export function PipelineProgress({ stage }: { stage: string | null }) {
  const current = PIPELINE_STAGES.findIndex((s) => s.id === stage);
  return (
    <section className="card space-y-3 border-indigo-300" aria-live="polite">
      <h2 className="font-semibold">Working out the best options…</h2>
      <ol className="space-y-2">
        {PIPELINE_STAGES.map((s, i) => {
          const state = current === -1 ? (i === 0 ? "active" : "todo") : i < current ? "done" : i === current ? "active" : "todo";
          return (
            <li key={s.id} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  state === "done"
                    ? "bg-emerald-600 text-white"
                    : state === "active"
                      ? "animate-pulse bg-indigo-600 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "todo" ? "text-slate-400" : "text-slate-800"}>
                <span className="font-medium">{s.actor}:</span> {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-slate-500">Usually under a minute. This page updates by itself.</p>
    </section>
  );
}
