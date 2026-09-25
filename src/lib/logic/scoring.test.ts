import { describe, expect, it } from "vitest";
import { candidate, person } from "./fixtures.test-helpers";
import { budgetScore, datesScore, scorePerson, totalScore, typeScore } from "./scoring";

describe("budgetScore", () => {
  it("is 100 when the upper total fits the cap", () => {
    expect(budgetScore(20000, { low: 4000, high: 8000 }, { low: 6000, high: 12000 })).toBe(100);
  });
  it("is 0 when even the lower total exceeds the cap", () => {
    expect(budgetScore(9000, { low: 4000, high: 8000 }, { low: 6000, high: 12000 })).toBe(0);
  });
  it("is linear in between", () => {
    // lower 10k, upper 20k, cap 15k → halfway
    expect(budgetScore(15000, { low: 4000, high: 8000 }, { low: 6000, high: 12000 })).toBe(50);
    expect(budgetScore(10000, { low: 4000, high: 8000 }, { low: 6000, high: 12000 })).toBe(0);
  });
  it("is null when any cost is missing", () => {
    expect(budgetScore(15000, null, { low: 1, high: 2 })).toBeNull();
    expect(budgetScore(15000, { low: 1, high: 2 }, null)).toBeNull();
  });
});

describe("datesScore", () => {
  const w = { start: "2026-10-30", end: "2026-11-02" }; // 3 nights
  it("is 100 when the window sits inside one range", () => {
    expect(datesScore(w, [{ start: "2026-10-29", end: "2026-11-05" }])).toBe(100);
  });
  it("is the share of nights covered otherwise", () => {
    expect(datesScore(w, [{ start: "2026-10-31", end: "2026-11-05" }])).toBe(67); // 2 of 3
    expect(datesScore(w, [{ start: "2026-12-01", end: "2026-12-05" }])).toBe(0);
  });
  it("counts nights across two adjacent ranges", () => {
    expect(
      datesScore(w, [
        { start: "2026-10-30", end: "2026-10-31" },
        { start: "2026-10-31", end: "2026-11-02" },
      ]),
    ).toBe(100);
  });
});

describe("typeScore and totalScore", () => {
  it("type is 100 on any match, else 0", () => {
    expect(typeScore(["Beach", "City"], ["City"])).toBe(100);
    expect(typeScore(["Mountains"], ["Beach"])).toBe(0);
  });
  it("weights 40/40/20", () => {
    expect(totalScore(100, 100, 100)).toBe(100);
    expect(totalScore(50, 100, 0)).toBe(60);
  });
  it("rescales dates/type when budget is unknown", () => {
    expect(totalScore(null, 100, 0)).toBe(67);
    expect(totalScore(null, 100, 100)).toBe(100);
  });
});

describe("scorePerson", () => {
  it("marks no-data participants", () => {
    expect(scorePerson(candidate("x"), person("ghost", null))).toEqual({ noData: true });
  });
  it("uses per-person travel and shared stay costs", () => {
    const c = candidate("goa", {
      destinationTypes: ["Beach"],
      costs: { travel: { a: { low: 3000, high: 6000 } }, stay: { low: 5000, high: 9000 } },
    });
    expect(scorePerson(c, person("a", { budgetCapInr: 20000 }))).toEqual({
      noData: false,
      budget: 100,
      dates: 100,
      type: 100,
      total: 100,
    });
  });
});
