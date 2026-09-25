import { describe, expect, it } from "vitest";
import { quoteSupports } from "./costs";
import { inventedAmounts } from "./step2Cards";
import { cleanWikitext } from "./wikivoyage";

const PAGE = `KSRTC runs Airavat buses from Bengaluru to Hampi (₹650–900, 8 hr).
Stay: {{sleep | name=Gopi Guest House | price=Rooms ₹1,200-2,000}}`;

describe("quoteSupports (costs are only accepted if the page really says so)", () => {
  it("accepts a verbatim quote containing both numbers in rupees", () => {
    expect(quoteSupports(PAGE, "buses from Bengaluru to Hampi (₹650–900, 8 hr)", 650, 900)).toBe(true);
    expect(quoteSupports(PAGE, "price=Rooms ₹1,200-2,000", 1200, 2000)).toBe(true);
  });
  it("rejects a quote that isn't on the page", () => {
    expect(quoteSupports(PAGE, "flights from Delhi ₹4,500", 4500, 4500)).toBe(false);
  });
  it("rejects numbers the quote doesn't contain", () => {
    expect(quoteSupports(PAGE, "buses from Bengaluru to Hampi (₹650–900, 8 hr)", 500, 900)).toBe(false);
  });
  it("rejects non-rupee prices", () => {
    expect(quoteSupports("Rooms from US$30-50", "Rooms from US$30-50", 30, 50)).toBe(false);
  });
});

describe("inventedAmounts (the AI may not invent prices)", () => {
  const allowed = [18000, 22000, 2000, 15000];
  it("allows amounts we supplied, including roundings", () => {
    expect(inventedAmounts(["About ₹2k over your cap", "Total ₹18,000–22,000"], allowed)).toEqual([]);
    expect(inventedAmounts(["roughly Rs 21,500"], allowed)).toEqual([]);
  });
  it("flags amounts that weren't in the input", () => {
    expect(inventedAmounts(["Flights cost ₹7,500"], allowed)).toEqual([7500]);
    expect(inventedAmounts(["a ₹1 lakh splurge"], allowed)).toEqual([100000]);
  });
  it("ignores text without rupee amounts", () => {
    expect(inventedAmounts(["3 nights, 22°C"], allowed)).toEqual([]);
  });
});

describe("cleanWikitext", () => {
  it("keeps link labels and drops markup", () => {
    expect(cleanWikitext("Take a [[Karnataka|KSRTC]] bus from [[Bengaluru]]. <!-- note -->'''Fast'''")).toBe(
      "Take a KSRTC bus from Bengaluru. Fast",
    );
  });
});
