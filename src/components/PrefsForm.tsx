"use client";

import { useActionState, useState } from "react";
import { submitPreferences, type SubmitState } from "@/app/actions/participant";
import { DESTINATION_TYPES, WONT_DO_TAGS } from "@/lib/logic/constants";
import { addDays, daysBetween } from "@/lib/logic/dates";
import type { DateWindow } from "@/lib/schemas";
import { CityAutocomplete, type Place } from "./CityAutocomplete";

export type PrefsInitial = {
  budgetCapInr: number;
  startingCity: string;
  startLat: number;
  startLon: number;
  dateWindows: DateWindow[];
  destinationTypes: string[];
  wontDo: string[];
  wontDoNote: string;
} | null;

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function PrefsForm({
  slug,
  tripNights,
  today,
  initial,
  staleWarning,
}: {
  slug: string;
  tripNights: number;
  today: string;
  initial: PrefsInitial;
  staleWarning: boolean;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(
    submitPreferences.bind(null, slug),
    {},
  );

  const [budget, setBudget] = useState(initial ? String(initial.budgetCapInr) : "");
  const [place, setPlace] = useState<Place | null>(
    initial ? { name: initial.startingCity, lat: initial.startLat, lon: initial.startLon } : null,
  );
  const [windows, setWindows] = useState<DateWindow[]>(
    initial?.dateWindows.length ? initial.dateWindows : [{ start: "", end: "" }],
  );
  const [types, setTypes] = useState<string[]>(initial?.destinationTypes ?? []);
  const [wontDo, setWontDo] = useState<string[]>(initial?.wontDo ?? []);
  const [note, setNote] = useState(initial?.wontDoNote ?? "");

  const payload = JSON.stringify({
    budgetCapInr: budget === "" ? undefined : Number(budget),
    startingCity: place?.name ?? "",
    startLat: place?.lat,
    startLon: place?.lon,
    dateWindows: windows.filter((w) => w.start && w.end),
    destinationTypes: types,
    wontDo,
    wontDoNote: note.trim() || undefined,
  });

  const setWindow = (i: number, patch: Partial<DateWindow>) =>
    setWindows((ws) => ws.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      {staleWarning && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Options have already been generated. If you change your answers, the coordinator will be
          asked to re-run them.
        </p>
      )}

      <section className="card space-y-2">
        <label className="label" htmlFor="budget">
          1. Budget cap per person, whole trip (₹)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">₹</span>
          <input
            id="budget"
            className="input pl-7"
            type="number"
            inputMode="numeric"
            min={1000}
            step={500}
            required
            placeholder="20000"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <p className="hint">Travel there and back plus stay, for {tripNights} nights.</p>
      </section>

      <section className="card space-y-2">
        <span className="label">2. Where are you starting from?</span>
        <CityAutocomplete value={place} onChange={setPlace} />
      </section>

      <section className="card space-y-3">
        <span className="label">3. When are you free?</span>
        <p className="hint -mt-2">
          Add every range that works. The trip needs {tripNights} nights ({tripNights + 1} days) inside one range.
        </p>
        {windows.map((w, i) => {
          const short = w.start && w.end && daysBetween(w.start, w.end) < tripNights;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="text-xs text-slate-500" htmlFor={`ws-${i}`}>From</label>
                  <input
                    id={`ws-${i}`}
                    type="date"
                    className="input"
                    min={today}
                    value={w.start}
                    required={i === 0}
                    onChange={(e) =>
                      setWindow(i, {
                        start: e.target.value,
                        end: w.end && w.end >= e.target.value ? w.end : e.target.value ? addDays(e.target.value, tripNights) : "",
                      })
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="text-xs text-slate-500" htmlFor={`we-${i}`}>To</label>
                  <input
                    id={`we-${i}`}
                    type="date"
                    className="input"
                    min={w.start || today}
                    value={w.end}
                    required={i === 0}
                    onChange={(e) => setWindow(i, { end: e.target.value })}
                  />
                </div>
                {windows.length > 1 && (
                  <button
                    type="button"
                    className="btn-secondary px-3"
                    aria-label="Remove this date range"
                    onClick={() => setWindows((ws) => ws.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                )}
              </div>
              {short && (
                <p className="text-xs text-amber-700">
                  This range is shorter than {tripNights} nights, so it can only partly count.
                </p>
              )}
            </div>
          );
        })}
        {windows.length < 6 && (
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => setWindows((ws) => [...ws, { start: "", end: "" }])}
          >
            + Add another date range
          </button>
        )}
      </section>

      <section className="card space-y-2">
        <span className="label">4. What kind of trip? (pick any)</span>
        <div className="flex flex-wrap gap-2">
          {DESTINATION_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                className={`chip ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                onClick={() => setTypes((l) => toggle(l, t))}
              >
                {t}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <span className="label">5. Hard &quot;won&apos;t do&quot;</span>
          <p className="hint -mt-1">
            Any option involving a ticked item is <strong>removed automatically, no exceptions</strong>.
            Only tick real deal-breakers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {WONT_DO_TAGS.map((t) => {
            const on = wontDo.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                className={`chip ${on ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                onClick={() => setWontDo((l) => toggle(l, t))}
              >
                {on ? "✕ " : ""}
                {t}
              </button>
            );
          })}
        </div>
        <div>
          <label className="label" htmlFor="note">Anything else? (optional)</label>
          <textarea
            id="note"
            className="input min-h-20"
            maxLength={500}
            placeholder="e.g. vegetarian food, no long walks"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="hint">
            The coordinator and the AI see this note, but only the ticked boxes above are enforced
            automatically.
          </p>
        </div>
      </section>

      {state.error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.savedAt && !state.error && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          Saved ✓ You can come back and edit until the trip is locked.
        </p>
      )}

      <button className="btn-primary w-full py-3 text-base" disabled={pending}>
        {pending ? "Saving…" : initial ? "Update my answers" : "Submit my answers"}
      </button>
    </form>
  );
}
