import { describe, expect, it } from "vitest";
import { buildHeatLookup, textColorFor } from "./heatScale";

describe("buildHeatLookup", () => {
  it("returns a single cold colour when all counts are zero", () => {
    const lookup = buildHeatLookup([0, 0, 0]);
    expect(lookup.uniqueCounts).toEqual([0]);
    // Should be the cold end of the spectrum
    expect(lookup.colorOf(0)).toMatch(/^hsl\(/);
  });

  it("maps two distinct counts to opposite ends of the spectrum", () => {
    const lookup = buildHeatLookup([0, 1, 0, 1]);
    expect(lookup.uniqueCounts).toEqual([0, 1]);
    const cold = lookup.colorOf(0);
    const hot = lookup.colorOf(1);
    expect(cold).not.toBe(hot);
    // Cold should have high lightness (pale), hot should have lower lightness
    expect(cold).toMatch(/92%/);
    expect(hot).toMatch(/48%/);
  });

  it("evenly distributes three distinct counts", () => {
    const lookup = buildHeatLookup([0, 1, 2, 0, 1]);
    expect(lookup.uniqueCounts).toEqual([0, 1, 2]);
    const c0 = lookup.colorOf(0);
    const c1 = lookup.colorOf(1);
    const c2 = lookup.colorOf(2);
    // All three should be different
    expect(new Set([c0, c1, c2]).size).toBe(3);
  });

  it("returns cold colour for unknown count", () => {
    const lookup = buildHeatLookup([0, 1, 2]);
    // A count not present in the data falls back to cold
    expect(lookup.colorOf(99)).toMatch(/92%/);
  });

  it("handles empty input", () => {
    const lookup = buildHeatLookup([]);
    expect(lookup.uniqueCounts).toEqual([]);
    expect(lookup.colorOf(0)).toMatch(/^hsl\(/);
  });
});

describe("textColorFor", () => {
  it("returns dark text for cold cells", () => {
    const lookup = buildHeatLookup([0, 1, 2]);
    expect(textColorFor(0, lookup)).toBe("var(--text)");
  });

  it("returns white text for hot cells", () => {
    const lookup = buildHeatLookup([0, 1, 2]);
    expect(textColorFor(2, lookup)).toBe("#fff");
  });
});
