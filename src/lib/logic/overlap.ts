import { MAX_FEASIBLE_WINDOWS } from "./constants";
import { addDays } from "./dates";
import type { Person, TripWindow } from "./types";

export type FeasibleWindow = TripWindow & {
  includedIds: string[];
  excludedIds: string[];
};

/** Does one of the person's ranges fully contain [start, start + nights]? */
export function fitsPerson(ranges: TripWindow[], window: TripWindow): boolean {
  return ranges.some((r) => r.start <= window.start && window.end <= r.end);
}

/**
 * All trip windows of `nights` nights that fall inside everyone's ranges.
 * If no window works for every submitter, return the windows that include
 * the most people, recording who is excluded. People without data are
 * ignored here (they are "no data", not a constraint).
 */
export function feasibleWindows(
  people: Person[],
  nights: number,
  today: string,
  maxResults = MAX_FEASIBLE_WINDOWS,
): { windows: FeasibleWindow[]; fullOverlap: boolean } {
  const submitters = people.filter((p) => p.prefs);
  if (submitters.length === 0) return { windows: [], fullOverlap: false };

  // Every possible check-in date from anyone's ranges.
  const starts = new Set<string>();
  for (const p of submitters) {
    for (const r of p.prefs!.dateWindows) {
      for (let d = r.start < today ? today : r.start; addDays(d, nights) <= r.end; d = addDays(d, 1)) {
        starts.add(d);
      }
    }
  }
  if (starts.size === 0) return { windows: [], fullOverlap: false };

  const scored = [...starts].sort().map((start) => {
    const window = { start, end: addDays(start, nights) };
    const includedIds = submitters.filter((p) => fitsPerson(p.prefs!.dateWindows, window)).map((p) => p.id);
    return { ...window, includedIds };
  });
  const best = Math.max(...scored.map((s) => s.includedIds.length));
  const top = scored.filter((s) => s.includedIds.length === best);

  // Collapse runs of consecutive check-in dates with the same group into
  // non-overlapping windows, so Claude gets distinct date options.
  const result: FeasibleWindow[] = [];
  let lastEnd = "";
  let lastKey = "";
  for (const s of top) {
    const key = s.includedIds.join(",");
    if (key === lastKey && s.start < lastEnd) continue; // overlaps the previous pick
    result.push({
      start: s.start,
      end: s.end,
      includedIds: s.includedIds,
      excludedIds: submitters.filter((p) => !s.includedIds.includes(p.id)).map((p) => p.id),
    });
    lastEnd = s.end;
    lastKey = key;
    if (result.length >= maxResults) break;
  }

  return { windows: result, fullOverlap: best === submitters.length };
}
