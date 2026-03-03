import { describe, expect, it } from "vitest";
import { deriveGeometry } from "./geometry";

describe("deriveGeometry", () => {
  it("computes sets and bit widths", () => {
    expect(deriveGeometry(256, 16, 2)).toEqual({
      numSets: 8,
      offsetBits: 4,
      indexBits: 3,
    });
  });
});
