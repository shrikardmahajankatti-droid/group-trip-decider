import "server-only";
import { z } from "zod";
import type { Person, PersonScore } from "@/lib/logic/types";
import type { StoredCandidateData, StoredCard, StoredCosts, StoredWeather, StoredWikivoyage } from "@/lib/pipelineTypes";
import { labelPeople } from "./anon";
import { generateStructured } from "./llm";

const cardSchema = z.object({
  ref: z.string(),
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(700).describe("2 to 4 sentences"),
  why_it_works: z.string().min(1).max(500),
  trade_offs: z.string().min(1).max(500),
  where_you_stand: z
    .array(z.object({ person: z.string(), line: z.string().min(1).max(200) }))
    .describe("One line per person listed in the input, addressed to them"),
});
const step2Schema = z.object({ cards: z.array(cardSchema).min(1).max(3) });

const SYSTEM = `You write short, honest trip-option cards for a group of friends deciding together.
Rules:
- For each option: a title, a 2 to 4 sentence summary, why it works for the group, and the trade-offs.
- where_you_stand: exactly one line per person in "people", written to them in second person, grounded ONLY in their own fit data (e.g. "Fits your dates; about ₹2,000 over your cap at the high end" or "Only 2 of 3 nights fall in your free dates").
- Never invent prices. Only mention a rupee amount if that exact figure (or a rounding of it) is in the input, and say what it covers (e.g. "stay for the whole trip"). If costs are unknown, say so briefly.
- People are labelled P1, P2, ...; use "you", never names. Plain, friendly, no hype.`;

export type CardInput = {
  ref: string;
  data: StoredCandidateData;
  weather: StoredWeather | null;
  wikivoyage: StoredWikivoyage | null;
  costs: StoredCosts | null;
  scores: Record<string, PersonScore>;
};

const MONEY = /(?:₹|\bRs\.?|\bINR)\s?([\d,]+(?:\.\d+)?)\s?(k|K|lakh|L)?/g;

function amountsIn(text: string): number[] {
  return [...text.matchAll(MONEY)].map((m) => {
    const n = Number(m[1].replace(/,/g, ""));
    const unit = m[2]?.toLowerCase();
    return unit === "k" ? n * 1000 : unit === "lakh" || unit === "l" ? n * 100_000 : n;
  });
}

function numbersIn(value: unknown, acc: number[] = []): number[] {
  if (typeof value === "number") acc.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, acc));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, acc));
  return acc;
}

/** Rupee amounts in the output that don't match (±10%) any number we supplied. */
export function inventedAmounts(texts: string[], allowed: number[]): number[] {
  return texts
    .flatMap(amountsIn)
    .filter((a) => a >= 100 && !allowed.some((n) => n > 0 && Math.abs(a - n) <= n * 0.1));
}

export async function writeCards(options: CardInput[], people: Person[]): Promise<Map<string, StoredCard>> {
  const { label, idOf } = labelPeople(people);
  const submitters = people.filter((p) => p.prefs);

  const input = options.map((o) => ({
    ref: o.ref,
    destination: `${o.data.name}, ${o.data.region}`,
    dates: o.data.suggested_window,
    types: o.data.destination_types,
    involves: o.data.attribute_tags,
    why_suggested: o.data.rationale,
    weather: o.weather && {
      label: o.weather.label,
      avg_low_c: o.weather.avgMinC,
      avg_high_c: o.weather.avgMaxC,
      rain_mm: o.weather.precipitationMm,
    },
    about: o.wikivoyage?.intro.slice(0, 600) ?? null,
    stay_per_person_whole_trip_inr: o.costs?.stay ? { low: o.costs.stay.low, high: o.costs.stay.high } : "unknown",
    people: submitters.map((p) => {
      const s = o.scores[p.id];
      const travel = o.costs?.travel[p.id] ?? null;
      const stay = o.costs?.stay ?? null;
      const totalLow = travel && stay ? travel.low + stay.low : null;
      const totalHigh = travel && stay ? travel.high + stay.high : null;
      return {
        who: label(p.id),
        fit_score_0_100: s && !s.noData ? s.total : null,
        budget_score: s && !s.noData ? s.budget : null,
        dates_score: s && !s.noData ? s.dates : null,
        type_match: s && !s.noData ? s.type === 100 : null,
        budget_cap_inr: p.prefs!.budgetCapInr,
        est_trip_total_per_person_inr: totalLow !== null ? { low: totalLow, high: totalHigh } : "unknown",
        over_cap_at_high_end_inr: totalHigh !== null ? Math.max(0, totalHigh - p.prefs!.budgetCapInr) : null,
        starting_city: p.prefs!.startingCity,
        likes: p.prefs!.destinationTypes,
      };
    }),
  }));

  const allowed = numbersIn(input);
  const expected = submitters.map((p) => label(p.id));

  const result = await generateStructured({
    name: "step2-cards",
    schema: step2Schema,
    system: SYSTEM,
    prompt: `Options (JSON):\n${JSON.stringify(input, null, 2)}\n\nReturn {"cards": [...]} with one card per ref (${options.map((o) => o.ref).join(", ")}).`,
    validate: (v) => {
      for (const o of options) {
        const card = v.cards.find((c) => c.ref === o.ref);
        if (!card) return `missing card for ${o.ref}`;
        const who = new Set(card.where_you_stand.map((w) => w.person));
        const missing = expected.filter((e) => !who.has(e));
        if (missing.length) return `card ${o.ref} is missing where_you_stand for ${missing.join(", ")}`;
      }
      const texts = v.cards.flatMap((c) => [c.summary, c.why_it_works, c.trade_offs, ...c.where_you_stand.map((w) => w.line)]);
      const bad = inventedAmounts(texts, allowed);
      return bad.length ? `these rupee amounts are not in the input: ${bad.join(", ")}. Remove them.` : null;
    },
  });

  const out = new Map<string, StoredCard>();
  for (const c of result.cards) {
    const lines: Record<string, string> = {};
    for (const w of c.where_you_stand) {
      const id = idOf(w.person);
      if (id) lines[id] = w.line;
    }
    for (const p of people) if (!p.prefs) lines[p.id] = "No data: didn't submit preferences before the deadline.";
    out.set(c.ref, {
      title: c.title,
      summary: c.summary,
      why_it_works: c.why_it_works,
      trade_offs: c.trade_offs,
      where_you_stand: lines,
    });
  }
  return out;
}
