import { describe, expect, it } from "vitest";
import { BUILTIN_WORKLOAD_EXAMPLES } from "../workloads/examples";
import { parseWorkload } from "../parser/parseWorkload";
import { initialAppState, reducer } from "./reducer";
import { selectCanRunSimulation } from "./selectors";

describe("app reducer", () => {
  it("loads built-in example trace into editor text and parse preview", () => {
    const example = BUILTIN_WORKLOAD_EXAMPLES[0];

    const state = reducer(initialAppState, {
      type: "LOAD_EXAMPLE_TRACE",
      payload: { exampleId: example.id }
    });

    expect(state.workloadText).toBe(example.text);
    expect(state.parseResult).toEqual(parseWorkload(example.text));
  });

  it("loads parsed trace", () => {
    const text = "R 0\nW 4 7";

    const state = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text }
    });

    expect(state.workloadText).toBe(text);
    expect(state.parseResult).toEqual(parseWorkload(text));
  });

  it("steps one operation", () => {
    const loaded = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" }
    });

    const stepped = reducer(loaded, { type: "STEP" });

    expect(stepped.nextOpIndex).toBe(1);
    expect(stepped.simState.clock).toBe(1);
  });

  it("advances on play tick", () => {
    const loaded = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" }
    });

    const ticked = reducer(loaded, { type: "PLAY_TICK" });

    expect(ticked.nextOpIndex).toBe(1);
    expect(ticked.simState.clock).toBe(1);
  });

  it("pauses playback", () => {
    const paused = reducer(
      { ...initialAppState, isPlaying: true },
      { type: "PAUSE" }
    );

    expect(paused.isPlaying).toBe(false);
  });

  it("starts playback when run is allowed", () => {
    const loaded = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" }
    });

    const played = reducer(loaded, { type: "PLAY" });

    expect(played.isPlaying).toBe(true);
    expect(played.statusMessage).toBeNull();
  });

  it("resets simulation", () => {
    const loaded = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" }
    });
    const stepped = reducer(loaded, { type: "STEP" });

    const reset = reducer(stepped, { type: "RESET" });

    expect(reset.nextOpIndex).toBe(0);
    expect(reset.simState.clock).toBe(0);
    expect(reset.isPlaying).toBe(false);
  });

  it("updates config and revalidates", () => {
    const errored = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { blockSizeBytes: 3 }
      }
    });

    expect(errored.validation.errors.length).toBeGreaterThan(0);

    const warned = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: {
          writeHitPolicy: "WRITE_THROUGH",
          writeMissPolicy: "WRITE_ALLOCATE"
        }
      }
    });

    expect(warned.validation.errors).toEqual([]);
    expect(warned.validation.warnings.length).toBeGreaterThan(0);
  });

  it("updates writeHitPolicy per level without mutating other levels", () => {
    const previousL1 = initialAppState.configLevels[0];
    const previousL2 = initialAppState.configLevels[1];

    const updated = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { writeHitPolicy: "WRITE_THROUGH" }
      }
    });

    expect(updated.configLevels[0].writeHitPolicy).toBe("WRITE_THROUGH");
    expect(updated.configLevels[0].writeMissPolicy).toBe(
      previousL1.writeMissPolicy
    );
    expect(updated.configLevels[1]).toBe(previousL2);
  });

  it("updates writeMissPolicy per level without mutating other levels", () => {
    const previousL1 = initialAppState.configLevels[0];
    const previousL2 = initialAppState.configLevels[1];

    const updated = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { writeMissPolicy: "WRITE_NO_ALLOCATE" }
      }
    });

    expect(updated.configLevels[0].writeMissPolicy).toBe("WRITE_NO_ALLOCATE");
    expect(updated.configLevels[0].writeHitPolicy).toBe(
      previousL1.writeHitPolicy
    );
    expect(updated.configLevels[1]).toBe(previousL2);
  });

  it("keeps at least one level enabled when toggling config", () => {
    const onlyL1Enabled = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: { enabled: false }
      }
    });

    const onlyL1 = reducer(onlyL1Enabled, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L3",
        patch: { enabled: false }
      }
    });

    const attemptedDisableLast = reducer(onlyL1, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { enabled: false }
      }
    });

    expect(
      attemptedDisableLast.configLevels.find((level) => level.id === "L1")
        ?.enabled
    ).toBe(true);
    expect(attemptedDisableLast.validation.errors).toEqual([]);
  });

  it("applies direct request actions through simulateStep", () => {
    const state = reducer(initialAppState, {
      type: "SUBMIT_REQUEST",
      payload: {
        request: { kind: "W", address: 9, value: 22 }
      }
    });

    expect(state.simState.clock).toBe(1);
    expect(state.simState.stats.writes).toBe(1);
    expect(state.simState.events.some((event) => event.address === 9)).toBe(
      true
    );
  });

  it("blocks STEP and PLAY_TICK when parseResult.errors.length > 0", () => {
    const invalid = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R nope" }
    });

    const stepped = reducer(invalid, { type: "STEP" });
    const ticked = reducer(invalid, { type: "PLAY_TICK" });

    expect(stepped.nextOpIndex).toBe(0);
    expect(stepped.statusMessage).toBe(
      "Fix parse errors before running simulation."
    );
    expect(ticked.nextOpIndex).toBe(0);
    expect(ticked.statusMessage).toBe(
      "Fix parse errors before running simulation."
    );
  });

  it("blocks STEP and PLAY_TICK when validation.errors.length > 0", () => {
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

    const stepped = reducer(loaded, { type: "STEP" });
    const ticked = reducer(loaded, { type: "PLAY_TICK" });

    expect(loaded.validation.errors.length).toBeGreaterThan(0);
    expect(stepped.nextOpIndex).toBe(0);
    expect(stepped.statusMessage).toBe("Fix configuration errors to simulate.");
    expect(ticked.nextOpIndex).toBe(0);
    expect(ticked.statusMessage).toBe("Fix configuration errors to simulate.");
  });

  it("blocks PLAY when parse errors exist", () => {
    const invalid = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R nope" }
    });

    const played = reducer({ ...invalid, isPlaying: true }, { type: "PLAY" });

    expect(played.isPlaying).toBe(false);
    expect(played.statusMessage).toBe(
      "Fix parse errors before running simulation."
    );
  });

  it("blocks PLAY when configuration errors exist", () => {
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

    const played = reducer({ ...loaded, isPlaying: true }, { type: "PLAY" });

    expect(played.isPlaying).toBe(false);
    expect(played.statusMessage).toBe("Fix configuration errors to simulate.");
  });

  it("allows STEP and PLAY_TICK when only warnings exist", () => {
    const warned = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: {
          writeHitPolicy: "WRITE_THROUGH",
          writeMissPolicy: "WRITE_ALLOCATE"
        }
      }
    });
    const loaded = reducer(warned, {
      type: "LOAD_TRACE",
      payload: { text: "R 0\nR 0" }
    });

    const stepped = reducer(loaded, { type: "STEP" });
    const ticked = reducer(stepped, { type: "PLAY_TICK" });

    expect(loaded.validation.errors).toEqual([]);
    expect(loaded.validation.warnings.length).toBeGreaterThan(0);
    expect(ticked.nextOpIndex).toBe(2);
  });

  it("allows PLAY when only warnings exist", () => {
    const warned = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: {
          writeHitPolicy: "WRITE_THROUGH",
          writeMissPolicy: "WRITE_ALLOCATE"
        }
      }
    });
    const loaded = reducer(warned, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" }
    });

    const played = reducer(loaded, { type: "PLAY" });

    expect(loaded.validation.errors).toEqual([]);
    expect(loaded.validation.warnings.length).toBeGreaterThan(0);
    expect(played.isPlaying).toBe(true);
    expect(played.statusMessage).toBeNull();
  });

  it("computes run eligibility from parse and config errors deterministically", () => {
    const parseInvalid = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R nope" }
    });
    const configInvalid = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { blockSizeBytes: 3 }
      }
    });
    const warningOnly = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: {
          writeHitPolicy: "WRITE_THROUGH",
          writeMissPolicy: "WRITE_ALLOCATE"
        }
      }
    });

    expect(selectCanRunSimulation(parseInvalid)).toBe(false);
    expect(selectCanRunSimulation(configInvalid)).toBe(false);
    expect(selectCanRunSimulation(warningOnly)).toBe(true);
  });

  it("preserves user-selected cross-level invalid total size during UPDATE_CONFIG", () => {
    // L1 default is 256, L2 default is 512. Set L1 to 1024 (> L2 512) → L2 should NOT be auto-corrected.
    const updated = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { totalSizeBytes: 1024 }
      }
    });

    const l1 = updated.configLevels.find((level) => level.id === "L1");
    const l2 = updated.configLevels.find((level) => level.id === "L2");

    expect(l1).toBeDefined();
    expect(l2).toBeDefined();
    // Reducer no longer auto-corrects L2; it stays at 512
    expect(l1!.totalSizeBytes).toBe(1024);
    expect(l2!.totalSizeBytes).toBe(512);
    expect(updated.validation.errors).toContainEqual(
      expect.objectContaining({ code: "HIERARCHY_MONOTONICITY" })
    );
  });

  it("preserves user-selected cross-level invalid block size during UPDATE_CONFIG", () => {
    // L1 default blockSize is 16. Set L2 blockSize to 8 (< L1 16) → L2 should NOT be auto-corrected.
    const updated = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: { blockSizeBytes: 8 }
      }
    });

    const l1 = updated.configLevels.find((level) => level.id === "L1");
    const l2 = updated.configLevels.find((level) => level.id === "L2");

    expect(l1).toBeDefined();
    expect(l2).toBeDefined();
    // Reducer preserves the invalid value rather than coercing
    expect(l2!.blockSizeBytes).toBe(8);
    expect(updated.validation.errors).toContainEqual(
      expect.objectContaining({ code: "BLOCK_SIZE_MONOTONICITY" })
    );
  });
});
