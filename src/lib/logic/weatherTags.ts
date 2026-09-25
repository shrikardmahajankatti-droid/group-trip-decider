import { COLD_THRESHOLD_C, HOT_THRESHOLD_C, type WontDoTag } from "./constants";
import type { WeatherSummary } from "./types";

/** Code-derived weather tags, checked by the veto like any other tag. */
export function deriveWeatherTags(w: WeatherSummary | null): WontDoTag[] {
  if (!w) return [];
  const tags: WontDoTag[] = [];
  if (w.avgMinC !== null && w.avgMinC < COLD_THRESHOLD_C) tags.push("Cold weather (<10°C)");
  if (w.avgMaxC !== null && w.avgMaxC > HOT_THRESHOLD_C) tags.push("Very hot weather (>35°C)");
  return tags;
}
