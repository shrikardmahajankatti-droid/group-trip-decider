import "server-only";
import { z } from "zod";
import type { GroupConstraints } from "@/lib/logic/aggregate";
import { DESTINATION_TYPES, WONT_DO_TAGS } from "@/lib/logic/constants";
import { daysBetween } from "@/lib/logic/dates";
import type { Person, TripWindow } from "@/lib/logic/types";
import type { StoredCandidateData } from "@/lib/pipelineTypes";
import { isoDate } from "@/lib/schemas";
import { labelPeople } from "./anon";
import { generateStructured } from "./llm";

const candidateSchema = z.object({
  name: z.string().min(1).max(80),
  region: z.string().min(1).max(80).describe("State or region"),
  country: z.string().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  destination_types: z.array(z.enum(DESTINATION_TYPES)).min(1),
  attribute_tags: z
    .array(z.enum(WONT_DO_TAGS))
    .describe("Every hard-no tag this trip would involve for a typical traveller"),
  suggested_window: z.object({ start: isoDate, end: isoDate }),
  rationale: z.string().min(1).max(400),
  wikivoyage_title: z.string().min(1).max(80).describe("Exact English Wikivoyage article title"),
});
const step1Schema = z.object({ candidates: z.array(candidateSchema).min(6).max(8) });

const SYSTEM = `You shortlist group-trip destinations for friends in India.
Rules:
- Propose 6 to 8 distinct destinations that best fit the GROUP constraints.
- Default to destinations in India. Suggest international only if nobody has "International travel" as a hard no AND the budget floor realistically covers it.
- attribute_tags must honestly list every hard-no tag the trip involves, using only the given vocabulary:
  "Flights" = no practical way to get there without flying from most starting cities;
  "Overnight bus/train journeys" = typically reached by overnight bus/train;
  "Trekking/Hiking" = the main experience needs trekking or hiking;
  "Beach" = a beach destination; "Party/Nightlife-centric" = known mainly for partying;
  "Cold weather (<10°C)" / "Very hot weather (>35°C)" = typical for the suggested dates;
  "International travel" = outside India.
  Tagging honestly matters: code removes any destination that matches someone's hard no, so a missing tag only wastes a slot.
- Avoid destinations that clearly break the group's hard no's; prefer ones that fit the budget floor (per person, whole trip, travel + stay).
- suggested_window must be copied exactly from the list of feasible windows.
- People are labelled P1, P2, ...; never invent names. Do not quote prices.`;

export async function proposeCandidates(
  people: Person[],
  constraints: GroupConstraints,
  nights: number,
): Promise<StoredCandidateData[]> {
  const { label } = labelPeople(people);
  const windows: TripWindow[] = constraints.windows.map((w) => ({ start: w.start, end: w.end }));

  const input = {
    trip_nights: nights,
    budget_floor_inr_per_person: constraints.budgetFloorInr,
    feasible_windows: constraints.windows.map((w) => ({
      start: w.start,
      end: w.end,
      works_for: w.includedIds.map(label),
      excludes: w.excludedIds.map(label),
    })),
    everyone_free_in_window: constraints.fullOverlap,
    hard_nos: constraints.hardNos.map((h) => ({ tag: h.tag, held_by: h.participantIds.map(label) })),
    people: people
      .filter((p) => p.prefs)
      .map((p) => ({
        who: label(p.id),
        starting_city: p.prefs!.startingCity,
        budget_cap_inr: p.prefs!.budgetCapInr,
        likes: p.prefs!.destinationTypes,
      })),
    no_data: constraints.noDataIds.map(label),
    free_text_constraints: constraints.notes.map((n) => ({ who: label(n.participantId), note: n.note })),
  };

  const result = await generateStructured({
    name: "step1-candidates",
    schema: step1Schema,
    system: SYSTEM,
    prompt: `Group constraints (JSON):\n${JSON.stringify(input, null, 2)}\n\nReturn {"candidates": [...]} with 6 to 8 destinations.`,
  });

  // Enforce in code: the window must be one of the feasible windows. Snap
  // anything else to the nearest feasible window.
  return result.candidates.map((c) => {
    const exact = windows.find((w) => w.start === c.suggested_window.start && w.end === c.suggested_window.end);
    const nearest =
      exact ??
      [...windows].sort(
        (a, b) =>
          Math.abs(daysBetween(a.start, c.suggested_window.start)) -
          Math.abs(daysBetween(b.start, c.suggested_window.start)),
      )[0];
    return { ...c, suggested_window: nearest };
  });
}
