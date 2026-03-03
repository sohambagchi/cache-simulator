import { describe, expect, it } from "vitest";
import { initialAppState, reducer } from "../../src/state/reducer";
import { selectCanRunSimulation } from "../../src/state/selectors";

describe("simulation validation blocking", () => {
  it("parse errors block with message: Fix parse errors before running simulation.", () => {
    const parseInvalid = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R nope" }
    });

    const played = reducer(parseInvalid, { type: "PLAY" });

    expect(selectCanRunSimulation(parseInvalid)).toBe(false);
    expect(played.isPlaying).toBe(false);
    expect(played.statusMessage).toBe(
      "Fix parse errors before running simulation."
    );
  });

  it("config errors block with message: Fix configuration errors to simulate.", () => {
    const invalidConfig = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { blockSizeBytes: 3 }
      }
    });
    const loaded = reducer(invalidConfig, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" }
    });

    const played = reducer(loaded, { type: "PLAY" });

    expect(loaded.validation.errors.length).toBeGreaterThan(0);
    expect(selectCanRunSimulation(loaded)).toBe(false);
    expect(played.isPlaying).toBe(false);
    expect(played.statusMessage).toBe("Fix configuration errors to simulate.");
  });

  it("warning-only states remain runnable", () => {
    const warningOnlyConfig = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: {
          writeHitPolicy: "WRITE_THROUGH",
          writeMissPolicy: "WRITE_ALLOCATE"
        }
      }
    });
    const loaded = reducer(warningOnlyConfig, {
      type: "LOAD_TRACE",
      payload: { text: "R 0\nR 0" }
    });
    const played = reducer(loaded, { type: "PLAY" });
    const stepped = reducer(played, { type: "STEP" });

    expect(loaded.validation.errors).toEqual([]);
    expect(loaded.validation.warnings.length).toBeGreaterThan(0);
    expect(selectCanRunSimulation(loaded)).toBe(true);
    expect(played.isPlaying).toBe(true);
    expect(stepped.nextOpIndex).toBe(1);
  });

  it("re-enables run flow after correcting slider-driven invalid hierarchy", () => {
    // Drive into invalid state: set L1 totalSize > L2 totalSize
    const withL1LargerTotal = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { totalSizeBytes: 1024 }
      }
    });

    // L2 is 512 by default, so L1=1024 > L2=512 → invalid
    expect(selectCanRunSimulation(withL1LargerTotal)).toBe(false);
    expect(withL1LargerTotal.validation.errors).toContainEqual(
      expect.objectContaining({ code: "HIERARCHY_MONOTONICITY" })
    );

    // Correct by setting L2 totalSize above L1
    const corrected = reducer(withL1LargerTotal, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: { totalSizeBytes: 2048 }
      }
    });

    expect(selectCanRunSimulation(corrected)).toBe(true);
    expect(corrected.validation.errors).toEqual([]);
  });

  it("re-enables run flow after correcting slider-driven invalid block size", () => {
    // Drive into invalid state: set L2 blockSize < L1 blockSize
    // initialAppState L1 blockSizeBytes=16
    const withInvalidBlockSize = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: { blockSizeBytes: 8 }
      }
    });

    expect(selectCanRunSimulation(withInvalidBlockSize)).toBe(false);
    expect(withInvalidBlockSize.validation.errors).toContainEqual(
      expect.objectContaining({ code: "BLOCK_SIZE_MONOTONICITY" })
    );

    // Correct by setting L2 blockSize >= L1 blockSize
    const corrected = reducer(withInvalidBlockSize, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: { blockSizeBytes: 16 }
      }
    });

    expect(selectCanRunSimulation(corrected)).toBe(true);
    expect(corrected.validation.errors).toEqual([]);
  });
});
