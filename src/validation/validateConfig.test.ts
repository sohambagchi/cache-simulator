import { describe, expect, it } from "vitest";
import type { CacheLevelConfig } from "../domain/types";
import { validateConfig } from "./validateConfig";

function createLevel(overrides: Partial<CacheLevelConfig>): CacheLevelConfig {
  return {
    id: "L1",
    enabled: true,
    totalSizeBytes: 1024,
    blockSizeBytes: 64,
    associativity: 2,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE",
    ...overrides,
  };
}

describe("validateConfig", () => {
  it("returns no errors or warnings for valid monotonic hierarchy", () => {
    const result = validateConfig([
      createLevel({ id: "L1", totalSizeBytes: 1024, blockSizeBytes: 64, associativity: 2 }),
      createLevel({ id: "L2", totalSizeBytes: 4096, blockSizeBytes: 64, associativity: 4 }),
      createLevel({ id: "L3", totalSizeBytes: 16384, blockSizeBytes: 128, associativity: 8 }),
    ]);

    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it("emits GEOMETRY_INCONSISTENT for enabled levels with non-power-of-two fields", () => {
    const result = validateConfig([
      createLevel({ id: "L1", blockSizeBytes: 24, associativity: 3, totalSizeBytes: 192 }),
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "GEOMETRY_INCONSISTENT", levelId: "L1" }),
    );
    expect(result.warnings).toEqual([]);
  });

  it("emits GEOMETRY_INCONSISTENT for non-integer derived numSets", () => {
    const result = validateConfig([
      createLevel({ id: "L1", totalSizeBytes: 1536, blockSizeBytes: 64, associativity: 4 }),
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "GEOMETRY_INCONSISTENT", levelId: "L1" }),
    );
  });

  it("emits HIERARCHY_MONOTONICITY when next enabled level is not larger", () => {
    const result = validateConfig([
      createLevel({ id: "L1", totalSizeBytes: 4096, blockSizeBytes: 64, associativity: 4 }),
      createLevel({ id: "L2", totalSizeBytes: 2048, blockSizeBytes: 64, associativity: 4 }),
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "HIERARCHY_MONOTONICITY", levelId: "L2" }),
    );
  });

  it("emits BLOCK_SIZE_MONOTONICITY when next enabled level has smaller block size", () => {
    const result = validateConfig([
      createLevel({ id: "L1", totalSizeBytes: 1024, blockSizeBytes: 64, associativity: 2 }),
      createLevel({ id: "L2", totalSizeBytes: 4096, blockSizeBytes: 32, associativity: 4 }),
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "BLOCK_SIZE_MONOTONICITY", levelId: "L2" }),
    );
  });

  it("emits NON_STANDARD_POLICY warning for WRITE_BACK + WRITE_NO_ALLOCATE", () => {
    const result = validateConfig([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_NO_ALLOCATE",
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "NON_STANDARD_POLICY", levelId: "L1" }),
    );
  });

  it("keeps WRITE_THROUGH + WRITE_ALLOCATE as warning-only", () => {
    const result = validateConfig([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_THROUGH",
        writeMissPolicy: "WRITE_ALLOCATE",
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "NON_STANDARD_POLICY", levelId: "L1" }),
    );
  });

  it("skips disabled levels for hard-validation checks", () => {
    const result = validateConfig([
      createLevel({ id: "L1", enabled: false, totalSizeBytes: 1536, blockSizeBytes: 24, associativity: 3 }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
