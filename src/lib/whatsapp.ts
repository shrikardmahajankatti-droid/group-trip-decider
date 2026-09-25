import { formatWindow, personCost, placeName } from "./format";
import { daysBetween } from "./logic/dates";
import type { StoredCandidateData, StoredCosts } from "./pipelineTypes";

/** The ready-to-paste message Riya posts in the group after locking. */
export function lockMessage(args: {
  tripName: string;
  destination: StoredCandidateData;
  costs: StoredCosts | null;
  people: { id: string; name: string }[];
  url: string;
}): string {
  const { destination: d } = args;
  const nights = daysBetween(d.suggested_window.start, d.suggested_window.end);
  const costLines = args.people.map((p) => `• ${p.name}: ${personCost(args.costs, p.id)}`);
  return [
    `✅ ${args.tripName}: it's decided!`,
    `📍 ${placeName(d)}`,
    `📅 ${formatWindow(d.suggested_window)} (${nights} nights)`,
    ``,
    `💰 Indicative cost per person (check prices on the day of booking):`,
    ...costLines,
    ``,
    `Details: ${args.url}`,
  ].join("\n");
}
