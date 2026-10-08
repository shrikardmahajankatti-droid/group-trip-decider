import "server-only";
import type { Person } from "@/lib/logic/types";

/**
 * Stable P1..Pn labels so names never leave the app in AI prompts.
 * `relabel` swaps any labels the AI echoed back in its text for real names,
 * in code, after the response arrives.
 */
export function labelPeople(people: Person[]) {
  const toLabel = new Map(people.map((p, i) => [p.id, `P${i + 1}`]));
  const toId = new Map([...toLabel].map(([id, label]) => [label, id]));
  const nameOf = new Map(people.map((p, i) => [`P${i + 1}`, p.name]));
  return {
    label: (id: string) => toLabel.get(id)!,
    idOf: (label: string) => toId.get(label) ?? null,
    relabel: (text: string) => text.replace(/\bP(\d{1,2})\b/g, (m) => nameOf.get(m) ?? m),
  };
}
