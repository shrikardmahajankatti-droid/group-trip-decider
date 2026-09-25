import { SCORE_WEIGHTS } from "./constants";
import { addDays, daysBetween } from "./dates";
import { fitsPerson } from "./overlap";
import type { CandidateInput, CostRange, Person, PersonScore, TripWindow } from "./types";

/**
 * Budget (0–100): 100 if the person's upper total (travel high + stay high)
 * fits their cap, 0 if even the lower total exceeds it, linear in between.
 * null when either cost is unknown.
 */
export function budgetScore(capInr: number, travel: CostRange | null, stay: CostRange | null): number | null {
  if (!travel || !stay) return null;
  const lower = travel.low + stay.low;
  const upper = travel.high + stay.high;
  if (upper <= capInr) return 100;
  if (lower > capInr) return 0;
  return Math.round((100 * (capInr - lower)) / (upper - lower));
}

/**
 * Dates (0–100): 100 if the window sits fully inside one of their ranges,
 * otherwise the share of nights covered by any of their ranges.
 */
export function datesScore(window: TripWindow, ranges: TripWindow[]): number {
  if (fitsPerson(ranges, window)) return 100;
  const nights = daysBetween(window.start, window.end);
  if (nights <= 0) return 0;
  let covered = 0;
  for (let i = 0; i < nights; i++) {
    const night = addDays(window.start, i);
    const morning = addDays(night, 1);
    if (ranges.some((r) => r.start <= night && morning <= r.end)) covered++;
  }
  return Math.round((100 * covered) / nights);
}

/** Type (0–100): 100 if any destination type matches theirs, else 0. */
export function typeScore(candidateTypes: string[], personTypes: string[]): number {
  return candidateTypes.some((t) => personTypes.includes(t)) ? 100 : 0;
}

/**
 * Weighted total. If budget is unknown (no cost data), the remaining weights
 * are rescaled so the total is still 0–100.
 */
export function totalScore(budget: number | null, dates: number, type: number): number {
  const w = SCORE_WEIGHTS;
  if (budget === null) {
    return Math.round((dates * w.dates + type * w.type) / (w.dates + w.type));
  }
  return Math.round(budget * w.budget + dates * w.dates + type * w.type);
}

export function scorePerson(c: CandidateInput, p: Person): PersonScore {
  if (!p.prefs) return { noData: true };
  const budget = budgetScore(p.prefs.budgetCapInr, c.costs?.travel[p.id] ?? null, c.costs?.stay ?? null);
  const dates = datesScore(c.window, p.prefs.dateWindows);
  const type = typeScore(c.destinationTypes, p.prefs.destinationTypes);
  return { noData: false, budget, dates, type, total: totalScore(budget, dates, type) };
}
