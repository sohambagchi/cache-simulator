import type { SimEvent } from "../../engine/initialState";

export type AddressStats = { reads: number; writes: number };

/**
 * Count per-address memory reads and writes from simulation events.
 *
 * Only events with `stage === "memory"` are considered. Returns an array
 * of length `memorySize` where each element holds the read/write tallies
 * for that address.
 */
export function computePerAddressStats(
  events: SimEvent[],
  memorySize: number = 1024,
): AddressStats[] {
  const stats: AddressStats[] = Array.from({ length: memorySize }, () => ({
    reads: 0,
    writes: 0,
  }));

  for (const event of events) {
    if (event.stage !== "memory") continue;
    if (event.address < 0 || event.address >= memorySize) continue;

    const entry = stats[event.address];
    if (event.opKind === "R") {
      entry.reads += 1;
    } else {
      entry.writes += 1;
    }
  }

  return stats;
}

/**
 * Sum reads + writes per address into a flat array of total touch counts.
 */
export function computeTouchCounts(addressStats: AddressStats[]): number[] {
  return addressStats.map((s) => s.reads + s.writes);
}
