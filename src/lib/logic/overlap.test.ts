import { describe, expect, it } from "vitest";
import { aggregate } from "./aggregate";
import { person } from "./fixtures.test-helpers";
import { feasibleWindows } from "./overlap";

const TODAY = "2026-09-25";

describe("feasibleWindows", () => {
  it("finds the window that fits everyone (seed data)", () => {
    const people = [
      person("riya", { dateWindows: [{ start: "2026-10-29", end: "2026-11-08" }, { start: "2026-11-19", end: "2026-11-23" }] }),
      person("sid", { dateWindows: [{ start: "2026-10-30", end: "2026-11-03" }, { start: "2026-11-20", end: "2026-11-24" }] }),
      person("karan", { dateWindows: [{ start: "2026-10-30", end: "2026-11-02" }, { start: "2026-11-19", end: "2026-11-25" }] }),
      person("aisha", { dateWindows: [{ start: "2026-10-30", end: "2026-11-04" }] }),
    ];
    const { windows, fullOverlap } = feasibleWindows(people, 3, TODAY);
    expect(fullOverlap).toBe(true);
    expect(windows).toEqual([
      { start: "2026-10-30", end: "2026-11-02", includedIds: ["riya", "sid", "karan", "aisha"], excludedIds: [] },
    ]);
  });

  it("with no overlap for everyone, returns the windows with the most people and who is excluded", () => {
    const people = [
      person("a", { dateWindows: [{ start: "2026-11-01", end: "2026-11-05" }] }),
      person("b", { dateWindows: [{ start: "2026-11-01", end: "2026-11-05" }] }),
      person("c", { dateWindows: [{ start: "2026-12-10", end: "2026-12-14" }] }),
    ];
    const { windows, fullOverlap } = feasibleWindows(people, 3, TODAY);
    expect(fullOverlap).toBe(false);
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.includedIds).toEqual(["a", "b"]);
      expect(w.excludedIds).toEqual(["c"]);
    }
    expect(windows[0]).toMatchObject({ start: "2026-11-01", end: "2026-11-04" });
  });

  it("ignores no-data participants", () => {
    const people = [person("a"), person("ghost", null)];
    const { windows, fullOverlap } = feasibleWindows(people, 3, TODAY);
    expect(fullOverlap).toBe(true);
    expect(windows[0].includedIds).toEqual(["a"]);
    expect(windows[0].excludedIds).toEqual([]);
  });

  it("returns nothing when no range is long enough", () => {
    const people = [person("a", { dateWindows: [{ start: "2026-11-01", end: "2026-11-02" }] })];
    expect(feasibleWindows(people, 3, TODAY)).toEqual({ windows: [], fullOverlap: false });
  });

  it("never proposes a check-in before today", () => {
    const people = [person("a", { dateWindows: [{ start: "2026-09-20", end: "2026-09-30" }] })];
    const { windows } = feasibleWindows(people, 3, TODAY);
    expect(windows.every((w) => w.start >= TODAY)).toBe(true);
  });

  it("offers distinct, non-overlapping windows from one long range", () => {
    const people = [person("a", { dateWindows: [{ start: "2026-11-01", end: "2026-11-20" }] })];
    const { windows } = feasibleWindows(people, 3, TODAY, 5);
    expect(windows.map((w) => w.start)).toEqual(["2026-11-01", "2026-11-04", "2026-11-07", "2026-11-10", "2026-11-13"]);
  });
});

describe("aggregate", () => {
  it("computes budget floor, hard-no union with holders, no-data and notes", () => {
    const people = [
      person("riya", { budgetCapInr: 25000 }),
      person("sid", { budgetCapInr: 15000, wontDo: ["Flights"] }),
      person("aisha", { budgetCapInr: 20000, wontDo: ["Flights", "Trekking/Hiking"], wontDoNote: "vegetarian" }),
      person("preethi", null),
    ];
    const g = aggregate(people, 3, TODAY);
    expect(g.budgetFloorInr).toBe(15000);
    expect(g.noDataIds).toEqual(["preethi"]);
    expect(g.submittedIds).toEqual(["riya", "sid", "aisha"]);
    expect(g.hardNos).toEqual([
      { tag: "Flights", participantIds: ["sid", "aisha"] },
      { tag: "Trekking/Hiking", participantIds: ["aisha"] },
    ]);
    expect(g.notes).toEqual([{ participantId: "aisha", note: "vegetarian" }]);
  });

  it("handles a trip where nobody submitted", () => {
    const g = aggregate([person("a", null)], 3, TODAY);
    expect(g.budgetFloorInr).toBeNull();
    expect(g.windows).toEqual([]);
  });
});
