import "server-only";
import type { Person } from "@/lib/logic/types";

/** Stable P1..Pn labels so names never leave the app in AI prompts. */
export function labelPeople(people: Person[]) {
  const toLabel = new Map(people.map((p, i) => [p.id, `P${i + 1}`]));
  const toId = new Map([...toLabel].map(([id, label]) => [label, id]));
  return { label: (id: string) => toLabel.get(id)!, idOf: (label: string) => toId.get(label) ?? null };
}
