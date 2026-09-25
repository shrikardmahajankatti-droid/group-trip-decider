import type { WontDoTag } from "./constants";
import type { CandidateInput, Person, PersonPrefs } from "./types";

export function person(id: string, prefs: Partial<PersonPrefs> | null = {}): Person {
  if (prefs === null) return { id, name: id, prefs: null };
  return {
    id,
    name: id,
    prefs: {
      budgetCapInr: 20000,
      startingCity: "Pune",
      startLat: 18.5,
      startLon: 73.8,
      dateWindows: [{ start: "2026-10-30", end: "2026-11-04" }],
      destinationTypes: ["Beach"],
      wontDo: [] as WontDoTag[],
      wontDoNote: null,
      ...prefs,
    },
  };
}

export function candidate(id: string, over: Partial<CandidateInput> = {}): CandidateInput {
  return {
    id,
    name: id,
    country: "India",
    destinationTypes: ["Heritage/Culture"],
    attributeTags: [],
    window: { start: "2026-10-30", end: "2026-11-02" },
    weather: { avgMinC: 20, avgMaxC: 30, precipitationMm: 0 },
    costs: null,
    ...over,
  };
}
