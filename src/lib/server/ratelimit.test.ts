import { describe, expect, it } from "vitest";
import { hit } from "./ratelimit";

describe("hit (sliding window)", () => {
  it("allows up to the limit, then blocks until the window passes", () => {
    const t0 = 1_000_000;
    expect(hit("t:a", 2, 60_000, t0)).toBe(true);
    expect(hit("t:a", 2, 60_000, t0 + 1)).toBe(true);
    expect(hit("t:a", 2, 60_000, t0 + 2)).toBe(false);
    expect(hit("t:a", 2, 60_000, t0 + 60_001)).toBe(true);
  });
  it("keeps keys independent", () => {
    expect(hit("t:b", 1, 60_000, 5)).toBe(true);
    expect(hit("t:c", 1, 60_000, 5)).toBe(true);
    expect(hit("t:b", 1, 60_000, 6)).toBe(false);
  });
});
