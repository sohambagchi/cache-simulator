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

  it("throws for non-positive total size", () => {
    expect(() => deriveGeometry(0, 16, 2)).toThrow(
      "totalSizeBytes must be a positive integer",
    );
  });

  it("throws when total size is not divisible by block size", () => {
    expect(() => deriveGeometry(250, 16, 2)).toThrow(
      "totalSizeBytes must be divisible by blockSizeBytes",
    );
  });

  it("throws when block size is not a power of two", () => {
    expect(() => deriveGeometry(240, 24, 2)).toThrow(
      "blockSizeBytes must be a power of two",
    );
  });

  it("throws when derived numSets is not a power of two", () => {
    expect(() => deriveGeometry(96, 16, 2)).toThrow(
      "derived numSets must be a power of two",
    );
  });

  it("throws for large non-power-of-two block size that overflows 32-bit bitwise checks", () => {
    const largeNonPowerOfTwoBlockSize = 3 * 2 ** 32;

    expect(() =>
      deriveGeometry(largeNonPowerOfTwoBlockSize, largeNonPowerOfTwoBlockSize, 1),
    ).toThrow("blockSizeBytes must be a power of two");
  });

  it("throws for large non-power-of-two numSets that overflows 32-bit bitwise checks", () => {
    const largeNonPowerOfTwoNumSets = 3 * 2 ** 32;

    expect(() => deriveGeometry(largeNonPowerOfTwoNumSets, 1, 1)).toThrow(
      "derived numSets must be a power of two",
    );
  });
});
