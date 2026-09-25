import type { PersonScore } from "@/lib/logic/types";

type Col = { id: string; label: string; scores: Record<string, PersonScore> };
type Row = { id: string; name: string };

function tone(total: number) {
  if (total >= 80) return "bg-emerald-50 text-emerald-900";
  if (total >= 50) return "bg-amber-50 text-amber-900";
  return "bg-red-50 text-red-900";
}

/** Rows = people, columns = options, cells = 0–100 fit with the breakdown. */
export function FitMatrix({ rows, cols, highlightId }: { rows: Row[]; cols: Col[]; highlightId?: string }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[20rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="p-3 font-semibold">Fit (0–100)</th>
            {cols.map((c) => (
              <th key={c.id} className="p-3 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-b border-slate-100 last:border-0 ${r.id === highlightId ? "outline-2 -outline-offset-2 outline-indigo-500" : ""}`}
            >
              <th className="p-3 text-left font-medium">
                {r.name}
                {r.id === highlightId ? <span className="ml-1 text-xs text-indigo-600">(you)</span> : null}
              </th>
              {cols.map((c) => {
                const s = c.scores[r.id];
                if (!s || s.noData) {
                  return (
                    <td key={c.id} className="p-3 text-slate-400">
                      no data
                    </td>
                  );
                }
                return (
                  <td key={c.id} className={`p-3 ${tone(s.total)}`}>
                    <div className="text-base font-bold">{s.total}</div>
                    <div className="whitespace-nowrap text-[11px] opacity-80">
                      B {s.budget ?? "–"} · D {s.dates} · T {s.type}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 pb-3 text-[11px] text-slate-500">
        B = budget (40%) · D = dates (40%) · T = trip type (20%). &quot;–&quot; budget means cost unavailable,
        so the score uses dates and type only.
      </p>
    </div>
  );
}
