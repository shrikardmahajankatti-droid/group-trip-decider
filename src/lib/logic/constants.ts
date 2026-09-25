// Fixed vocabularies and scoring weights. Tags are code-enforced by the veto,
// so candidates from Claude must use exactly these strings.

export const DESTINATION_TYPES = [
  "Beach",
  "Mountains",
  "City",
  "Heritage/Culture",
  "Nature/Wildlife",
  "Adventure",
  "Relaxation",
] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const WONT_DO_TAGS = [
  "Flights",
  "Overnight bus/train journeys",
  "Trekking/Hiking",
  "Beach",
  "Cold weather (<10°C)",
  "Very hot weather (>35°C)",
  "International travel",
  "Party/Nightlife-centric",
] as const;
export type WontDoTag = (typeof WONT_DO_TAGS)[number];

export const SCORE_WEIGHTS = { budget: 0.4, dates: 0.4, type: 0.2 } as const;

// Weather veto thresholds. "Cold" = the average daily LOW over the trip window
// is below 10°C; "very hot" = the average daily HIGH is above 35°C. Averages
// (not single extremes) so one chilly night doesn't veto a destination.
export const COLD_THRESHOLD_C = 10;
export const HOT_THRESHOLD_C = 35;

// How many feasible date windows to hand to Claude.
export const MAX_FEASIBLE_WINDOWS = 5;
export const SHORTLIST_SIZE = 3;
