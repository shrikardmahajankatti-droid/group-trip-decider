import "server-only";
import { z } from "zod";
import type { Person } from "@/lib/logic/types";
import type { StoredCostItem, StoredCosts, StoredSource } from "@/lib/pipelineTypes";
import { labelPeople } from "./anon";
import { generateStructured } from "./llm";

// Indicative costs, extracted ONLY from the Wikivoyage text we fetched.
// Free-tier Gemini has no Google Search grounding, so the model reads the page
// text and must quote the exact sentence each price comes from; code then
// checks the quote really is in the page and contains the numbers.

const priceItem = z.object({
  low_inr: z.number().int().min(0).max(500_000),
  high_inr: z.number().int().min(0).max(500_000),
  quote: z.string().min(3).max(400).describe("Exact text copied from the page that states this price"),
});

const destinationCosts = z.object({
  ref: z.string().describe("Destination ref, e.g. D1"),
  travel_one_way: z
    .array(priceItem.extend({ person: z.string().describe("P1, P2, ..."), mode: z.string().max(40) }))
    .describe("One-way fare per person from their starting city, only when the page states it"),
  stay_per_night: priceItem.nullable().describe("Typical budget/mid-range room price per night, or null"),
});
const costsSchema = z.object({ destinations: z.array(destinationCosts) });

const SYSTEM = `You extract travel prices from Wikivoyage text. You do not know any prices yourself.
Rules:
- Use ONLY prices written in the provided page text, in Indian rupees (₹, Rs, INR). Never estimate, convert or infer.
- "quote" must be copied character-for-character from the page text and must contain the number(s).
- travel_one_way: for a person, only if the text states a fare from THEIR starting city (or a clearly named route from it). One-way, per person.
- stay_per_night: a typical budget or mid-range room price per night.
- If a price isn't in the text, leave it out (or null). Missing is fine; invented is not.`;

const normalize = (s: string) => s.replace(/\s+/g, " ").replace(/[’‘]/g, "'").trim().toLowerCase();

const digitsIn = (s: string) => (s.replace(/(\d),(\d)/g, "$1$2").match(/\d+/g) ?? []).map(Number);

/** Code-side check: the quote is really on the page and shows the price in rupees. */
export function quoteSupports(pageText: string, quote: string, low: number, high: number): boolean {
  if (!normalize(pageText).includes(normalize(quote))) return false;
  if (!/₹|\brs\.?|\binr\b/i.test(quote)) return false;
  const nums = digitsIn(quote);
  return nums.includes(low) && nums.includes(high) && low <= high;
}

export type CostTarget = {
  ref: string;
  name: string;
  pageUrl: string;
  getIn: string;
  sleep: string;
};

export async function extractCosts(
  targets: CostTarget[],
  people: Person[],
  nights: number,
): Promise<Map<string, { costs: StoredCosts; sources: StoredSource[] }>> {
  const { label, idOf } = labelPeople(people);
  const withText = targets.filter((t) => t.getIn || t.sleep);
  const out = new Map<string, { costs: StoredCosts; sources: StoredSource[] }>();
  const unavailable = (): { costs: StoredCosts; sources: StoredSource[] } => ({
    costs: { travel: {}, stay: null, status: "unavailable" },
    sources: [],
  });
  for (const t of targets) out.set(t.ref, unavailable());
  if (withText.length === 0) return out;

  const travellers = people
    .filter((p) => p.prefs)
    .map((p) => ({ person: label(p.id), starting_city: p.prefs!.startingCity }));

  const prompt = `Travellers: ${JSON.stringify(travellers)}\n\n${withText
    .map((t) => `=== ${t.ref}: ${t.name} ===\n[GET IN]\n${t.getIn || "(none)"}\n\n[SLEEP]\n${t.sleep || "(none)"}`)
    .join("\n\n")}\n\nReturn {"destinations": [...]} with one entry per ref (${withText.map((t) => t.ref).join(", ")}).`;

  let result: z.infer<typeof costsSchema>;
  try {
    result = await generateStructured({ name: "costs-wikivoyage", schema: costsSchema, system: SYSTEM, prompt });
  } catch (e) {
    console.error(`[costs] extraction failed: ${e instanceof Error ? e.message : e}`);
    return out;
  }

  for (const t of withText) {
    const found = result.destinations.find((d) => d.ref === t.ref);
    if (!found) continue;

    const travel: Record<string, StoredCostItem | null> = {};
    for (const item of found.travel_one_way) {
      const id = idOf(item.person);
      if (!id || travel[id] || !quoteSupports(t.getIn, item.quote, item.low_inr, item.high_inr)) continue;
      travel[id] = {
        low: item.low_inr * 2,
        high: item.high_inr * 2,
        basis: `Return ${item.mode || "fare"} (2 × one-way)`,
        quote: item.quote,
      };
    }

    const s = found.stay_per_night;
    const stay: StoredCostItem | null =
      s && quoteSupports(t.sleep, s.quote, s.low_inr, s.high_inr)
        ? {
            low: Math.round((s.low_inr * nights) / 2),
            high: Math.round((s.high_inr * nights) / 2),
            basis: `Room rate × ${nights} nights ÷ 2 (twin sharing)`,
            quote: s.quote,
          }
        : null;

    const any = stay !== null || Object.keys(travel).length > 0;
    const sources: StoredSource[] = [];
    if (Object.keys(travel).length) sources.push({ label: `Wikivoyage: ${t.name}, Get in`, url: `${t.pageUrl}#Get_in` });
    if (stay) sources.push({ label: `Wikivoyage: ${t.name}, Sleep`, url: `${t.pageUrl}#Sleep` });
    out.set(t.ref, { costs: { travel, stay, status: any ? "wikivoyage" : "unavailable" }, sources });
  }
  return out;
}
