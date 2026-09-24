import { describe, expect, it } from "vitest";
import {
  addDays,
  dateToIstLocal,
  daysBetween,
  isIsoDate,
  istLocalToDate,
  todayIST,
} from "./dates";

describe("dates", () => {
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-10-30")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("30-10-2026")).toBe(false);
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
  it("interprets datetime-local as IST", () => {
    const d = istLocalToDate("2026-09-27T21:00");
    expect(d?.toISOString()).toBe("2026-09-27T15:30:00.000Z");
    expect(dateToIstLocal(d!)).toBe("2026-09-27T21:00");
    expect(istLocalToDate("garbage")).toBeNull();
  });
  it("computes today in IST", () => {
    // 20:00 UTC on Sep 24 is already Sep 25 in IST.
    expect(todayIST(new Date("2026-09-24T20:00:00Z"))).toBe("2026-09-25");
  });
});
