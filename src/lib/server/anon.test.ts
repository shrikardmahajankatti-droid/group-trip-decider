import { describe, expect, it } from "vitest";
import { labelPeople } from "./anon";

const people = [
  { id: "a", name: "Riya", prefs: null },
  { id: "b", name: "Aisha", prefs: null },
];

describe("labelPeople", () => {
  it("maps ids to P-labels and back", () => {
    const { label, idOf } = labelPeople(people);
    expect(label("b")).toBe("P2");
    expect(idOf("P2")).toBe("b");
  });
  it("replaces labels the AI echoed back with real names", () => {
    const { relabel } = labelPeople(people);
    expect(relabel("Rocky paths might be hard on P2's knee; P1 will love it.")).toBe(
      "Rocky paths might be hard on Aisha's knee; Riya will love it.",
    );
    expect(relabel("Platform P10 and MP3 stay as they are")).toBe("Platform P10 and MP3 stay as they are");
  });
});
