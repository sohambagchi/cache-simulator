import { describe, expect, it } from "vitest";
import { BUILTIN_WORKLOAD_EXAMPLES } from "../workloads/examples";
import { parseWorkload } from "../parser/parseWorkload";
import { initialAppState, reducer } from "./reducer";

describe("app reducer", () => {
  it("loads built-in example trace into editor text and parse preview", () => {
    const example = BUILTIN_WORKLOAD_EXAMPLES[0];

    const state = reducer(initialAppState, {
      type: "LOAD_EXAMPLE_TRACE",
      payload: { exampleId: example.id },
    });

    expect(state.workloadText).toBe(example.text);
    expect(state.parseResult).toEqual(parseWorkload(example.text));
  });

  it("loads parsed trace", () => {
    const text = "R 0\nW 4 7";

    const state = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text },
    });

    expect(state.workloadText).toBe(text);
    expect(state.parseResult).toEqual(parseWorkload(text));
  });

  it("steps one operation", () => {
    const loaded = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" },
    });

    const stepped = reducer(loaded, { type: "STEP" });

    expect(stepped.nextOpIndex).toBe(1);
    expect(stepped.simState.clock).toBe(1);
  });

  it("advances on play tick", () => {
    const loaded = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" },
    });

    const ticked = reducer(loaded, { type: "PLAY_TICK" });

    expect(ticked.nextOpIndex).toBe(1);
    expect(ticked.simState.clock).toBe(1);
  });

  it("pauses playback", () => {
    const paused = reducer(
      { ...initialAppState, isPlaying: true },
      { type: "PAUSE" },
    );

    expect(paused.isPlaying).toBe(false);
  });

  it("resets simulation", () => {
    const loaded = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R 0" },
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
        patch: { blockSizeBytes: 3 },
      },
    });

    expect(errored.validation.errors.length).toBeGreaterThan(0);

    const warned = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: {
          writeHitPolicy: "WRITE_THROUGH",
          writeMissPolicy: "WRITE_ALLOCATE",
        },
      },
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
        patch: { writeHitPolicy: "WRITE_THROUGH" },
      },
    });

    expect(updated.configLevels[0].writeHitPolicy).toBe("WRITE_THROUGH");
    expect(updated.configLevels[0].writeMissPolicy).toBe(previousL1.writeMissPolicy);
    expect(updated.configLevels[1]).toBe(previousL2);
  });

  it("updates writeMissPolicy per level without mutating other levels", () => {
    const previousL1 = initialAppState.configLevels[0];
    const previousL2 = initialAppState.configLevels[1];

    const updated = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L1",
        patch: { writeMissPolicy: "WRITE_NO_ALLOCATE" },
      },
    });

    expect(updated.configLevels[0].writeMissPolicy).toBe("WRITE_NO_ALLOCATE");
    expect(updated.configLevels[0].writeHitPolicy).toBe(previousL1.writeHitPolicy);
    expect(updated.configLevels[1]).toBe(previousL2);
  });

  it("blocks STEP and PLAY_TICK when parseResult.errors.length > 0", () => {
    const invalid = reducer(initialAppState, {
      type: "LOAD_TRACE",
      payload: { text: "R nope" },
    });

    const stepped = reducer(invalid, { type: "STEP" });
    const ticked = reducer(invalid, { type: "PLAY_TICK" });

    expect(stepped.nextOpIndex).toBe(0);
    expect(stepped.statusMessage).toBe("Fix parse errors before running simulation.");
    expect(ticked.nextOpIndex).toBe(0);
    expect(ticked.statusMessage).toBe("Fix parse errors before running simulation.");
  });

  it("allows STEP and PLAY_TICK when only warnings exist", () => {
    const warned = reducer(initialAppState, {
      type: "UPDATE_CONFIG",
      payload: {
        levelId: "L2",
        patch: {
          writeHitPolicy: "WRITE_THROUGH",
          writeMissPolicy: "WRITE_ALLOCATE",
        },
      },
    });
    const loaded = reducer(warned, {
      type: "LOAD_TRACE",
      payload: { text: "R 0\nR 0" },
    });

    const stepped = reducer(loaded, { type: "STEP" });
    const ticked = reducer(stepped, { type: "PLAY_TICK" });

    expect(loaded.validation.errors).toEqual([]);
    expect(loaded.validation.warnings.length).toBeGreaterThan(0);
    expect(ticked.nextOpIndex).toBe(2);
  });
});
