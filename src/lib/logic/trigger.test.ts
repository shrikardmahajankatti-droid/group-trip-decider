import { describe, expect, it } from "vitest";
import { shouldTrigger } from "./trigger";

const deadline = new Date("2026-09-27T15:30:00Z");

describe("shouldTrigger", () => {
  it("fires when everyone has submitted before the deadline", () => {
    expect(
      shouldTrigger({ submittedCount: 5, participantCount: 5, deadline, now: new Date("2026-09-25T00:00:00Z") }),
    ).toBe(true);
  });
  it("waits while people are missing and the deadline is ahead", () => {
    expect(
      shouldTrigger({ submittedCount: 3, participantCount: 5, deadline, now: new Date("2026-09-25T00:00:00Z") }),
    ).toBe(false);
  });
  it("fires at the deadline even with missing people", () => {
    expect(shouldTrigger({ submittedCount: 3, participantCount: 5, deadline, now: deadline })).toBe(true);
  });
  it("never fires for an empty trip before the deadline", () => {
    expect(
      shouldTrigger({ submittedCount: 0, participantCount: 0, deadline, now: new Date("2026-09-25T00:00:00Z") }),
    ).toBe(false);
  });
});
