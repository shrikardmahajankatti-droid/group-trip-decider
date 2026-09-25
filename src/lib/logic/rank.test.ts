import { describe, expect, it } from "vitest";
import { candidate, person } from "./fixtures.test-helpers";
import { evaluateCandidates } from "./rank";

const costs = (travelHigh: number) => ({
  travel: { a: { low: 1000, high: travelHigh }, b: { low: 1000, high: travelHigh } },
  stay: { low: 3000, high: 6000 },
});

describe("evaluateCandidates", () => {
  it("runs the hard veto in code: a vetoed candidate never reaches the shortlist, however well it scores", () => {
    const people = [
      person("a", { destinationTypes: ["Mountains"] }),
      person("b", { destinationTypes: ["Mountains"], wontDo: ["Trekking/Hiking"] }),
    ];
    const perfectButVetoed = candidate("trek", {
      destinationTypes: ["Mountains"],
      attributeTags: ["Trekking/Hiking"],
      costs: costs(2000),
    });
    const ok = candidate("ok", { destinationTypes: ["City"], costs: costs(20000) });

    const res = evaluateCandidates([perfectButVetoed, ok], people);
    expect(res.shortlist).toEqual(["ok"]);
    const trek = res.candidates.find((c) => c.id === "trek")!;
    expect(trek.vetoed).toBe(true);
    expect(trek.vetoReasons).toEqual([{ participantId: "b", name: "b", tag: "Trekking/Hiking" }]);
    expect(trek.rank).toBeNull();
  });

  it("returns an empty shortlist when every candidate is vetoed", () => {
    const people = [person("a", { wontDo: ["Flights"] })];
    const res = evaluateCandidates(
      [candidate("x", { attributeTags: ["Flights"] }), candidate("y", { attributeTags: ["Flights"] })],
      people,
    );
    expect(res.shortlist).toEqual([]);
    expect(res.candidates.every((c) => c.vetoed)).toBe(true);
  });

  it("returns fewer than 3 when fewer survive", () => {
    const res = evaluateCandidates([candidate("x"), candidate("y")], [person("a")]);
    expect(res.shortlist).toEqual(["x", "y"]);
    expect(res.reserve).toEqual([]);
  });

  it("ranks by lowest person's score, then the average", () => {
    const people = [
      person("a", { destinationTypes: ["Beach"] }),
      person("b", { destinationTypes: ["City"] }),
    ];
    // "both": everyone gets type 100. "beach": a=100, b=type 0.
    const both = candidate("both", { destinationTypes: ["Beach", "City"] });
    const beach = candidate("beach", { destinationTypes: ["Beach"] });
    const res = evaluateCandidates([beach, both], people);
    expect(res.shortlist).toEqual(["both", "beach"]);
  });

  it("with equal lowest scores, the higher average wins", () => {
    // b (partial dates, no type match) is the lowest scorer on both, at the
    // same score; only "high" also suits a's type, lifting its average.
    const people = [
      person("a", { destinationTypes: ["Beach"] }),
      person("b", { destinationTypes: ["Mountains"], dateWindows: [{ start: "2026-10-31", end: "2026-11-05" }] }),
    ];
    const low = candidate("low", { destinationTypes: ["City"] }); // a: type 0
    const high = candidate("high", { destinationTypes: ["City", "Beach"] });
    const res = evaluateCandidates([low, high], people);
    const byId = Object.fromEntries(res.candidates.map((c) => [c.id, c]));
    expect(byId.low.minScore).toBe(byId.high.minScore);
    expect(byId.high.avgScore!).toBeGreaterThan(byId.low.avgScore!);
    expect(res.shortlist).toEqual(["high", "low"]);
  });

  it("keeps the AI's order on an exact tie", () => {
    const res = evaluateCandidates([candidate("first"), candidate("second")], [person("a")]);
    expect(res.candidates[0].minScore).toBe(res.candidates[1].minScore);
    expect(res.candidates[0].avgScore).toBe(res.candidates[1].avgScore);
    expect(res.shortlist).toEqual(["first", "second"]);
  });

  it("excludes no-data people from min and average but still reports them", () => {
    const res = evaluateCandidates([candidate("x", { destinationTypes: ["Beach"] })], [person("a"), person("ghost", null)]);
    const x = res.candidates[0];
    expect(x.scores.ghost).toEqual({ noData: true });
    expect(x.minScore).toBe(100);
    expect(x.avgScore).toBe(100);
  });

  it("still ranks when costs are missing (budget null, total rescaled)", () => {
    const res = evaluateCandidates([candidate("x", { costs: null, destinationTypes: ["Beach"] })], [person("a")]);
    const s = res.candidates[0].scores.a;
    expect(s).toEqual({ noData: false, budget: null, dates: 100, type: 100, total: 100 });
    expect(res.shortlist).toEqual(["x"]);
  });

  it("keeps only the top 3 on the shortlist and the rest in reserve, in order", () => {
    const people = [person("a", { destinationTypes: ["Beach"] })];
    const cands = ["c1", "c2", "c3", "c4", "c5"].map((id, i) =>
      candidate(id, { destinationTypes: ["Beach"], costs: costs(2000 + i * 5000) }),
    );
    const res = evaluateCandidates(cands, people);
    expect(res.shortlist).toEqual(["c1", "c2", "c3"]);
    expect(res.reserve).toEqual(["c4", "c5"]);
  });
});
