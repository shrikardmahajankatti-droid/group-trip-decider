// Shapes stored in the candidates/options JSONB columns, shared by the
// pipeline and the review/results UI.

export type StoredCandidateData = {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  destination_types: string[];
  attribute_tags: string[];
  suggested_window: { start: string; end: string };
  rationale: string;
  wikivoyage_title: string;
};

export type StoredWeather = {
  kind: "forecast" | "last_year";
  /** e.g. "Forecast" or "Typical weather (last year)" */
  label: string;
  from: string;
  to: string;
  avgMinC: number | null;
  avgMaxC: number | null;
  precipitationMm: number | null;
};

export type StoredWikivoyage = {
  title: string;
  url: string;
  intro: string;
  getIn: string;
};

export type StoredCostItem = { low: number; high: number; basis: string; quote: string };

export type StoredCosts = {
  /** Round-trip travel per participant id, or null if not found on the source page. */
  travel: Record<string, StoredCostItem | null>;
  /** Stay per person for the whole trip, or null. */
  stay: StoredCostItem | null;
  /** "wikivoyage" when extracted, "unavailable" when nothing could be sourced. */
  status: "wikivoyage" | "unavailable";
};

export type StoredSource = { label: string; url: string };

export type StoredCard = {
  title: string;
  summary: string;
  why_it_works: string;
  trade_offs: string;
  /** participant id → one-line "where you stand" */
  where_you_stand: Record<string, string>;
};
