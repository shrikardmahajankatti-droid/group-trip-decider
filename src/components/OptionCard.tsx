import type { OptionView } from "@/lib/server/shortlist";
import { formatRange, formatWeather, formatWindow, personCost, placeName } from "@/lib/format";

type Person = { id: string; name: string };

export function OptionCard({
  option,
  people,
  viewerId,
  showAllLines = false,
  children,
}: {
  option: OptionView;
  people: Person[];
  viewerId?: string;
  showAllLines?: boolean;
  children?: React.ReactNode;
}) {
  const { card, candidate: c } = option;
  const d = c.data;
  const lines = card?.where_you_stand ?? {};
  const viewer = viewerId ? people.find((p) => p.id === viewerId) : undefined;
  const others = people.filter((p) => p.id !== viewerId);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="space-y-1 bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-100">Option {option.position}</p>
        <h3 className="text-xl font-bold leading-tight">{card?.title ?? d.name}</h3>
        <p className="text-sm text-indigo-50">
          📍 {placeName(d)} · 📅 {formatWindow(d.suggested_window)}
        </p>
        <p className="text-xs text-indigo-100">🌤 {formatWeather(c.weather)}</p>
      </header>

      <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-1.5" aria-label="Fit for each person (0–100)">
        {people.map((p) => {
          const s = c.scores?.[p.id];
          const total = s && !s.noData ? s.total : null;
          const tone =
            total === null
              ? "bg-slate-100 text-slate-500"
              : total >= 80
                ? "bg-emerald-100 text-emerald-800"
                : total >= 50
                  ? "bg-amber-100 text-amber-800"
                  : "bg-red-100 text-red-800";
          return (
            <span
              key={p.id}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone} ${p.id === viewerId ? "ring-2 ring-indigo-500" : ""}`}
            >
              {p.name} {total === null ? "· no data" : `· ${total}`}
            </span>
          );
        })}
      </div>

      <p className="text-sm">{card?.summary ?? d.rationale}</p>
      {card && (
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-semibold">Why it works</dt>
            <dd className="text-slate-700">{card.why_it_works}</dd>
          </div>
          <div>
            <dt className="font-semibold">Trade-offs</dt>
            <dd className="text-slate-700">{card.trade_offs}</dd>
          </div>
        </dl>
      )}

      <section className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
        <p className="font-semibold">Where you stand</p>
        {viewer && (
          <p className="rounded-lg bg-indigo-50 p-2 text-indigo-900">
            <strong>{viewer.name} (you):</strong> {lines[viewer.id] ?? "—"}
          </p>
        )}
        {showAllLines ? (
          <ul className="space-y-1">
            {others.map((p) => (
              <li key={p.id}>
                <strong>{p.name}:</strong> {lines[p.id] ?? "—"}
              </li>
            ))}
          </ul>
        ) : (
          <details>
            <summary className="cursor-pointer text-slate-600">Everyone else</summary>
            <ul className="mt-1 space-y-1">
              {others.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}:</strong> {lines[p.id] ?? "—"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="space-y-1 text-sm">
        <p className="font-semibold">
          Indicative cost per person{" "}
          <span className="font-normal text-slate-500">· Indicative, check on the day of booking</span>
        </p>
        {c.costs?.status === "wikivoyage" ? (
          <>
            <ul className="text-slate-700">
              {people.map((p) => (
                <li key={p.id}>
                  {p.name}: {c.scores?.[p.id]?.noData ? "no data" : personCost(c.costs, p.id)}
                </li>
              ))}
            </ul>
            {c.costs.stay && (
              <p className="text-xs text-slate-500">
                Stay {formatRange(c.costs.stay.low, c.costs.stay.high)}: {c.costs.stay.basis}.
              </p>
            )}
            <p className="text-xs">
              Sources:{" "}
              {(c.sources ?? []).map((s, i) => (
                <span key={s.url}>
                  {i > 0 && " · "}
                  <a className="text-indigo-700 underline" href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </span>
              ))}
            </p>
          </>
        ) : (
          <p className="text-slate-600">Cost unavailable. No sourced price was found for this destination.</p>
        )}
      </section>

      {c.wikivoyage && (
        <p className="text-xs text-slate-500">
          About {d.name}:{" "}
          <a className="underline" href={c.wikivoyage.url} target="_blank" rel="noopener noreferrer">
            Wikivoyage
          </a>{" "}
          (CC BY-SA)
        </p>
      )}
      {children}
      </div>
    </article>
  );
}
