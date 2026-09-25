import { describe, expect, it } from "vitest";
import { lockMessage } from "./whatsapp";

describe("lockMessage", () => {
  it("includes destination, dates, per-person indicative cost and the link", () => {
    const msg = lockMessage({
      tripName: "College gang trip",
      destination: {
        name: "Hampi",
        region: "Karnataka",
        country: "India",
        lat: 15.3,
        lon: 76.4,
        destination_types: ["Heritage/Culture"],
        attribute_tags: [],
        suggested_window: { start: "2026-10-30", end: "2026-11-02" },
        rationale: "",
        wikivoyage_title: "Hampi",
      },
      costs: {
        status: "wikivoyage",
        travel: { a: { low: 1300, high: 1800, basis: "", quote: "" } },
        stay: { low: 1800, high: 3000, basis: "", quote: "" },
      },
      people: [
        { id: "a", name: "Riya" },
        { id: "b", name: "Karan" },
      ],
      url: "https://example.com/t/x",
    });
    expect(msg).toContain("Hampi, Karnataka");
    expect(msg).toContain("(3 nights)");
    expect(msg).toContain("• Riya: ₹3,100–₹4,800");
    expect(msg).toContain("• Karan: ₹1,800–₹3,000 stay + travel (unavailable)");
    expect(msg).toContain("check prices on the day of booking");
    expect(msg).toContain("https://example.com/t/x");
  });
});
