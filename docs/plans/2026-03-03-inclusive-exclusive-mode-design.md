# Inclusive / Exclusive Cache Mode — Design

**Date:** 2026-03-03  
**Status:** Approved

## Summary

Add a global `InclusionPolicy` toggle (`INCLUSIVE` / `EXCLUSIVE`) to the cache hierarchy simulator. The policy lives in `SimState` and controls eviction and fill behavior across all cache levels.

## Definitions

- **Inclusive:** Every block present in L(n) also exists in L(n+1). On a fill from L(n+1) into L(n), the block is _copied_ — it stays in the higher level. (Current behavior.)
- **Exclusive:** No block exists in more than one cache level simultaneously. On a fill from L(n+1) into L(n), the block is _moved_ — it is invalidated from L(n+1). On a clean eviction from L(n), the evicted block is installed into L(n+1) (swap) rather than discarded. Dirty evictions still write back normally.

## Architecture

### New type (`domain/types.ts`)

```ts
export type InclusionPolicy = "INCLUSIVE" | "EXCLUSIVE";
```

### SimState (`engine/initialState.ts`)

Add field:

```ts
inclusionPolicy: InclusionPolicy;
```

Default: `"INCLUSIVE"`.

`createInitialState` accepts an optional `inclusionPolicy` parameter (default `"INCLUSIVE"`).

### Engine behavior (`engine/simulateStep.ts`)

**Read miss fill** (`fillReadMissAtLevel`):

- After placing a block in level N, if `inclusionPolicy === "EXCLUSIVE"`, invalidate the matching line from level N+1 (if found).

**Clean eviction** (`fillReadMissAtLevel` and write-allocate miss path):

- If `inclusionPolicy === "EXCLUSIVE"` and the victim is _clean_, install the evicted block into level N+1 instead of discarding it (swap-on-eviction). If level N+1 is full, it selects its own victim via the normal replacement policy.
- Dirty evictions are unchanged — they write back as before.

### Actions (`state/actions.ts`)

```ts
| { type: "UPDATE_INCLUSION_POLICY"; payload: { policy: InclusionPolicy } }
```

### Reducer (`state/reducer.ts`)

Handles `UPDATE_INCLUSION_POLICY`: updates `simState.inclusionPolicy`, resets simulation (same pattern as `UPDATE_CONFIG`).

### UI (`ui/config/HierarchyBuilderPanel.tsx`)

Segmented two-button toggle at the top of the Hierarchy Builder Panel:

```
[ Inclusive ]  [ Exclusive ]
```

Calls a new `onUpdateInclusionPolicy` prop.

## Constraints

- Only affects multi-level hierarchies (single-level: no change).
- Exclusive mode does not affect write policies — dirty evictions still follow `writeHitPolicy`.
- Resetting the simulation clears all cache state; the inclusion policy persists across resets.

## Files Changed

| File                                      | Change                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `src/domain/types.ts`                     | Add `InclusionPolicy` type                                       |
| `src/engine/initialState.ts`              | Add `inclusionPolicy` to `SimState`; update `createInitialState` |
| `src/engine/simulateStep.ts`              | Invalidate-on-fill and swap-on-clean-eviction for EXCLUSIVE mode |
| `src/state/actions.ts`                    | Add `UPDATE_INCLUSION_POLICY` action                             |
| `src/state/reducer.ts`                    | Handle new action; thread policy into `createInitialState`       |
| `src/ui/config/HierarchyBuilderPanel.tsx` | Add segmented toggle UI                                          |
