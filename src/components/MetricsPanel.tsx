import type { Metrics } from "@/lib/server/metrics";

function Tile({ label, value, target, good }: { label: string; value: string; target: string; good: boolean | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${good === null ? "" : good ? "text-emerald-700" : "text-amber-700"}`}>{value}</p>
      <p className="text-[11px] text-slate-500">{target}</p>
    </div>
  );
}

export function MetricsPanel({ m }: { m: Metrics }) {
  const rate = m.total ? Math.round((100 * m.submitted) / m.total) : 0;
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">Success metrics</h2>
      <div className="grid grid-cols-2 gap-2">
        <Tile
          label="Submissions"
          value={`${m.submitted}/${m.total} (${rate}%)`}
          target={
            m.allInAfterHours !== null
              ? `All in after ${m.allInAfterHours}h · target 5/5 within 72h`
              : "Target: 5/5 within 72h"
          }
          good={m.allInAfterHours !== null ? m.allInAfterHours <= 72 : m.submitted === m.total ? true : null}
        />
        <Tile
          label="Days to lock"
          value={m.daysToLock !== null ? `${m.daysToLock}` : `Day ${m.daysSoFar}`}
          target="Target: 7 or fewer"
          good={m.daysToLock !== null ? m.daysToLock <= 7 : m.daysSoFar <= 7 ? null : false}
        />
        <Tile
          label="Reversals after lock"
          value={`${m.reversals}`}
          target={`Enforced by the database${m.blockedAttempts ? ` · ${m.blockedAttempts} attempt(s) blocked` : ""}`}
          good={true}
        />
        <Tile
          label="Lowest fit on winner"
          value={m.lowestFitOnWinner !== null ? `${m.lowestFitOnWinner}/100` : "—"}
          target="Shown once locked"
          good={m.lowestFitOnWinner === null ? null : m.lowestFitOnWinner >= 50}
        />
      </div>
    </section>
  );
}
