import type { WontDoTag } from "./constants";
import { feasibleWindows, type FeasibleWindow } from "./overlap";
import type { Person } from "./types";

export type GroupConstraints = {
  submittedIds: string[];
  noDataIds: string[];
  /** The lowest budget cap among submitters (₹ per person, whole trip). */
  budgetFloorInr: number | null;
  /** Union of all hard no's, with who holds each. */
  hardNos: { tag: WontDoTag; participantIds: string[] }[];
  windows: FeasibleWindow[];
  fullOverlap: boolean;
  notes: { participantId: string; note: string }[];
};

export function aggregate(people: Person[], nights: number, today: string): GroupConstraints {
  const submitters = people.filter((p) => p.prefs);

  const byTag = new Map<WontDoTag, string[]>();
  for (const p of submitters) {
    for (const tag of p.prefs!.wontDo) byTag.set(tag, [...(byTag.get(tag) ?? []), p.id]);
  }

  const { windows, fullOverlap } = feasibleWindows(people, nights, today);

  return {
    submittedIds: submitters.map((p) => p.id),
    noDataIds: people.filter((p) => !p.prefs).map((p) => p.id),
    budgetFloorInr: submitters.length
      ? Math.min(...submitters.map((p) => p.prefs!.budgetCapInr))
      : null,
    hardNos: [...byTag.entries()].map(([tag, participantIds]) => ({ tag, participantIds })),
    windows,
    fullOverlap,
    notes: submitters
      .filter((p) => p.prefs!.wontDoNote)
      .map((p) => ({ participantId: p.id, note: p.prefs!.wontDoNote! })),
  };
}
