# Cache Config Sliders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace geometry number inputs with discrete sliders that support temporary invalid configurations, show soft-invalid range guidance, and preserve existing simulation blocking semantics.

**Architecture:** Keep validation authoritative in `src/validation/validateConfig.ts` and reducer gating in `src/state/reducer.ts`, while moving geometry input behavior to UI-level slider utilities plus per-field visual feedback in `HierarchyBuilderPanel`. Remove reducer-side monotonic auto-correction so user edits are preserved even when invalid, then surface invalidity via inline field errors and slider track shading based on neighbor-level constraints.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, existing reducer/store architecture, CSS in `src/styles/app.css`.

---

## Guardrails

- DRY: centralize slider domain/value formatting and soft-limit calculations in focused UI helper modules.
- YAGNI: no new bypass toggles, no domain model expansion, no changes to policy dropdown behavior.
- TDD for every task: failing test -> run and confirm FAIL -> minimal implementation -> run and confirm PASS -> commit.
- Keep edits reversible and focused: one behavior per task, one conventional commit per task.

### Task 1: Add discrete power-of-two slider domain utilities

**Files:**
- Create: `src/ui/config/sliderDomain.ts`
- Create: `src/ui/config/sliderDomain.test.ts`

**Step 1: Write the failing test**

```ts
// src/ui/config/sliderDomain.test.ts
import { describe, expect, it } from "vitest";
import {
  GEOMETRY_SIZE_OPTIONS,
  toSliderIndex,
  fromSliderIndex,
  formatBytesLabel,
  formatWaysLabel,
} from "./sliderDomain";

describe("sliderDomain", () => {
  it("provides powers-of-two size options from 32B to 32MB", () => {
    expect(GEOMETRY_SIZE_OPTIONS[0]).toBe(32);
    expect(GEOMETRY_SIZE_OPTIONS.at(-1)).toBe(33_554_432);
    expect(GEOMETRY_SIZE_OPTIONS).toHaveLength(21);
  });

  it("maps option values to/from slider indices", () => {
    expect(toSliderIndex(32, GEOMETRY_SIZE_OPTIONS)).toBe(0);
    expect(toSliderIndex(4096, GEOMETRY_SIZE_OPTIONS)).toBe(7);
    expect(fromSliderIndex(7, GEOMETRY_SIZE_OPTIONS)).toBe(4096);
  });

  it("formats bytes and associativity labels for inline display", () => {
    expect(formatBytesLabel(32)).toBe("32 B");
    expect(formatBytesLabel(4096)).toBe("4 KB");
    expect(formatBytesLabel(1_048_576)).toBe("1 MB");
    expect(formatWaysLabel(1)).toBe("1-way");
    expect(formatWaysLabel(8)).toBe("8-way");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/ui/config/sliderDomain.test.ts`
Expected: FAIL with module resolution error for `./sliderDomain`.

**Step 3: Write minimal implementation**

```ts
// src/ui/config/sliderDomain.ts
export const GEOMETRY_SIZE_OPTIONS = Array.from({ length: 21 }, (_, index) => 2 ** (index + 5));
export const ASSOCIATIVITY_OPTIONS = Array.from({ length: 11 }, (_, index) => 2 ** index);

export function toSliderIndex(value: number, options: number[]): number {
  const index = options.indexOf(value);
  return index >= 0 ? index : 0;
}

export function fromSliderIndex(index: number, options: number[]): number {
  const bounded = Math.min(options.length - 1, Math.max(0, index));
  return options[bounded];
}

export function formatBytesLabel(value: number): string {
  if (value >= 1024 * 1024) return `${value / (1024 * 1024)} MB`;
  if (value >= 1024) return `${value / 1024} KB`;
  return `${value} B`;
}

export function formatWaysLabel(value: number): string {
  return `${value}-way`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/ui/config/sliderDomain.test.ts`
Expected: PASS; domain bounds, index mapping, and labels are stable.

**Step 5: Commit**

```bash
git add src/ui/config/sliderDomain.ts src/ui/config/sliderDomain.test.ts
git commit -m "feat(ui): add cache geometry slider domain helpers"
```

### Task 2: Add soft-limit calculation helper for cross-level ordering ranges

**Files:**
- Create: `src/ui/config/softLimits.ts`
- Create: `src/ui/config/softLimits.test.ts`
- Modify: `src/domain/types.ts` (no schema change expected; import-only type usage)

**Step 1: Write the failing test**

```ts
// src/ui/config/softLimits.test.ts
import { describe, expect, it } from "vitest";
import type { CacheLevelConfig } from "../../domain/types";
import { getSoftLimitBounds } from "./softLimits";

const levels: CacheLevelConfig[] = [
  { id: "L1", enabled: true, totalSizeBytes: 256, blockSizeBytes: 32, associativity: 2, replacementPolicy: "LRU", writeHitPolicy: "WRITE_BACK", writeMissPolicy: "WRITE_ALLOCATE" },
  { id: "L2", enabled: true, totalSizeBytes: 512, blockSizeBytes: 64, associativity: 2, replacementPolicy: "LRU", writeHitPolicy: "WRITE_BACK", writeMissPolicy: "WRITE_ALLOCATE" },
  { id: "L3", enabled: false, totalSizeBytes: 1024, blockSizeBytes: 64, associativity: 4, replacementPolicy: "LRU", writeHitPolicy: "WRITE_BACK", writeMissPolicy: "WRITE_ALLOCATE" },
];

describe("getSoftLimitBounds", () => {
  it("returns lower bounds from previous enabled level", () => {
    const l2Total = getSoftLimitBounds(levels, "L2", "totalSizeBytes");
    const l2Block = getSoftLimitBounds(levels, "L2", "blockSizeBytes");
    expect(l2Total.minExclusive).toBe(256);
    expect(l2Block.minInclusive).toBe(32);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/ui/config/softLimits.test.ts`
Expected: FAIL with module resolution error for `./softLimits`.

**Step 3: Write minimal implementation**

```ts
// src/ui/config/softLimits.ts
import type { CacheLevelConfig, CacheLevelId } from "../../domain/types";

type GeometryField = "totalSizeBytes" | "blockSizeBytes";

export function getSoftLimitBounds(levels: CacheLevelConfig[], levelId: CacheLevelId, field: GeometryField) {
  const enabled = levels.filter((level) => level.enabled);
  const index = enabled.findIndex((level) => level.id === levelId);
  const previous = index > 0 ? enabled[index - 1] : null;

  if (field === "totalSizeBytes") {
    return { minExclusive: previous?.totalSizeBytes ?? null };
  }

  return { minInclusive: previous?.blockSizeBytes ?? null };
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/ui/config/softLimits.test.ts`
Expected: PASS; helper derives previous-level lower bounds for soft-invalid shading.

**Step 5: Commit**

```bash
git add src/ui/config/softLimits.ts src/ui/config/softLimits.test.ts
git commit -m "feat(ui): add hierarchy soft-limit bound helper"
```

### Task 3: Convert geometry controls to sliders while preserving policy dropdowns

**Files:**
- Modify: `src/ui/config/HierarchyBuilderPanel.tsx`
- Modify: `src/ui/config/HierarchyBuilderPanel.test.tsx`
- Modify: `src/ui/config/sliderDomain.ts`

**Step 1: Write the failing test**

```ts
// src/ui/config/HierarchyBuilderPanel.test.tsx
it("renders geometry controls as range sliders and keeps policy controls as selects", () => {
  // assert `input[type='range']` for total size, block size, associativity
  // assert replacement policy and write policy controls are still `select`
});

it("dispatches exact discrete option values from slider movement", () => {
  // move L1 total size slider to a specific index and expect onUpdateLevel patch with that exact option value
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/ui/config/HierarchyBuilderPanel.test.tsx -t "renders geometry controls as range sliders"`
Expected: FAIL because controls are still `type=number`.

**Step 3: Write minimal implementation**

```tsx
// src/ui/config/HierarchyBuilderPanel.tsx (core changes)
// - Replace totalSizeBytes/blockSizeBytes/associativity number inputs with range inputs.
// - Use sliderDomain helpers to map index <-> option value.
// - Keep replacement/write policy controls unchanged as select elements.
// - Remove nearest-power-of-two coercion in UI event handlers.
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/ui/config/HierarchyBuilderPanel.test.tsx`
Expected: PASS for slider rendering, dropdown preservation, and deterministic discrete values.

**Step 5: Commit**

```bash
git add src/ui/config/HierarchyBuilderPanel.tsx src/ui/config/HierarchyBuilderPanel.test.tsx src/ui/config/sliderDomain.ts
git commit -m "feat(ui): switch hierarchy geometry fields to discrete sliders"
```

### Task 4: Preserve temporarily invalid edits in reducer (remove monotonic auto-correction)

**Files:**
- Modify: `src/state/reducer.ts`
- Modify: `src/state/reducer.test.ts`
- Modify: `src/state/actions.ts` (confirm no type changes required)

**Step 1: Write the failing test**

```ts
// src/state/reducer.test.ts
it("preserves user-selected cross-level invalid total size during UPDATE_CONFIG", () => {
  // set L1 total above L2 and assert reducer does not auto-mutate L2 upward
  // assert validation contains HIERARCHY_MONOTONICITY error
});

it("preserves user-selected cross-level invalid block size during UPDATE_CONFIG", () => {
  // set L2 block below L1 and assert reducer keeps invalid value
  // assert validation contains BLOCK_SIZE_MONOTONICITY error
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/state/reducer.test.ts -t "preserves user-selected cross-level invalid"`
Expected: FAIL because `constrainEnabledHierarchy` currently rewrites invalid values.

**Step 3: Write minimal implementation**

```ts
// src/state/reducer.ts
// In UPDATE_CONFIG:
// - remove call to constrainEnabledHierarchy(updatedLevels)
// - set configLevels = updatedLevels directly
// - keep final-enabled-level guard unchanged
// - keep validateConfig(configLevels) and createSimulationState(...) flow unchanged
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/state/reducer.test.ts`
Expected: PASS; reducer keeps invalid edits, validation still reports errors, run gating still derives from errors.

**Step 5: Commit**

```bash
git add src/state/reducer.ts src/state/reducer.test.ts
git commit -m "refactor(state): preserve invalid hierarchy edits during config updates"
```

### Task 5: Surface inline field-level validation in hierarchy panel

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ui/config/HierarchyBuilderPanel.tsx`
- Modify: `src/ui/config/HierarchyBuilderPanel.test.tsx`
- Modify: `src/validation/validateConfig.ts` (message stability only if needed)
- Modify: `src/validation/validateConfig.test.ts` (assertions for message/code consistency)

**Step 1: Write the failing test**

```ts
// src/ui/config/HierarchyBuilderPanel.test.tsx
it("shows inline helper text and invalid styling for geometry fields with errors", () => {
  // render panel with validation errors for L2 hierarchy monotonicity / block monotonicity
  // assert helper text under matching slider
  // assert `aria-invalid=true` and error class/data attribute
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/ui/config/HierarchyBuilderPanel.test.tsx -t "shows inline helper text and invalid styling"`
Expected: FAIL because panel currently only receives warnings and has no field-level error rendering.

**Step 3: Write minimal implementation**

```tsx
// src/App.tsx
// Pass `state.validation.errors` to HierarchyBuilderPanel as new prop.

// src/ui/config/HierarchyBuilderPanel.tsx
// - add `errors` prop
// - map error codes/messages to field buckets:
//   * GEOMETRY_INCONSISTENT: totalSizeBytes, blockSizeBytes, associativity (based on message text)
//   * HIERARCHY_MONOTONICITY: totalSizeBytes
//   * BLOCK_SIZE_MONOTONICITY: blockSizeBytes
// - render helper <p> under each affected slider
// - set `aria-invalid` and a class/data-flag for invalid fields
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/ui/config/HierarchyBuilderPanel.test.tsx src/validation/validateConfig.test.ts`
Expected: PASS; inline helpers appear deterministically from existing validation outputs.

**Step 5: Commit**

```bash
git add src/App.tsx src/ui/config/HierarchyBuilderPanel.tsx src/ui/config/HierarchyBuilderPanel.test.tsx src/validation/validateConfig.test.ts
git commit -m "feat(ui): show per-field inline validation in hierarchy sliders"
```

### Task 6: Add soft-invalid slider range shading and error visuals

**Files:**
- Modify: `src/ui/config/HierarchyBuilderPanel.tsx`
- Modify: `src/styles/app.css`
- Modify: `src/ui/config/HierarchyBuilderPanel.test.tsx`
- Modify: `src/ui/config/softLimits.ts`

**Step 1: Write the failing test**

```ts
// src/ui/config/HierarchyBuilderPanel.test.tsx
it("marks out-of-order slider regions as soft-invalid without disabling editing", () => {
  // set L1 > L2 total size, assert L2 total slider has data attrs for invalid lower segment
  // change slider anyway and assert onUpdateLevel still fires
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/ui/config/HierarchyBuilderPanel.test.tsx -t "soft-invalid"`
Expected: FAIL; no shading metadata/classes exist yet.

**Step 3: Write minimal implementation**

```tsx
// src/ui/config/HierarchyBuilderPanel.tsx
// - compute invalid lower region percentage from soft-limit helper + option indices
// - expose CSS variables/data attrs per slider:
//   --invalid-start-pct, --invalid-end-pct, data-soft-invalid="true|false"
// - never disable the slider due to soft-invalid state
```

```css
/* src/styles/app.css */
/* - add slider track styles using linear-gradient + CSS vars for invalid-range shading
   - add invalid thumb/outline/helper text styles for soft-invalid and hard-invalid states */
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/ui/config/HierarchyBuilderPanel.test.tsx`
Expected: PASS; soft-invalid state is visible through stable attributes and remains editable.

**Step 5: Commit**

```bash
git add src/ui/config/HierarchyBuilderPanel.tsx src/styles/app.css src/ui/config/HierarchyBuilderPanel.test.tsx src/ui/config/softLimits.ts
git commit -m "feat(ui): add soft-invalid slider track shading for hierarchy ordering"
```

### Task 7: Lock in validation and reducer blocking/unblocking regression coverage

**Files:**
- Modify: `src/validation/validateConfig.ts` (no rule changes expected; keep as authority)
- Modify: `src/validation/validateConfig.test.ts`
- Modify: `src/state/reducer.test.ts`
- Modify: `tests/integration/validation-blocking.test.tsx`
- Modify: `src/ui/controls/GlobalControlBar.tsx` (no behavior change expected)

**Step 1: Write the failing test**

```ts
// tests/integration/validation-blocking.test.tsx
it("re-enables run flow after correcting slider-driven invalid hierarchy", () => {
  // drive reducer through invalid UPDATE_CONFIG then corrective UPDATE_CONFIG
  // assert selectCanRunSimulation transitions false -> true
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/integration/validation-blocking.test.tsx -t "re-enables run flow"`
Expected: FAIL until new correction-path assertions are added and behavior is confirmed.

**Step 3: Write minimal implementation**

```ts
// src/state/reducer.test.ts + tests/integration/validation-blocking.test.tsx
// - add invalid -> corrected scenarios for totalSizeBytes and blockSizeBytes
// - assert blocking message remains "Fix configuration errors to simulate." while invalid
// - assert run/step become available again when corrected
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/validation/validateConfig.test.ts src/state/reducer.test.ts tests/integration/validation-blocking.test.tsx`
Expected: PASS; existing validation/reducer gating behavior remains intact with editable-invalid flow.

**Step 5: Commit**

```bash
git add src/validation/validateConfig.test.ts src/state/reducer.test.ts tests/integration/validation-blocking.test.tsx
git commit -m "test: cover slider invalid-to-valid blocking recovery flow"
```

### Task 8: Final verification sweep for touched UI/state/validation suites

**Files:**
- Modify: `docs/plans/2026-03-03-cache-config-sliders.md` (checkboxes/status only, optional)
- Verify unchanged contracts: `src/domain/types.ts`, `src/state/actions.ts`, `src/ui/controls/GlobalControlBar.tsx`

**Step 1: Write failing test**

Add a temporary regression assertion if any uncovered edge remains from prior tasks (for example nearest-boundary slider index handling) in the closest suite.

**Step 2: Run targeted test to verify it fails**

Run: `bun run test -- src/ui/config/sliderDomain.test.ts src/ui/config/HierarchyBuilderPanel.test.tsx`
Expected: FAIL for the temporary new edge assertion.

**Step 3: Write minimal implementation**

Apply the smallest fix in the helper/component identified by the failure, without adding new model/action surface area.

**Step 4: Run full pass for this feature slice**

Run: `bun run test -- src/ui/config/sliderDomain.test.ts src/ui/config/softLimits.test.ts src/ui/config/HierarchyBuilderPanel.test.tsx src/validation/validateConfig.test.ts src/state/reducer.test.ts tests/integration/validation-blocking.test.tsx`
Expected: PASS across UI + validation + reducer + integration suites touched by slider migration.

**Step 5: Commit**

```bash
git add src/ui/config src/styles/app.css src/App.tsx src/state/reducer.ts src/state/reducer.test.ts src/validation/validateConfig.test.ts tests/integration/validation-blocking.test.tsx
git commit -m "chore: verify cache config slider migration end-to-end"
```

## Notes for implementation session

- Keep replacement/write policies as dropdowns in `src/ui/config/HierarchyBuilderPanel.tsx`.
- Do not introduce a bypass toggle for invalid config.
- Prefer local UI helpers over domain-model changes; `src/domain/types.ts` and `src/state/actions.ts` should stay structurally unchanged unless a test proves otherwise.
- Preserve existing simulation gating flow through `validateConfig` -> reducer validation state -> `selectCanRunSimulation` -> `GlobalControlBar` disabled state.
