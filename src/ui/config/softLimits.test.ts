import { describe, expect, it } from "vitest";
import type { CacheLevelConfig } from "../../domain/types";
import { getSoftLimitBounds } from "./softLimits";

const levels: CacheLevelConfig[] = [
  {
    id: "L1",
    enabled: true,
    totalSizeBytes: 256,
    blockSizeBytes: 32,
    associativity: 2,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE"
  },
  {
    id: "L2",
    enabled: true,
    totalSizeBytes: 512,
    blockSizeBytes: 64,
    associativity: 2,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE"
  },
  {
    id: "L3",
    enabled: false,
    totalSizeBytes: 1024,
    blockSizeBytes: 64,
    associativity: 4,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE"
  }
];

describe("getSoftLimitBounds", () => {
  it("returns lower bounds from previous enabled level", () => {
    const l2Total = getSoftLimitBounds(levels, "L2", "totalSizeBytes");
    const l2Block = getSoftLimitBounds(levels, "L2", "blockSizeBytes");
    expect(l2Total.minExclusive).toBe(256);
    expect(l2Block.minInclusive).toBe(32);
  });
});
