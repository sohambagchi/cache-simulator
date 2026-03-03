import { describe, expect, it } from "vitest";
import type { CacheLevelConfig } from "../domain/types";
import { createInitialState } from "./initialState";
import { simulateStep } from "./simulateStep";

function createLevel(
  overrides: Partial<CacheLevelConfig> & Pick<CacheLevelConfig, "id">
): CacheLevelConfig {
  return {
    enabled: true,
    totalSizeBytes: 1,
    blockSizeBytes: 1,
    associativity: 1,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE",
    ...overrides
  };
}

describe("simulateStep", () => {
  it("fills cache on read miss so repeated read hits", () => {
    const state0 = createInitialState([createLevel({ id: "L1" })]);
    state0.memory[7] = 41;

    const firstRead = simulateStep(state0, { kind: "R", address: 7 });
    const secondRead = simulateStep(firstRead.state, { kind: "R", address: 7 });

    expect(
      firstRead.events.some(
        (event) => event.stage === "miss" && event.levelId === "L1"
      )
    ).toBe(true);
    expect(
      firstRead.events.some(
        (event) => event.stage === "fill" && event.levelId === "L1"
      )
    ).toBe(true);
    expect(
      secondRead.events.some(
        (event) => event.stage === "hit" && event.levelId === "L1"
      )
    ).toBe(true);
    expect(secondRead.events.some((event) => event.stage === "memory")).toBe(
      false
    );
    expect(secondRead.state.stats.hits).toBe(firstRead.state.stats.hits + 1);
  });

  it("applies replacement policy during read-driven fills", () => {
    const state0 = createInitialState([createLevel({ id: "L1" })]);
    state0.memory[0] = 11;
    state0.memory[1] = 22;

    const read0 = simulateStep(state0, { kind: "R", address: 0 });
    const read1 = simulateStep(read0.state, { kind: "R", address: 1 });
    const read0Again = simulateStep(read1.state, { kind: "R", address: 0 });

    expect(read1.state.levels[0].sets[0].ways[0]).toMatchObject({
      valid: true,
      tag: 1,
      dataBytes: [22]
    });
    expect(
      read0Again.events.some(
        (event) => event.stage === "miss" && event.levelId === "L1"
      )
    ).toBe(true);
  });

  it("emits ordered dirty eviction writeback events when read fill evicts dirty lines", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      }),
      createLevel({
        id: "L2",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      })
    ]);

    const afterDirtyWrite = simulateStep(state0, {
      kind: "W",
      address: 0,
      value: 33
    }).state;
    const readMiss = simulateStep(afterDirtyWrite, { kind: "R", address: 1 });

    const l1EvictionIndex = readMiss.events.findIndex(
      (event) => event.stage === "eviction" && event.levelId === "L1"
    );
    const l1WritebackIndex = readMiss.events.findIndex(
      (event) => event.stage === "writeback" && event.levelId === "L1"
    );
    const l1FillIndex = readMiss.events.findIndex(
      (event) => event.stage === "fill" && event.levelId === "L1"
    );

    expect(l1EvictionIndex).toBeGreaterThan(-1);
    expect(l1WritebackIndex).toBeGreaterThan(l1EvictionIndex);
    expect(l1FillIndex).toBeGreaterThan(l1WritebackIndex);
    expect(readMiss.events[l1EvictionIndex]).toMatchObject({
      dirtyEvictionTarget: "L2",
      victimWay: 0
    });
    expect(readMiss.events[l1WritebackIndex]).toMatchObject({
      dirtyEvictionTarget: "L2",
      victimWay: 0
    });
  });

  it("marks dirty on write-back hit and emits ordered dirty eviction cascade", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      }),
      createLevel({
        id: "L2",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      })
    ]);

    const state1 = simulateStep(state0, {
      kind: "W",
      address: 0,
      value: 10
    }).state;
    const result = simulateStep(state1, { kind: "W", address: 1, value: 20 });

    const lineL1 = result.state.levels[0].sets[0].ways[0];
    const lineL2 = result.state.levels[1].sets[0].ways[0];

    expect(lineL1.valid).toBe(true);
    expect(lineL1.dirty).toBe(true);
    expect(lineL1.dataBytes[0]).toBe(20);
    expect(lineL2.valid).toBe(true);
    expect(lineL2.dataBytes[0]).toBe(10);

    const evictionIndex = result.events.findIndex(
      (event) => event.stage === "eviction" && event.levelId === "L1"
    );
    const writebackIndex = result.events.findIndex(
      (event) => event.stage === "writeback" && event.levelId === "L1"
    );

    expect(evictionIndex).toBeGreaterThan(-1);
    expect(writebackIndex).toBeGreaterThan(evictionIndex);
    expect(result.events[evictionIndex]).toMatchObject({
      victimWay: 0,
      dirtyEvictionTarget: "L2"
    });
  });

  it("propagates write-through hits downstream immediately", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_THROUGH",
        writeMissPolicy: "WRITE_ALLOCATE"
      })
    ]);

    const state1 = simulateStep(state0, {
      kind: "W",
      address: 0,
      value: 3
    }).state;
    const result = simulateStep(state1, { kind: "W", address: 0, value: 9 });

    expect(result.state.memory[0]).toBe(9);
    expect(result.state.stats.memoryWrites).toBe(state1.stats.memoryWrites + 1);
    expect(
      result.events.some(
        (event) => event.stage === "memory" && event.opKind === "W"
      )
    ).toBe(true);
  });

  it("handles write-miss write-allocate plus write-through as fill then downstream write", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_THROUGH",
        writeMissPolicy: "WRITE_ALLOCATE"
      })
    ]);

    const result = simulateStep(state0, { kind: "W", address: 0, value: 12 });
    const stages = result.events.map((event) => event.stage);

    expect(stages).toEqual(expect.arrayContaining(["miss", "fill", "memory"]));
    expect(stages.indexOf("fill")).toBeLessThan(stages.lastIndexOf("memory"));
    expect(result.state.levels[0].sets[0].ways[0]).toMatchObject({
      valid: true,
      dataBytes: [12],
      dirty: false
    });
  });

  it("handles write-miss write-allocate plus write-back as fill then dirty local line", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      })
    ]);

    const result = simulateStep(state0, { kind: "W", address: 0, value: 12 });

    expect(
      result.events.some(
        (event) => event.stage === "memory" && event.opKind === "W"
      )
    ).toBe(false);
    expect(result.state.levels[0].sets[0].ways[0]).toMatchObject({
      valid: true,
      dataBytes: [12],
      dirty: true
    });
  });

  it("handles write-miss write-no-allocate by bypassing local fill and forwarding downstream", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_NO_ALLOCATE"
      })
    ]);

    const result = simulateStep(state0, { kind: "W", address: 0, value: 55 });

    expect(
      result.events.some(
        (event) => event.stage === "fill" && event.levelId === "L1"
      )
    ).toBe(false);
    expect(result.state.levels[0].sets[0].ways[0].valid).toBe(false);
    expect(result.state.memory[0]).toBe(55);
  });

  it("returns explicit runtime diagnostic for out-of-range op and keeps state untouched", () => {
    const state0 = createInitialState([createLevel({ id: "L1" })]);
    const result = simulateStep(state0, { kind: "W", address: 1024, value: 0 });

    expect(result.diagnostic).toBe(
      "Runtime: address out of range (expected 0..1023)"
    );
    expect(result.state).toBe(state0);
    expect(result.events).toEqual([]);
  });

  it("emits deterministic timeline payload fields for ui consumption", () => {
    const state0 = createInitialState([createLevel({ id: "L1" })]);
    const result = simulateStep(state0, { kind: "R", address: 0 });

    for (const event of result.events) {
      expect(event).toEqual(
        expect.objectContaining({
          operationId: expect.any(Number),
          stage: expect.any(String),
          levelId: expect.any(String),
          opKind: "R",
          address: 0,
          tag: expect.any(Number),
          index: expect.any(Number),
          offset: expect.any(Number)
        })
      );
    }

    const compareEvent = result.events.find(
      (event) => event.stage === "compare"
    );
    expect(compareEvent?.comparedWays).toBeDefined();
    expect(compareEvent?.comparedWays[0]).toEqual(
      expect.objectContaining({
        way: expect.any(Number),
        valid: expect.any(Boolean),
        tag: expect.any(Number),
        match: expect.any(Boolean)
      })
    );
  });

  it("tracks per-level hit, miss, and eviction totals deterministically", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        totalSizeBytes: 1,
        blockSizeBytes: 1,
        associativity: 1
      }),
      createLevel({
        id: "L2",
        totalSizeBytes: 1,
        blockSizeBytes: 1,
        associativity: 1
      })
    ]);
    state0.memory[0] = 10;
    state0.memory[1] = 11;

    const read0 = simulateStep(state0, { kind: "R", address: 0 });
    const read0Again = simulateStep(read0.state, { kind: "R", address: 0 });
    const read1 = simulateStep(read0Again.state, { kind: "R", address: 1 });

    expect(read1.state.stats.perLevel.L1).toEqual({
      hits: 1,
      misses: 2,
      evictions: 1
    });
    expect(read1.state.stats.perLevel.L2).toEqual({
      hits: 0,
      misses: 2,
      evictions: 1
    });
  });

  it("loads an entire block payload and serves reads by offset", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        totalSizeBytes: 8,
        blockSizeBytes: 4,
        associativity: 1
      })
    ]);
    state0.memory[4] = 10;
    state0.memory[5] = 20;
    state0.memory[6] = 30;
    state0.memory[7] = 40;

    const firstRead = simulateStep(state0, { kind: "R", address: 5 });
    const secondRead = simulateStep(firstRead.state, { kind: "R", address: 6 });

    expect(firstRead.state.levels[0].sets[1].ways[0].dataBytes).toEqual([
      10, 20, 30, 40
    ]);
    expect(secondRead.events.some((event) => event.stage === "memory")).toBe(
      false
    );
    expect(secondRead.state.levels[0].sets[1].ways[0].dataBytes[2]).toBe(30);
  });

  it("updates only the targeted offset on write hit within a block", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        totalSizeBytes: 8,
        blockSizeBytes: 4,
        associativity: 1,
        writeHitPolicy: "WRITE_BACK"
      })
    ]);
    state0.memory[4] = 1;
    state0.memory[5] = 2;
    state0.memory[6] = 3;
    state0.memory[7] = 4;

    const afterRead = simulateStep(state0, { kind: "R", address: 5 }).state;
    const afterWrite = simulateStep(afterRead, {
      kind: "W",
      address: 6,
      value: 99
    }).state;

    expect(afterWrite.levels[0].sets[1].ways[0].dataBytes).toEqual([
      1, 2, 99, 4
    ]);
    expect(afterWrite.levels[0].sets[1].ways[0].dirty).toBe(true);
  });

  it("counts a read that misses L1 but hits L2 as a global hit", () => {
    // L1: 1 byte total (1 set, 1 way, 1-byte blocks) — holds exactly 1 word
    // L2: 2 bytes total (2 sets, 1 way, 1-byte blocks) — holds 2 words, so evicting from L1 keeps it in L2
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        totalSizeBytes: 1,
        blockSizeBytes: 1,
        associativity: 1
      }),
      createLevel({
        id: "L2",
        totalSizeBytes: 2,
        blockSizeBytes: 1,
        associativity: 1
      })
    ]);
    state0.memory[0] = 42;

    // Warm both levels with address 0
    const afterWarm = simulateStep(state0, { kind: "R", address: 0 }).state;
    // Evict address 0 from L1 by reading address 1 — L2 has 2 sets so addr 0 stays in L2
    const afterEvict = simulateStep(afterWarm, { kind: "R", address: 1 }).state;
    // Now address 0 is in L2 (set 0) but not L1 — a read should be a global hit
    const result = simulateStep(afterEvict, { kind: "R", address: 0 });

    expect(
      result.events.some((e) => e.stage === "miss" && e.levelId === "L1")
    ).toBe(true);
    expect(
      result.events.some((e) => e.stage === "hit" && e.levelId === "L2")
    ).toBe(true);
    // Global: this is a hit (served by hierarchy), not a miss
    const hitsBefore = afterEvict.stats.hits;
    const missesBefore = afterEvict.stats.misses;
    expect(result.state.stats.hits).toBe(hitsBefore + 1);
    expect(result.state.stats.misses).toBe(missesBefore);
  });

  it("counts a write that misses all levels as a global miss", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_NO_ALLOCATE"
      })
    ]);

    const result = simulateStep(state0, { kind: "W", address: 0, value: 5 });

    expect(result.state.stats.hits).toBe(0);
    expect(result.state.stats.misses).toBe(1);
  });

  it("counts a write that hits L1 as a global hit", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      })
    ]);

    // First write misses and allocates into L1
    const afterMiss = simulateStep(state0, {
      kind: "W",
      address: 0,
      value: 1
    }).state;
    // Second write hits L1
    const result = simulateStep(afterMiss, { kind: "W", address: 0, value: 2 });

    expect(
      result.events.some((e) => e.stage === "hit" && e.levelId === "L1")
    ).toBe(true);
    expect(result.state.stats.hits).toBe(afterMiss.stats.hits + 1);
    expect(result.state.stats.misses).toBe(afterMiss.stats.misses);
  });

  it("counts a write that misses L1 but hits L2 as a global hit", () => {
    // L1: 1-byte total (1 set, 1 way) — holds 1 word
    // L2: 2-byte total (2 sets, 1 way) — holds 2 words, keeps evicted L1 entries
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        totalSizeBytes: 1,
        blockSizeBytes: 1,
        associativity: 1,
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      }),
      createLevel({
        id: "L2",
        totalSizeBytes: 2,
        blockSizeBytes: 1,
        associativity: 1,
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      })
    ]);

    // Warm both levels with address 0
    const afterWarm = simulateStep(state0, {
      kind: "W",
      address: 0,
      value: 1
    }).state;
    // Evict address 0 from L1 by writing address 1 — dirty eviction pushes addr 0 into L2 (set 0)
    const afterEvict = simulateStep(afterWarm, {
      kind: "W",
      address: 1,
      value: 2
    }).state;
    // Now address 0 is in L2 (set 0) but not L1: write to address 0 should be a global hit (L2 hit)
    const result = simulateStep(afterEvict, {
      kind: "W",
      address: 0,
      value: 99
    });

    expect(
      result.events.some((e) => e.stage === "miss" && e.levelId === "L1")
    ).toBe(true);
    expect(
      result.events.some((e) => e.stage === "hit" && e.levelId === "L2")
    ).toBe(true);
    const hitsBefore = afterEvict.stats.hits;
    const missesBefore = afterEvict.stats.misses;
    expect(result.state.stats.hits).toBe(hitsBefore + 1);
    expect(result.state.stats.misses).toBe(missesBefore);
  });

  it("EXCLUSIVE: block is invalidated from L2 when filled into L1", () => {
    // L1: 16B (4 sets, 1 way, 4B blocks), L2: 64B (16 sets, 1 way, 4B blocks)
    const state = createInitialState(
      [
        {
          id: "L1",
          enabled: true,
          totalSizeBytes: 16,
          blockSizeBytes: 4,
          associativity: 1,
          replacementPolicy: "LRU",
          writeHitPolicy: "WRITE_BACK",
          writeMissPolicy: "WRITE_ALLOCATE"
        },
        {
          id: "L2",
          enabled: true,
          totalSizeBytes: 64,
          blockSizeBytes: 4,
          associativity: 1,
          replacementPolicy: "LRU",
          writeHitPolicy: "WRITE_BACK",
          writeMissPolicy: "WRITE_ALLOCATE"
        }
      ],
      "EXCLUSIVE"
    );

    // R 0: miss L1 and L2 → block fetched from memory, filled into L1.
    // In EXCLUSIVE mode, L2 must NOT also hold it.
    const r1 = simulateStep(state, { kind: "R", address: 0 });

    const l1Line = r1.state.levels[0].sets[0].ways[0];
    const l2Line = r1.state.levels[1].sets[0].ways[0];

    expect(l1Line.valid).toBe(true);
    // EXCLUSIVE: block moved to L1, so L2 set 0 should be invalid
    expect(l2Line.valid).toBe(false);
  });

  it("EXCLUSIVE: repeated read of same address still hits L1 (not double-invalidated)", () => {
    const state = createInitialState(
      [
        {
          id: "L1",
          enabled: true,
          totalSizeBytes: 16,
          blockSizeBytes: 4,
          associativity: 1,
          replacementPolicy: "LRU",
          writeHitPolicy: "WRITE_BACK",
          writeMissPolicy: "WRITE_ALLOCATE"
        },
        {
          id: "L2",
          enabled: true,
          totalSizeBytes: 64,
          blockSizeBytes: 4,
          associativity: 1,
          replacementPolicy: "LRU",
          writeHitPolicy: "WRITE_BACK",
          writeMissPolicy: "WRITE_ALLOCATE"
        }
      ],
      "EXCLUSIVE"
    );

    const r1 = simulateStep(state, { kind: "R", address: 0 });
    const r2 = simulateStep(r1.state, { kind: "R", address: 0 });

    expect(r2.events.some((e) => e.stage === "hit" && e.levelId === "L1")).toBe(
      true
    );
    expect(r2.events.some((e) => e.stage === "miss")).toBe(false);
  });

  it("emits one memory event per written byte when dirty block writeback reaches memory", () => {
    const state0 = createInitialState([
      createLevel({
        id: "L1",
        totalSizeBytes: 4,
        blockSizeBytes: 4,
        associativity: 1,
        writeHitPolicy: "WRITE_BACK"
      })
    ]);
    state0.memory[0] = 10;
    state0.memory[1] = 20;
    state0.memory[2] = 30;
    state0.memory[3] = 40;
    state0.memory[4] = 50;
    state0.memory[5] = 60;
    state0.memory[6] = 70;
    state0.memory[7] = 80;

    const afterFill = simulateStep(state0, { kind: "R", address: 1 }).state;
    const afterWrite = simulateStep(afterFill, {
      kind: "W",
      address: 2,
      value: 99
    }).state;
    const readEvictingDirtyLine = simulateStep(afterWrite, {
      kind: "R",
      address: 5
    });

    const memoryWrites = readEvictingDirtyLine.events.filter(
      (event) => event.stage === "memory" && event.opKind === "W"
    );

    expect(memoryWrites.map((event) => event.address)).toEqual([0, 1, 2, 3]);
    expect(memoryWrites.map((event) => event.offset)).toEqual([0, 1, 2, 3]);
    expect(readEvictingDirtyLine.state.memory.slice(0, 4)).toEqual([
      10, 20, 99, 40
    ]);
  });
});
