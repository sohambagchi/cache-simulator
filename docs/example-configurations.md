# Example Configurations Guide

Each built-in example loads only a workload trace. You must configure the cache
hierarchy manually to demonstrate the concept. Below are the recommended settings
for each example.

> **Default config** (what the simulator starts with):
> L1: 256 B, 16 B blocks, 2-way, LRU, Write-Back, Write-Allocate
> L2: 512 B, 16 B blocks, 2-way, LRU, Write-Back, Write-Allocate
> L3: disabled — Inclusion: Inclusive

---

## 1 · Spatial Locality

**Concept:** Larger blocks capture more nearby bytes on a single miss.

| Run | L1 Block Size | Other L1 settings | What to observe                                           |
| --- | ------------- | ----------------- | --------------------------------------------------------- |
| A   | **16 B**      | defaults          | R 0 misses; R 1–15 all hit (same block)                   |
| B   | **4 B**       | defaults          | R 0 hits 0–3; R 4, R 8, R 12 each miss (different blocks) |

Keep everything else at defaults. Only L1 matters here (disable L2 if you want a
cleaner view).

---

## 2 · Block Size vs Cache Size

**Concept:** Making blocks bigger gives spatial locality but reduces the number of
sets, increasing conflicts. Making the cache bigger adds more sets.

| Run | L1 Total Size | L1 Block Size | L1 Assoc | Sets   | What to observe                                                    |
| --- | ------------- | ------------- | -------- | ------ | ------------------------------------------------------------------ |
| A   | 256 B         | 16 B          | 2-way    | 8      | Baseline — some re-reads miss due to conflicts                     |
| B   | **512 B**     | 16 B          | 2-way    | **16** | More sets → fewer conflicts → more re-read hits                    |
| C   | 256 B         | **32 B**      | 2-way    | **4**  | Bigger blocks but only 4 sets → more conflicts, worse re-read rate |

Disable L2 for a cleaner comparison.

---

## 3 · Thrashing (Why Associativity?)

**Concept:** When multiple addresses map to the same set and the set is too small,
every access evicts the block you need next.

| Run | L1 Assoc              | Sets (256 B / 16 B) | What to observe                                                                |
| --- | --------------------- | ------------------- | ------------------------------------------------------------------------------ |
| A   | **1** (direct-mapped) | 16 sets             | Addresses 0 and 256 both map to set 0. Every re-read is a miss — 0% reuse rate |
| B   | **2**                 | 8 sets              | Set 0 holds both blocks → after cold misses, every re-read hits                |

Start with Run A (direct-mapped). Step through and watch the evictions. Then
change to 2-way and re-run to see the fix.

---

## 4 · Too Much Associativity

**Concept:** If there are no conflicts, higher associativity only adds tag-comparison
overhead with no hit-rate benefit.

| Run | L1 Assoc                                     | Sets    | What to observe                                            |
| --- | -------------------------------------------- | ------- | ---------------------------------------------------------- |
| A   | **1** (direct-mapped)                        | 16 sets | 8 cold misses, 8 re-read hits. 1 tag comparison per access |
| B   | **2**                                        | 8 sets  | Same hit rate, 2 tag comparisons per access                |
| C   | **8** (fully associative with 256 B / 16 B)  | 2 sets  | Same hit rate, 8 comparisons per access                    |
| D   | **16** (fully associative with 256 B / 16 B) | 1 set   | Same hit rate, 16 comparisons per access                   |

Watch the "compared ways" column in the event log — it grows with associativity
even though the hit/miss outcome is identical.

---

## 5 · Inclusive vs Exclusive

**Concept:** Inclusive caches duplicate data across levels; exclusive caches store
each block in only one level, giving more effective capacity.

| Run | Inclusion Policy | What to observe                                                                                                                   |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Inclusive**    | Evicted L1 blocks also live in L2 (duplication). L2 hit on re-read of evicted address                                             |
| B   | **Exclusive**    | Evicted L1 blocks migrate to L2 (no duplication). L2 holds unique data only. More effective total capacity for the later re-reads |

Use defaults for L1/L2 (both enabled). Toggle the Inclusive/Exclusive radio and
re-run the same trace.

---

## 6 · Write-Back + Write-Allocate

**Concept:** The standard pairing. Writes bring the block into cache (allocate) and
only flush to memory on eviction (write-back). Efficient for repeated writes.

| Setting              | Value              |
| -------------------- | ------------------ |
| L1 Write Hit Policy  | **Write-Back**     |
| L1 Write Miss Policy | **Write-Allocate** |

This is the default. Just run the trace:

- W 0 misses → allocates block, marks dirty
- W 1, W 2 hit the same block (still dirty, no memory traffic)
- R 0, R 1, R 2 all hit
- R 128, R 256 force eviction of set 0 → writeback event appears

---

## 7 · Write-Through + No-Allocate

**Concept:** Writes bypass the cache entirely. Only reads bring blocks in.

| Setting              | Value                 |
| -------------------- | --------------------- |
| L1 Write Hit Policy  | **Write-Through**     |
| L1 Write Miss Policy | **Write-No-Allocate** |

Run the trace:

- W 0 99 → miss, not allocated, written to memory
- R 0 → miss! The write didn't cache it. Now the read loads the block
- R 0 → hit (the read brought it in)
- W 2 101 → hit (block is present), writes through to cache AND memory

---

## 8 · Strange Policy Combos

**Concept:** Non-standard pairings that work but have trade-offs.

### Run A: Write-Through + Write-Allocate

| Setting              | Value              |
| -------------------- | ------------------ |
| L1 Write Hit Policy  | **Write-Through**  |
| L1 Write Miss Policy | **Write-Allocate** |

- W 0 10 → miss, allocates block (fetch from memory), writes value, AND writes
  through to memory. Double traffic on every write miss.
- R 0 → hit (block was allocated)

### Run B: Write-Back + Write-No-Allocate

| Setting              | Value                 |
| -------------------- | --------------------- |
| L1 Write Hit Policy  | **Write-Back**        |
| L1 Write Miss Policy | **Write-No-Allocate** |

- W 32 20 → miss, not allocated, goes to memory
- R 32 → miss, now loads the block into cache
- W 33 77 → hit (block is present), marks dirty (write-back)
- R 33 → hit, reads dirty data from cache
