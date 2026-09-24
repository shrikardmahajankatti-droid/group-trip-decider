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

export const COLD_THRESHOLD_C = 10;
export const HOT_THRESHOLD_C = 35;
