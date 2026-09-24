import { describe, expect, it } from "vitest";
import { SCORE_WEIGHTS, WONT_DO_TAGS } from "./constants";

describe("constants", () => {
  it("score weights sum to 1", () => {
    const sum = SCORE_WEIGHTS.budget + SCORE_WEIGHTS.dates + SCORE_WEIGHTS.type;
    expect(sum).toBeCloseTo(1);
  });
  it("has 8 won't-do tags", () => {
    expect(WONT_DO_TAGS).toHaveLength(8);
  });
});
