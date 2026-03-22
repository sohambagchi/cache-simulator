import { describe, expect, it } from "vitest";
import type { SimEvent } from "../../engine/initialState";
import { computePerAddressStats, computeTouchCounts } from "./memoryStats";

function createEvent(overrides: Partial<SimEvent>): SimEvent {
  return {
    operationId: 1,
    stage: "decode",
    levelId: "L1",
    opKind: "R",
    address: 0,
    tag: 0,
    index: 0,
    offset: 0,
    comparedWays: [],
    ...overrides,
  };
}

describe("computePerAddressStats", () => {
  it("returns all zeros for empty events", () => {
    const stats = computePerAddressStats([], 4);
    expect(stats).toEqual([
      { reads: 0, writes: 0 },
      { reads: 0, writes: 0 },
      { reads: 0, writes: 0 },
      { reads: 0, writes: 0 },
    ]);
  });

  it("ignores non-memory-stage events", () => {
    const events = [
      createEvent({ stage: "decode", address: 0, opKind: "R" }),
      createEvent({ stage: "compare", address: 1, opKind: "W" }),
      createEvent({ stage: "hit", address: 2, opKind: "R" }),
      createEvent({ stage: "fill", address: 3, opKind: "W" }),
    ];
    const stats = computePerAddressStats(events, 4);
    expect(stats).toEqual([
      { reads: 0, writes: 0 },
      { reads: 0, writes: 0 },
      { reads: 0, writes: 0 },
      { reads: 0, writes: 0 },
    ]);
  });

  it("counts reads and writes at the correct address", () => {
    const events = [
      createEvent({ stage: "memory", address: 1, opKind: "R" }),
      createEvent({ stage: "memory", address: 2, opKind: "W" }),
    ];
    const stats = computePerAddressStats(events, 4);
    expect(stats[0]).toEqual({ reads: 0, writes: 0 });
    expect(stats[1]).toEqual({ reads: 1, writes: 0 });
    expect(stats[2]).toEqual({ reads: 0, writes: 1 });
    expect(stats[3]).toEqual({ reads: 0, writes: 0 });
  });

  it("accumulates multiple events at the same address", () => {
    const events = [
      createEvent({ stage: "memory", address: 0, opKind: "R" }),
      createEvent({ stage: "memory", address: 0, opKind: "R" }),
      createEvent({ stage: "memory", address: 0, opKind: "W" }),
      createEvent({ stage: "memory", address: 0, opKind: "R" }),
    ];
    const stats = computePerAddressStats(events, 2);
    expect(stats[0]).toEqual({ reads: 3, writes: 1 });
    expect(stats[1]).toEqual({ reads: 0, writes: 0 });
  });

  it("defaults to memorySize 1024", () => {
    const stats = computePerAddressStats([]);
    expect(stats).toHaveLength(1024);
  });
});

describe("computeTouchCounts", () => {
  it("returns all zeros when all stats are zero", () => {
    const stats = [
      { reads: 0, writes: 0 },
      { reads: 0, writes: 0 },
      { reads: 0, writes: 0 },
    ];
    expect(computeTouchCounts(stats)).toEqual([0, 0, 0]);
  });

  it("sums reads and writes per address", () => {
    const stats = [
      { reads: 3, writes: 1 },
      { reads: 0, writes: 5 },
      { reads: 2, writes: 0 },
      { reads: 0, writes: 0 },
    ];
    expect(computeTouchCounts(stats)).toEqual([4, 5, 2, 0]);
  });
});
