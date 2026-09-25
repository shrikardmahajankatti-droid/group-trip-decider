import { formatDate } from "./logic/dates";
import type { StoredCosts, StoredWeather } from "./pipelineTypes";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const formatInr = (n: number) => `₹${inr.format(n)}`;

export const formatRange = (low: number, high: number) =>
  low === high ? formatInr(low) : `${formatInr(low)}–${formatInr(high)}`;

export function formatWindow(w: { start: string; end: string }) {
  return `${formatDate(w.start)} → ${formatDate(w.end)}`;
}

export function formatWeather(w: StoredWeather | null): string {
  if (!w || w.avgMinC === null || w.avgMaxC === null) return "Weather unavailable";
  const rain = w.precipitationMm !== null ? `, ${w.precipitationMm} mm rain` : "";
  return `${w.label}: ${Math.round(w.avgMinC)}–${Math.round(w.avgMaxC)}°C${rain}`;
}

/** Per-person indicative total for one participant, or a partial/unknown description. */
export function personCost(costs: StoredCosts | null, participantId: string): string {
  const travel = costs?.travel[participantId] ?? null;
  const stay = costs?.stay ?? null;
  if (travel && stay) return formatRange(travel.low + stay.low, travel.high + stay.high);
  if (stay) return `${formatRange(stay.low, stay.high)} stay + travel (unavailable)`;
  if (travel) return `${formatRange(travel.low, travel.high)} travel + stay (unavailable)`;
  return "cost unavailable";
}

/** "Hampi, Karnataka", or just "Goa" when the region repeats the name. */
export function placeName(d: { name: string; region: string }): string {
  return d.region.trim().toLowerCase() === d.name.trim().toLowerCase() ? d.name : `${d.name}, ${d.region}`;
}
