import type { DateWindow } from "@/lib/schemas";
import type { WontDoTag } from "./constants";

// Plain data shapes for the pure pipeline logic (no DB or network types).

export type PersonPrefs = {
  budgetCapInr: number;
  startingCity: string;
  startLat: number;
  startLon: number;
  dateWindows: DateWindow[];
  destinationTypes: string[];
  wontDo: WontDoTag[];
  wontDoNote: string | null;
};

/** A participant; `prefs` is null when they never submitted ("no data"). */
export type Person = {
  id: string;
  name: string;
  prefs: PersonPrefs | null;
};

/** A trip window: check-in on `start`, check-out on `end` (end - start = nights). */
export type TripWindow = { start: string; end: string };

export type CostRange = { low: number; high: number };

export type CandidateCosts = {
  /** Round-trip travel cost range per participant id; null if unknown. */
  travel: Record<string, CostRange | null>;
  /** Stay cost range per person for the whole trip; null if unknown. */
  stay: CostRange | null;
};

export type WeatherSummary = {
  avgMinC: number | null;
  avgMaxC: number | null;
  precipitationMm: number | null;
};

export type CandidateInput = {
  id: string;
  name: string;
  country: string;
  destinationTypes: string[];
  attributeTags: string[];
  window: TripWindow;
  weather: WeatherSummary | null;
  costs: CandidateCosts | null;
};

export type SubScores = {
  budget: number | null;
  dates: number;
  type: number;
  total: number;
};

export type PersonScore = ({ noData: false } & SubScores) | { noData: true };

export type VetoReason = { participantId: string; name: string; tag: WontDoTag };
