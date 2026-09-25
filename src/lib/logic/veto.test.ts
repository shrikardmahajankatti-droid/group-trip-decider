import { describe, expect, it } from "vitest";
import { candidate, person } from "./fixtures.test-helpers";
import { candidateTags, vetoReasons } from "./veto";
import { deriveWeatherTags } from "./weatherTags";

describe("deriveWeatherTags", () => {
  it("flags cold and very hot windows from average lows/highs", () => {
    expect(deriveWeatherTags({ avgMinC: 4, avgMaxC: 15, precipitationMm: 0 })).toEqual(["Cold weather (<10°C)"]);
    expect(deriveWeatherTags({ avgMinC: 28, avgMaxC: 41, precipitationMm: 0 })).toEqual(["Very hot weather (>35°C)"]);
    expect(deriveWeatherTags({ avgMinC: 18, avgMaxC: 30, precipitationMm: 0 })).toEqual([]);
    expect(deriveWeatherTags({ avgMinC: 10, avgMaxC: 35, precipitationMm: 0 })).toEqual([]);
    expect(deriveWeatherTags(null)).toEqual([]);
  });
});

describe("veto", () => {
  it("vetoes on an AI attribute tag and records who and why", () => {
    const c = candidate("hampta", { attributeTags: ["Trekking/Hiking"] });
    const people = [person("aisha", { wontDo: ["Trekking/Hiking"] }), person("karan")];
    expect(vetoReasons(c, people)).toEqual([{ participantId: "aisha", name: "aisha", tag: "Trekking/Hiking" }]);
  });

  it("vetoes on code-derived weather even when the AI said nothing", () => {
    const c = candidate("spiti", { attributeTags: [], weather: { avgMinC: -2, avgMaxC: 8, precipitationMm: 0 } });
    expect(vetoReasons(c, [person("sid", { wontDo: ["Cold weather (<10°C)"] })])).toHaveLength(1);
  });

  it("adds Beach and International travel in code, not trusting the AI", () => {
    const c = candidate("bali", { country: "Indonesia", destinationTypes: ["Beach"], attributeTags: [] });
    expect(candidateTags(c).sort()).toEqual(["Beach", "International travel"]);
    expect(vetoReasons(c, [person("a", { wontDo: ["International travel"] })])).toHaveLength(1);
  });

  it("ignores tags outside the fixed vocabulary", () => {
    const c = candidate("x", { attributeTags: ["Scuba", "Flights"] });
    expect(candidateTags(c)).toEqual(["Flights"]);
  });

  it("people with no data cannot veto", () => {
    const c = candidate("x", { attributeTags: ["Flights"] });
    expect(vetoReasons(c, [person("ghost", null)])).toEqual([]);
  });
});
