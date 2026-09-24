"use client";

import { useEffect, useId, useState } from "react";

export type Place = { name: string; lat: number; lon: number };

type GeoResult = {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  admin1?: string;
  population?: number;
};

function label(r: GeoResult) {
  if (r.country_code === "IN") return r.admin1 ? `${r.name}, ${r.admin1}` : r.name;
  return [r.name, r.admin1, r.country].filter(Boolean).join(", ");
}

/** Open-Meteo geocoding (no key), India first. */
export function CityAutocomplete({
  value,
  onChange,
}: {
  value: Place | null;
  onChange: (p: Place | null) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || value?.name === query) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.searchParams.set("name", q);
        url.searchParams.set("count", "10");
        url.searchParams.set("language", "en");
        url.searchParams.set("format", "json");
        const res = await fetch(url, { signal: ctrl.signal });
        const json = (await res.json()) as { results?: GeoResult[] };
        const sorted = (json.results ?? []).sort(
          (a, b) =>
            Number(b.country_code === "IN") - Number(a.country_code === "IN") ||
            (b.population ?? 0) - (a.population ?? 0),
        );
        setResults(sorted.slice(0, 6).map((r) => ({ name: label(r), lat: r.latitude, lon: r.longitude })));
        setOpen(true);
      } catch {
        // aborted or offline: keep the previous suggestions
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, value?.name]);

  return (
    <div className="relative">
      <input
        className="input"
        value={query}
        placeholder="Start typing, e.g. Pune"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange(null);
          if (e.target.value.trim().length < 2) setResults([]);
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {loading && <span className="absolute right-3 top-3 text-xs text-slate-400">…</span>}
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {results.map((r) => (
            <li key={`${r.name}-${r.lat}-${r.lon}`}>
              <button
                type="button"
                role="option"
                aria-selected={value?.name === r.name}
                className="block w-full px-3 py-2.5 text-left text-sm hover:bg-indigo-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(r);
                  setQuery(r.name);
                  setOpen(false);
                }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        {value ? `✓ ${value.name}` : "Pick your city from the suggestions."}
      </p>
    </div>
  );
}
