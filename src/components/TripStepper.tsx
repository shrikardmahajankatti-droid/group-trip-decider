const STEPS = [
  { id: "collecting", label: "Collect", hint: "Everyone answers" },
  { id: "generating", label: "Generate", hint: "AI + code build options" },
  { id: "review", label: "Review", hint: "Riya checks privately" },
  { id: "published", label: "Vote", hint: "One vote each" },
  { id: "locked", label: "Locked", hint: "Decided, no changes" },
] as const;

/** Where the trip is right now: ① Collect → ② Generate → ③ Review → ④ Vote → ⑤ Locked. */
export function TripStepper({ status }: { status: string }) {
  const current = STEPS.findIndex((s) => s.id === status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Trip progress">
      {STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "now" : "todo";
        return (
          <li key={s.id} className="flex flex-col gap-1.5" aria-current={state === "now" ? "step" : undefined}>
            <span
              className={`h-1.5 rounded-full ${
                state === "done" ? "bg-emerald-500" : state === "now" ? "bg-indigo-600" : "bg-slate-200"
              }`}
            />
            <span className={`text-[11px] font-semibold leading-tight sm:text-xs ${state === "todo" ? "text-slate-400" : "text-slate-800"}`}>
              {state === "done" ? "✓ " : `${i + 1} · `}
              {s.label}
            </span>
            <span className={`hidden text-[11px] leading-tight sm:block ${state === "now" ? "text-indigo-700" : "text-slate-400"}`}>
              {s.hint}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
