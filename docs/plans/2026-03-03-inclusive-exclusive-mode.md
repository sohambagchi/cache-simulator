# Inclusive / Exclusive Cache Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global `INCLUSIVE` / `EXCLUSIVE` inclusion policy toggle to the cache hierarchy simulator, stored in `SimState`, enforced in the engine, and exposed as a UI control.

**Architecture:** `InclusionPolicy` lives in `SimState` (Option A). The engine reads it during read fills (invalidate-from-lower on fill in EXCLUSIVE mode) and during evictions (swap-on-clean-eviction in EXCLUSIVE mode). A segmented button in the Hierarchy Builder Panel triggers an `UPDATE_INCLUSION_POLICY` action that resets the simulation.

**Tech Stack:** TypeScript, React, Vite, Vitest for unit tests.

---

### Task 1: Add `InclusionPolicy` type and update `SimState`

**Files:**

- Modify: `src/domain/types.ts`
- Modify: `src/engine/initialState.ts`

**Step 1: Add the type to `src/domain/types.ts`**

Append after the existing type definitions:

```ts
export type InclusionPolicy = "INCLUSIVE" | "EXCLUSIVE";
```

**Step 2: Update `SimState` in `src/engine/initialState.ts`**

Add to the `SimState` type:

```ts
inclusionPolicy: InclusionPolicy;
```

Update `createInitialState` signature:

```ts
export function createInitialState(
  levelConfigs: CacheLevelConfig[],
  inclusionPolicy: InclusionPolicy = "INCLUSIVE"
): SimState {
```

And set it in the returned object:

```ts
return {
  levels,
  memory: ...,
  clock: 0,
  diagnostics: [],
  events: [],
  stats: createStats(),
  inclusionPolicy,
};
```

Also update `cloneState` in `src/engine/simulateStep.ts` to copy `inclusionPolicy`:

```ts
return {
  ...state,
  inclusionPolicy: state.inclusionPolicy
  // ... rest unchanged
};
```

**Step 3: Run existing tests — they should all still pass**

```bash
bun run test --run
```

Expected: all pass (new field has a default, nothing breaks).

**Step 4: Commit**

```bash
git add src/domain/types.ts src/engine/initialState.ts src/engine/simulateStep.ts
git commit -m "feat(types): add InclusionPolicy type and SimState field"
```

---

### Task 2: Implement EXCLUSIVE mode — invalidate-on-fill

**Files:**

- Modify: `src/engine/simulateStep.ts`
- Test: `src/engine/simulateStep.test.ts`

**Background:**
In EXCLUSIVE mode, when a block is filled into level N from level N+1, it must be invalidated (removed) from level N+1. This ensures no block exists in more than one level.

**Step 1: Write a failing test in `src/engine/simulateStep.test.ts`**

Add a test that:

1. Creates a 2-level state in EXCLUSIVE mode
2. Primes L2 with a block by doing a read (so it fills both L1 and L2)
3. Does a second read of a _different_ address that maps to the same L1 set, evicting the first block from L1
4. Reads the first address again — in EXCLUSIVE mode it should be a miss at L1 AND L2 (block was invalidated from L2 when it was first filled into L1), triggering a memory fetch

```ts
it("EXCLUSIVE: block is invalidated from L2 when filled into L1", () => {
  // Setup: 2 levels, direct-mapped, block size 4, EXCLUSIVE
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

  // R 0 → miss at L1 and L2 → fetched from memory, filled into L1 (and L2 in INCLUSIVE, NOT in EXCLUSIVE)
  const r1 = simulateStep(state, { kind: "R", address: 0 });
  // Verify L1 has it, L2 does NOT (exclusive: block moved to L1)
  const l1After = r1.state.levels[0].sets[0].ways[0];
  const l2After = r1.state.levels[1].sets[0].ways[0];
  expect(l1After.valid).toBe(true);
  expect(l2After.valid).toBe(false); // invalidated from L2
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test --run simulateStep
```

Expected: FAIL — currently L2 retains the block.

**Step 3: Implement invalidate-on-fill in `simulateStep.ts`**

In `fillReadMissAtLevel`, after the `setLine(set.ways[victimWay], ...)` call, add:

```ts
// EXCLUSIVE: invalidate block from level N+1 after filling into level N
if (
  mutable.nextState.inclusionPolicy === "EXCLUSIVE" &&
  levelIndex + 1 < mutable.nextState.levels.length
) {
  const nextLevel = mutable.nextState.levels[levelIndex + 1];
  const nextDecoded = decodeAddress({
    address,
    offsetBits: nextLevel.geometry.offsetBits,
    indexBits: nextLevel.geometry.indexBits
  });
  const nextSet = nextLevel.sets[nextDecoded.index];
  const invalidateWayIndex = nextSet.ways.findIndex(
    (way) => way.valid && way.tag === nextDecoded.tag
  );
  if (invalidateWayIndex !== -1) {
    const wayToInvalidate = nextSet.ways[invalidateWayIndex];
    wayToInvalidate.valid = false;
    wayToInvalidate.tag = 0;
    wayToInvalidate.dirty = false;
    wayToInvalidate.dataBytes = Array.from(
      { length: wayToInvalidate.dataBytes.length },
      () => 0
    );
  }
}
```

**Step 4: Run tests**

```bash
bun run test --run simulateStep
```

Expected: new test passes; existing tests pass.

**Step 5: Commit**

```bash
git add src/engine/simulateStep.ts src/engine/simulateStep.test.ts
git commit -m "feat(engine): invalidate block from L(n+1) on fill in EXCLUSIVE mode"
```

---

### Task 3: Implement EXCLUSIVE mode — swap-on-clean-eviction

**Files:**

- Modify: `src/engine/simulateStep.ts`
- Test: `src/engine/simulateStep.test.ts`

**Background:**
In EXCLUSIVE mode, when a _clean_ block is evicted from level N, it should be installed into level N+1 (the block migrates down rather than being discarded). Dirty evictions are unchanged — they write back normally.

**Step 1: Write a failing test**

```ts
it("EXCLUSIVE: clean eviction from L1 installs block into L2", () => {
  // L1: 4 sets * 1 way * 4B = 16B, L2: 16 sets * 1 way * 4B = 64B
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

  // Fill address 0 into L1 (and NOT L2, thanks to Task 2)
  const s1 = simulateStep(state, { kind: "R", address: 0 });
  // Fill address 16 into L1 — same L1 set as address 0 (direct-mapped, 4 sets → set index = addr/4 % 4)
  // address 0 → set 0; address 16 → set 0 — so address 0 gets evicted from L1
  const s2 = simulateStep(s1.state, { kind: "R", address: 16 });

  // Now address 0 was evicted cleanly from L1 → should be in L2
  const l2 = s2.state.levels[1];
  const l2Decoded = decodeAddress({
    address: 0,
    offsetBits: l2.geometry.offsetBits,
    indexBits: l2.geometry.indexBits
  });
  const l2Line = l2.sets[l2Decoded.index].ways.find(
    (w) => w.valid && w.tag === l2Decoded.tag
  );
  expect(l2Line).toBeDefined(); // block migrated to L2
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test --run simulateStep
```

**Step 3: Implement swap-on-clean-eviction in `fillReadMissAtLevel`**

In the eviction block inside `fillReadMissAtLevel`, after the dirty-eviction writeback branch, add handling for clean eviction in EXCLUSIVE mode:

```ts
if (victim.valid) {
  const target = dirtyEvictionTarget(mutable.nextState, levelIndex);
  appendEvent(mutable, { stage: "eviction", ... });
  mutable.nextState.stats.evictions += 1;
  mutable.nextState.stats.perLevel[level.id].evictions += 1;

  if (victim.dirty) {
    // ... existing dirty writeback logic (unchanged) ...
  } else if (
    mutable.nextState.inclusionPolicy === "EXCLUSIVE" &&
    levelIndex + 1 < mutable.nextState.levels.length
  ) {
    // Clean eviction in EXCLUSIVE mode: install evicted block into L(n+1)
    const evictedAddress = encodeAddress({
      tag: victim.tag,
      index: decoded.index,
      offset: 0,
      offsetBits: level.geometry.offsetBits,
      indexBits: level.geometry.indexBits,
    });
    const nextLevel = mutable.nextState.levels[levelIndex + 1];
    const nextDecoded = decodeAddress({
      address: evictedAddress,
      offsetBits: nextLevel.geometry.offsetBits,
      indexBits: nextLevel.geometry.indexBits,
    });
    const nextSet = nextLevel.sets[nextDecoded.index];
    const nextVictimWay = chooseVictimWay(
      nextSet.ways.map((way, wayIndex) => ({
        way: wayIndex,
        valid: way.valid,
        lastUsedAt: way.lastUsedAt,
        insertedAt: way.insertedAt,
      })),
      nextLevel.config.replacementPolicy
    );
    setLine(nextSet.ways[nextVictimWay], {
      tag: nextDecoded.tag,
      dataBytes: victim.dataBytes,
      dirty: false,
      tick: mutable.tick,
      setInsertedAt: true,
    });
  }
}
```

Also apply the same swap-on-clean-eviction logic inside `forwardWrite` (the write-allocate miss eviction path), for consistency.

**Step 4: Run tests**

```bash
bun run test --run simulateStep
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/engine/simulateStep.ts src/engine/simulateStep.test.ts
git commit -m "feat(engine): swap clean eviction to L(n+1) in EXCLUSIVE mode"
```

---

### Task 4: Wire `UPDATE_INCLUSION_POLICY` action through state

**Files:**

- Modify: `src/state/actions.ts`
- Modify: `src/state/reducer.ts`

**Step 1: Add the action to `src/state/actions.ts`**

```ts
import type { CacheLevelConfig, CacheLevelId, InclusionPolicy } from "../domain/types";

// Add to the Action union:
| { type: "UPDATE_INCLUSION_POLICY"; payload: { policy: InclusionPolicy } }
```

**Step 2: Handle the action in `src/state/reducer.ts`**

Add to `AppState`:

```ts
inclusionPolicy: InclusionPolicy;
```

Update `initialAppState`:

```ts
inclusionPolicy: "INCLUSIVE",
```

Update `createSimulationState` to accept and pass through the policy:

```ts
function createSimulationState(
  configLevels: CacheLevelConfig[],
  inclusionPolicy: InclusionPolicy = "INCLUSIVE",
  fallbackState?: SimState
): SimState {
  try {
    return createInitialState(configLevels, inclusionPolicy);
  } catch (error) {
    if (fallbackState) return fallbackState;
    throw error;
  }
}
```

Update all `createSimulationState` call sites to pass `state.inclusionPolicy`.

Add case to `reducer`:

```ts
case "UPDATE_INCLUSION_POLICY": {
  const policy = action.payload.policy;
  return {
    ...state,
    inclusionPolicy: policy,
    simState: createSimulationState(state.configLevels, policy, state.simState),
    nextOpIndex: 0,
    isPlaying: false,
    statusMessage: null,
  };
}
```

**Step 3: Run tests**

```bash
bun run test --run
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/state/actions.ts src/state/reducer.ts
git commit -m "feat(state): wire UPDATE_INCLUSION_POLICY action and AppState field"
```

---

### Task 5: Add UI toggle to HierarchyBuilderPanel

**Files:**

- Modify: `src/ui/config/HierarchyBuilderPanel.tsx`
- Modify: call site (wherever `HierarchyBuilderPanel` is used — find with grep)

**Step 1: Locate the call site**

```bash
grep -r "HierarchyBuilderPanel" src/ --include="*.tsx" -l
```

**Step 2: Update `HierarchyBuilderPanelProps`**

Add:

```ts
import type { CacheLevelConfig, InclusionPolicy, ValidationIssue } from "../../domain/types";

type HierarchyBuilderPanelProps = {
  levels: CacheLevelConfig[];
  warnings: ValidationIssue[];
  errors?: ValidationIssue[];
  inclusionPolicy: InclusionPolicy;
  onUpdateInclusionPolicy: (policy: InclusionPolicy) => void;
  onUpdateLevel: (...) => void;
};
```

**Step 3: Add the segmented toggle above the level cards**

Inside the returned JSX, before `{warnings.length > 0 ? ...}`, add:

```tsx
<div
  className="inclusion-policy-toggle"
  role="group"
  aria-label="Inclusion policy"
>
  <button
    type="button"
    className={`btn ${inclusionPolicy === "INCLUSIVE" ? "btn--active" : "btn--ghost"}`}
    onClick={() => onUpdateInclusionPolicy("INCLUSIVE")}
    aria-pressed={inclusionPolicy === "INCLUSIVE"}
  >
    Inclusive
  </button>
  <button
    type="button"
    className={`btn ${inclusionPolicy === "EXCLUSIVE" ? "btn--active" : "btn--ghost"}`}
    onClick={() => onUpdateInclusionPolicy("EXCLUSIVE")}
    aria-pressed={inclusionPolicy === "EXCLUSIVE"}
  >
    Exclusive
  </button>
</div>
```

**Step 4: Update the call site** to pass `inclusionPolicy` and `onUpdateInclusionPolicy` props, dispatching `UPDATE_INCLUSION_POLICY`.

**Step 5: Add minimal CSS for the toggle group**

Look at `src/styles/` for the appropriate file. Add:

```css
.inclusion-policy-toggle {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.btn--active {
  background: var(--color-accent, #3b82f6);
  color: #fff;
  border-color: transparent;
}
```

**Step 6: Run the dev server to visually verify**

```bash
bun run dev
```

**Step 7: Run all tests**

```bash
bun run test --run
```

**Step 8: Commit**

```bash
git add src/ui/config/HierarchyBuilderPanel.tsx src/styles/ <call-site-file>
git commit -m "feat(ui): add Inclusive/Exclusive toggle to HierarchyBuilderPanel"
```

---

### Task 6: Final verification

**Step 1: Run full test suite**

```bash
bun run test --run
```

Expected: all pass.

**Step 2: Build**

```bash
bun run build
```

Expected: no TypeScript errors, build succeeds.

**Step 3: Manual smoke test**

1. Open dev server
2. Set 2 active cache levels
3. Toggle to Exclusive, run a few reads, verify stats differ from Inclusive
4. Toggle back to Inclusive, reset — verify normal behavior resumes

**Step 4: Commit if anything was missed, then done.**
