import { describe, expect, it } from "vitest";
import type { CacheLevelConfig } from "../domain/types";
import { createInitialState } from "./initialState";
import { simulateStep } from "./simulateStep";

function createLevel(
  overrides: Partial<CacheLevelConfig> & Pick<CacheLevelConfig, "id">,
): CacheLevelConfig {
  return {
    id: overrides.id,
    enabled: true,
    totalSizeBytes: 1,
    blockSizeBytes: 1,
    associativity: 1,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE",
    ...overrides,
  };
}

describe("simulateStep", () => {
  it("marks dirty on write-back hit and emits ordered dirty eviction cascade", () => {
    const state0 = createInitialState([
      createLevel({ id: "L1", writeHitPolicy: "WRITE_BACK", writeMissPolicy: "WRITE_ALLOCATE" }),
      createLevel({ id: "L2", writeHitPolicy: "WRITE_BACK", writeMissPolicy: "WRITE_ALLOCATE" }),
    ]);

    const state1 = simulateStep(state0, { kind: "W", address: 0, value: 10 }).state;
    const result = simulateStep(state1, { kind: "W", address: 1, value: 20 });

    const lineL1 = result.state.levels[0].sets[0].ways[0];
    const lineL2 = result.state.levels[1].sets[0].ways[0];

    expect(lineL1.valid).toBe(true);
    expect(lineL1.dirty).toBe(true);
    expect(lineL1.data).toBe(20);
    expect(lineL2.valid).toBe(true);
    expect(lineL2.data).toBe(10);

    const evictionIndex = result.events.findIndex(
      (event) => event.stage === "eviction" && event.levelId === "L1",
    );
    const writebackIndex = result.events.findIndex(
      (event) => event.stage === "writeback" && event.levelId === "L1",
    );

    expect(evictionIndex).toBeGreaterThan(-1);
    expect(writebackIndex).toBeGreaterThan(evictionIndex);
    expect(result.events[evictionIndex]).toMatchObject({
      victimWay: 0,
      dirtyEvictionTarget: "L2",
    });
  });

  it("propagates write-through hits downstream immediately", () => {
    const state0 = createInitialState([
      createLevel({ id: "L1", writeHitPolicy: "WRITE_THROUGH", writeMissPolicy: "WRITE_ALLOCATE" }),
    ]);

    const state1 = simulateStep(state0, { kind: "W", address: 0, value: 3 }).state;
    const result = simulateStep(state1, { kind: "W", address: 0, value: 9 });

    expect(result.state.memory[0]).toBe(9);
    expect(result.state.stats.memoryWrites).toBe(state1.stats.memoryWrites + 1);
    expect(result.events.some((event) => event.stage === "memory" && event.opKind === "W")).toBe(true);
  });

  it("handles write-miss write-allocate plus write-through as fill then downstream write", () => {
    const state0 = createInitialState([
      createLevel({ id: "L1", writeHitPolicy: "WRITE_THROUGH", writeMissPolicy: "WRITE_ALLOCATE" }),
    ]);

    const result = simulateStep(state0, { kind: "W", address: 0, value: 12 });
    const stages = result.events.map((event) => event.stage);

    expect(stages).toEqual(expect.arrayContaining(["miss", "fill", "memory"]));
    expect(stages.indexOf("fill")).toBeLessThan(stages.lastIndexOf("memory"));
    expect(result.state.levels[0].sets[0].ways[0]).toMatchObject({ valid: true, data: 12, dirty: false });
  });

  it("handles write-miss write-allocate plus write-back as fill then dirty local line", () => {
    const state0 = createInitialState([
      createLevel({ id: "L1", writeHitPolicy: "WRITE_BACK", writeMissPolicy: "WRITE_ALLOCATE" }),
    ]);

    const result = simulateStep(state0, { kind: "W", address: 0, value: 12 });

    expect(result.events.some((event) => event.stage === "memory" && event.opKind === "W")).toBe(false);
    expect(result.state.levels[0].sets[0].ways[0]).toMatchObject({ valid: true, data: 12, dirty: true });
  });

  it("handles write-miss write-no-allocate by bypassing local fill and forwarding downstream", () => {
    const state0 = createInitialState([
      createLevel({ id: "L1", writeHitPolicy: "WRITE_BACK", writeMissPolicy: "WRITE_NO_ALLOCATE" }),
    ]);

    const result = simulateStep(state0, { kind: "W", address: 0, value: 55 });

    expect(result.events.some((event) => event.stage === "fill" && event.levelId === "L1")).toBe(false);
    expect(result.state.levels[0].sets[0].ways[0].valid).toBe(false);
    expect(result.state.memory[0]).toBe(55);
  });

  it("returns explicit runtime diagnostic for out-of-range op and keeps state untouched", () => {
    const state0 = createInitialState([createLevel({ id: "L1" })]);
    const result = simulateStep(state0, { kind: "W", address: 1024, value: 0 });

    expect(result.diagnostic).toBe("Runtime: address out of range (expected 0..1023)");
    expect(result.state).toBe(state0);
    expect(result.events).toEqual([]);
  });

  it("emits deterministic timeline payload fields for ui consumption", () => {
    const state0 = createInitialState([createLevel({ id: "L1" })]);
    const result = simulateStep(state0, { kind: "R", address: 0 });

    for (const event of result.events) {
      expect(event).toEqual(
        expect.objectContaining({
          stage: expect.any(String),
          levelId: expect.any(String),
          opKind: "R",
          address: 0,
          tag: expect.any(Number),
          index: expect.any(Number),
          offset: expect.any(Number),
        }),
      );
    }

    const compareEvent = result.events.find((event) => event.stage === "compare");
    expect(compareEvent?.comparedWays).toBeDefined();
    expect(compareEvent?.comparedWays[0]).toEqual(
      expect.objectContaining({
        way: expect.any(Number),
        valid: expect.any(Boolean),
        tag: expect.any(Number),
        match: expect.any(Boolean),
      }),
    );
  });
});
