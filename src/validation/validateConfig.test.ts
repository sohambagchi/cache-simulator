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
  it("requires at least one enabled cache level", () => {
    const result = validateConfig([
      createLevel({ id: "L1", enabled: false }),
      createLevel({ id: "L2", enabled: false }),
      createLevel({ id: "L3", enabled: false }),
    ]);

    expect(result.errors).toContainEqual({
      code: "ACTIVE_LEVELS_MIN",
      levelId: "L1",
      message: "At least one cache level must be enabled",
    });
  });

  it("returns no errors or warnings for valid monotonic hierarchy", () => {
    const result = validateConfig([
      createLevel({ id: "L1", totalSizeBytes: 1024, blockSizeBytes: 64, associativity: 2 }),
      createLevel({ id: "L2", totalSizeBytes: 4096, blockSizeBytes: 64, associativity: 4 }),
      createLevel({ id: "L3", totalSizeBytes: 16384, blockSizeBytes: 128, associativity: 8 }),
    ]);

    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it("validates hierarchy using canonical L1 -> L2 -> L3 order", () => {
    const canonical = [
      createLevel({ id: "L1", totalSizeBytes: 1024, blockSizeBytes: 64, associativity: 2 }),
      createLevel({ id: "L2", totalSizeBytes: 4096, blockSizeBytes: 64, associativity: 4 }),
      createLevel({ id: "L3", totalSizeBytes: 2048, blockSizeBytes: 128, associativity: 8 }),
    ];
    const unsorted = [canonical[1], canonical[0], canonical[2]];

    expect(validateConfig(unsorted)).toEqual(validateConfig(canonical));
  });

  it("emits GEOMETRY_INCONSISTENT for enabled levels with non-power-of-two fields", () => {
    const result = validateConfig([
      createLevel({ id: "L1", blockSizeBytes: 24, associativity: 3, totalSizeBytes: 192 }),
    ]);

    expect(result.errors).toEqual([
      {
        code: "GEOMETRY_INCONSISTENT",
        levelId: "L1",
        message: "L1: blockSizeBytes must be a positive power of two",
      },
      {
        code: "GEOMETRY_INCONSISTENT",
        levelId: "L1",
        message: "L1: associativity must be a positive power of two",
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("avoids cascading geometry errors when blockSizeBytes is invalid", () => {
    const result = validateConfig([
      createLevel({ id: "L1", totalSizeBytes: 1536, blockSizeBytes: 24, associativity: 4 }),
    ]);

    expect(result.errors).toEqual([
      {
        code: "GEOMETRY_INCONSISTENT",
        levelId: "L1",
        message: "L1: blockSizeBytes must be a positive power of two",
      },
    ]);
  });

  it("avoids cascading geometry errors when associativity is invalid", () => {
    const result = validateConfig([
      createLevel({ id: "L1", totalSizeBytes: 1536, blockSizeBytes: 64, associativity: 3 }),
    ]);

    expect(result.errors).toEqual([
      {
        code: "GEOMETRY_INCONSISTENT",
        levelId: "L1",
        message: "L1: associativity must be a positive power of two",
      },
    ]);
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
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        message: "L2: blockSizeBytes must be greater than or equal to L1.blockSizeBytes",
      }),
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

    expect(result.errors).toEqual([
      {
        code: "ACTIVE_LEVELS_MIN",
        levelId: "L1",
        message: "At least one cache level must be enabled",
      },
    ]);
    expect(result.warnings).toEqual([]);
  });
});
