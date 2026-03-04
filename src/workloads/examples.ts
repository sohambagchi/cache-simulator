export type WorkloadExample = {
  id: string;
  label: string;
  description: string;
  text: string;
};

export const BUILTIN_WORKLOAD_EXAMPLES: readonly WorkloadExample[] = [
  // ── 1. Block Size & Spatial Locality ──────────────────────────────
  {
    id: "spatial-locality",
    label: "1 · Spatial Locality",
    description:
      "Read one byte, then read its neighbours. With large blocks they are already cached; with small blocks each is a separate miss.",
    text: [
      "# Read byte 0 — compulsory miss, loads the whole block",
      "R 0",
      "",
      "# Nearby bytes: are they in the same block?",
      "# With blockSize=16 these are all hits (same block covers 0-15).",
      "# Try blockSize=4: only 0-3 share a block, so 4 and 8 miss.",
      "R 1",
      "R 2",
      "R 3",
      "R 4",
      "R 8",
      "R 12",
      "R 15",
      "",
      "# Jump to a faraway address — always a miss regardless of block size",
      "R 200",
      "",
      "# Read neighbours of 200",
      "R 201",
      "R 202",
      "R 207"
    ].join("\n")
  },

  // ── 2. Block Size vs Cache Size ───────────────────────────────────
  {
    id: "blocksize-vs-cachesize",
    label: "2 · Block Size vs Cache Size",
    description:
      "Sequential scan then re-read. Try (a) more sets via larger cache, (b) bigger blocks — observe the trade-off between spatial locality and set count.",
    text: [
      "# Scan 16 distinct blocks (stride 16, default block size).",
      "# Default L1 (256 B, 16 B blocks, 2-way) has 8 sets → some of",
      "# these map to the same set and will conflict.",
      "R 0",
      "R 16",
      "R 32",
      "R 48",
      "R 64",
      "R 80",
      "R 96",
      "R 112",
      "R 128",
      "R 144",
      "R 160",
      "R 176",
      "R 192",
      "R 208",
      "R 224",
      "R 240",
      "",
      "# Re-read everything — how many are still cached?",
      "# Try: increase cache to 512 B (more sets, fewer conflicts).",
      "# Or:  increase block size to 32 B (fewer sets! more conflicts).",
      "R 0",
      "R 16",
      "R 32",
      "R 48",
      "R 64",
      "R 80",
      "R 96",
      "R 112",
      "R 128",
      "R 144",
      "R 160",
      "R 176",
      "R 192",
      "R 208",
      "R 224",
      "R 240"
    ].join("\n")
  },

  // ── 3. Thrashing — Motivate Associativity ─────────────────────────
  {
    id: "thrashing",
    label: "3 · Thrashing (Why Associativity?)",
    description:
      "Start with direct-mapped (1-way). Two addresses that map to the same set evict each other every time. Increase associativity to 2-way to fix it.",
    text: [
      "# Set L1 to direct-mapped (associativity = 1) before running.",
      "# L1 256 B, 16 B blocks, 1-way → 16 sets.",
      "# Addresses 0 and 256 both map to set 0.",
      "# With only 1 way, the second always evicts the first.",
      "",
      "# Cold miss — loads block for address 0 into set 0",
      "R 0",
      "",
      "# Cold miss — loads block for address 256 into set 0,",
      "# EVICTS address 0's block (only 1 slot!)",
      "R 256",
      "",
      "# Re-read 0 — miss! It was just evicted.",
      "R 0",
      "",
      "# Re-read 256 — miss! It was just evicted.",
      "R 256",
      "",
      "# Every single access is a miss. 0% reuse hit rate.",
      "R 0",
      "R 256",
      "R 0",
      "R 256",
      "",
      "# Fix: set associativity to 2. Now set 0 holds both blocks.",
      "# After the two cold misses, every re-read is a hit."
    ].join("\n")
  },

  // ── 4. Too Much Associativity ─────────────────────────────────────
  {
    id: "excess-associativity",
    label: "4 · Too Much Associativity",
    description:
      "Accesses that each land in a different set — no conflicts at all. Watch the tag comparisons grow with associativity for zero benefit.",
    text: [
      "# Each address below maps to a DIFFERENT set in default L1,",
      "# so there are no conflicts even with direct-mapped (1-way).",
      "",
      "# Cold load — one miss per set, no evictions",
      "R 0",
      "R 16",
      "R 32",
      "R 48",
      "R 64",
      "R 80",
      "R 96",
      "R 112",
      "",
      "# Re-read — all hits regardless of associativity",
      "R 0",
      "R 16",
      "R 32",
      "R 48",
      "R 64",
      "R 80",
      "R 96",
      "R 112",
      "",
      "# Try associativity = 1 (direct mapped): 2 tag comparisons per set = fast.",
      "# Try associativity = 8 (fully assoc): 8 comparisons per lookup — same",
      "# hit rate, but more hardware work on every access.",
      "# (Check the compared-ways column in the event log.)"
    ].join("\n")
  },

  // ── 5. Inclusive vs Exclusive Caches ──────────────────────────────
  {
    id: "inclusive-vs-exclusive",
    label: "5 · Inclusive vs Exclusive",
    description:
      "Fill L1 then trigger evictions. Inclusive duplicates data in L2; Exclusive migrates evicted blocks to L2 giving more effective capacity.",
    text: [
      "# Fill L1's set 0 (2-way) with two blocks, then bring a third.",
      "# Default: L1 256 B/16 B/2-way, L2 512 B/16 B/2-way",
      "",
      "# Warm up: two blocks in set 0",
      "R 0",
      "R 128",
      "",
      "# Third block in set 0 — forces eviction of one block from L1.",
      "R 256",
      "",
      "# Inclusive: the evicted block is also in L2 (duplicated).",
      "#   L2 stores copies of everything in L1 → less unique data overall.",
      "# Exclusive: the evicted block moves to L2 (no duplication).",
      "#   L2 only has data NOT in L1 → more effective total capacity.",
      "",
      "# Read back the evicted address:",
      "R 0",
      "",
      "# Inclusive: L2 hit (it was kept there).",
      "# Exclusive: L2 hit (it was migrated there on eviction).",
      "# But now fill more to see the capacity difference:",
      "R 384",
      "R 512",
      "R 640",
      "",
      "# Re-read originals — exclusive policy retains more unique blocks.",
      "R 128",
      "R 256",
      "R 0"
    ].join("\n")
  },

  // ── 6. Write-Back + Write-Allocate ────────────────────────────────
  {
    id: "writeback-write-allocate",
    label: "6 · Write-Back + Write-Allocate",
    description:
      "The classic pairing: writes bring blocks into cache (allocate) and only update memory on eviction (write-back). Efficient for repeated writes.",
    text: [
      "# Write to address 0 — cache miss, but write-allocate loads the block",
      "# and marks it dirty (write-back keeps changes in cache only).",
      "W 0 42",
      "",
      "# Write again to same block — cache hit, stays dirty, no memory traffic.",
      "W 1 43",
      "W 2 44",
      "",
      "# Read back — hit! The data is right here in L1.",
      "R 0",
      "R 1",
      "R 2",
      "",
      "# Now force an eviction: fill set 0 with conflicting blocks.",
      "# Address 0 is in set 0. So are 128 and 256.",
      "R 128",
      "R 256",
      "",
      "# The dirty block (address 0's block) gets evicted →",
      "# write-back triggers: data finally written to lower level.",
      "# Check the event log for the 'writeback' event."
    ].join("\n")
  },

  // ── 7. Write-Through + Write-No-Allocate ──────────────────────────
  {
    id: "writethrough-no-allocate",
    label: "7 · Write-Through + No-Allocate",
    description:
      "Writes go straight to memory without caching. Reads afterward are misses — the write never brought the block in.",
    text: [
      "# Set L1 to Write-Through + Write-No-Allocate before running.",
      "",
      "# Write to address 0 — not allocated in cache, written to memory.",
      "W 0 99",
      "",
      "# Write to another address in the same block — also bypasses cache.",
      "W 1 100",
      "",
      "# Read address 0 — MISS! The writes never brought this block in.",
      "R 0",
      "",
      "# Now address 0's block IS in cache (the read loaded it).",
      "# A second read hits:",
      "R 0",
      "",
      "# Another write to this block — it IS in cache now, so write-through",
      "# updates cache AND immediately writes to memory (no dirty bit).",
      "W 2 101",
      "",
      "# Read back — hit, and memory is already up to date.",
      "R 2"
    ].join("\n")
  },

  // ── 8. Strange Policy Combinations ────────────────────────────────
  {
    id: "strange-combos",
    label: "8 · Strange Policy Combos",
    description:
      "Unusual pairings: Write-Through + Write-Allocate (double traffic) and Write-Back + No-Allocate (writes bypass cache entirely).",
    text: [
      "# ── Try Write-Through + Write-Allocate ──",
      "# Writes allocate the block (fetching it from memory),",
      "# then ALSO write through to memory. Double traffic!",
      "",
      "W 0 10",
      "W 1 11",
      "W 2 12",
      "",
      "# Reads hit (block was allocated), but every write above",
      "# already went to memory too — redundant for write-heavy workloads.",
      "R 0",
      "R 1",
      "R 2",
      "",
      "# ── Now try Write-Back + Write-No-Allocate ──",
      "# Writes to a MISSING block bypass cache entirely (no allocate).",
      "# Only reads bring blocks in. Once in cache, writes are write-back.",
      "",
      "W 32 20",
      "W 33 21",
      "",
      "# Reads load the block — now it is cached.",
      "R 32",
      "",
      "# This write HITS (block is present) → write-back, mark dirty.",
      "W 33 77",
      "",
      "# Read back — hit, dirty data is in cache.",
      "R 33"
    ].join("\n")
  }
];
