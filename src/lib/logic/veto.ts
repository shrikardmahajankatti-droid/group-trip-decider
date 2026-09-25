import { WONT_DO_TAGS, type WontDoTag } from "./constants";
import type { CandidateInput, Person, VetoReason } from "./types";
import { deriveWeatherTags } from "./weatherTags";

const WONT_DO = new Set<string>(WONT_DO_TAGS);

/**
 * Every tag a candidate carries, for the veto: the AI's attribute tags, plus
 * tags derived in code so the veto never depends on the AI remembering them.
 */
export function candidateTags(c: CandidateInput): WontDoTag[] {
  const tags = new Set<WontDoTag>();
  for (const t of c.attributeTags) if (WONT_DO.has(t)) tags.add(t as WontDoTag);
  for (const t of deriveWeatherTags(c.weather)) tags.add(t);
  if (c.destinationTypes.includes("Beach")) tags.add("Beach");
  if (c.country.trim().toLowerCase() !== "india") tags.add("International travel");
  return [...tags];
}

/** Who vetoes this candidate, and on which tag. Empty = it survives. */
export function vetoReasons(c: CandidateInput, people: Person[]): VetoReason[] {
  const tags = candidateTags(c);
  const reasons: VetoReason[] = [];
  for (const p of people) {
    if (!p.prefs) continue;
    for (const tag of p.prefs.wontDo) {
      if (tags.includes(tag)) reasons.push({ participantId: p.id, name: p.name, tag });
    }
  }
  return reasons;
}
