import { describe, expect, it } from "vitest";
import { initialAppState, reducer } from "../../src/state/reducer";
import { selectCanRunSimulation } from "../../src/state/selectors";

describe("simulation validation blocking", () => {
  it("parse errors block with message: Fix parse errors before running simulation.", () => {
    const parseInvalid = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R nope" },
    });

    const played = reducer(parseInvalid, { type: "PLAY" });

    expect(selectCanRunSimulation(parseInvalid)).toBe(false);
    expect(played.isPlaying).toBe(false);
    expect(played.statusMessage).toBe("Fix parse errors before running simulation.");
  });

  it("config errors block with message: Fix configuration errors to simulate.", () => {
    const invalidConfig = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { blockSizeBytes: 3 },
      },
    });
    const loaded = reducer(invalidConfig, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" },
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
          writeMissPolicy: "WRITE_ALLOCATE",
        },
      },
    });
    const loaded = reducer(warningOnlyConfig, {
      type: "LOAD_TRACE",
      payload: { text: "R 0\nR 0" },
    });
    const played = reducer(loaded, { type: "PLAY" });
    const stepped = reducer(played, { type: "STEP" });

    expect(loaded.validation.errors).toEqual([]);
    expect(loaded.validation.warnings.length).toBeGreaterThan(0);
    expect(selectCanRunSimulation(loaded)).toBe(true);
    expect(played.isPlaying).toBe(true);
    expect(stepped.nextOpIndex).toBe(1);
  });
});
