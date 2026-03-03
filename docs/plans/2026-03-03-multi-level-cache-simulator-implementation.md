# Multi-Level Cache Simulator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a deterministic, educational, browser-only multi-level cache simulator (L1-L3) with validated configuration, workload parsing, step/run controls, and clear visual feedback for cache behavior.

**Architecture:** Implement a static SPA using Vite + React + TypeScript, with a pure simulation engine and immutable reducer-driven app state. Keep domain, parser, validation, simulation, and UI modules isolated so logic remains testable and reusable. Drive all behavior through deterministic events so stepping, playback, reset, and stats are reproducible.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, Playwright, npm, Vercel static hosting.

---

## Guardrails (apply to every task)

- DRY: reuse shared helpers (`src/domain/geometry.ts`, `src/engine/addressing.ts`, `src/test/factories.ts`) instead of duplicating formulas.
- YAGNI: ship only approved v1 scope (single simulation instance, no backend, no side-by-side compare mode, desktop-first with minimal mobile fallback).
- TDD: for each behavior, write failing tests first, run to confirm failure, write minimal implementation, rerun tests to pass.
- Frequent commits: commit after each task with a focused conventional commit message.

### Task 1: Scaffold SPA, toolchain, and static deploy baseline

**Files:**
- Create: `index.html`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `.eslintrc.cjs`
- Create: `.prettierrc`
- Create: `vercel.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/theme.css`
- Create: `src/styles/app.css`
- Create: `src/test/setup.ts`
- Create: `tests/smoke/app-load.spec.ts`
- Create: `.github/workflows/ci.yml`

**Step 1: Write scaffold smoke test first**

```ts
// tests/smoke/app-load.spec.ts
import { test, expect } from "@playwright/test";

test("app shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Multi-Level Cache Simulator" })).toBeVisible();
});
```

**Step 2: Run test to confirm failure (before scaffold exists)**

Run: `bun run test:e2e -- tests/smoke/app-load.spec.ts`
Expected: FAIL (missing app files/build setup).

**Step 3: Add minimal scaffold and scripts**

```json
// package.json
{
  "name": "cache-simulator",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint . --ext .ts,.tsx"
  }
}
```

```json
// vercel.json
{
  "framework": "vite",
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "routes": [{ "src": "/(.*)", "dest": "/index.html" }]
}
```

```tsx
// src/App.tsx
export function App() {
  return <h1>Multi-Level Cache Simulator</h1>;
}
```

**Step 4: Run scaffold verification**

Run: `bun run test && bun run test:e2e -- tests/smoke/app-load.spec.ts`
Expected: PASS; smoke test finds heading.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold vite react typescript simulator app"
```

### Task 2: Define domain model, finite memory bounds, and v1 boundaries in code

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/constants.ts`
- Create: `src/domain/geometry.ts`
- Create: `src/test/factories.ts`
- Test: `src/domain/types.test.ts`
- Test: `src/domain/geometry.test.ts`
- Test: `src/domain/constants.test.ts`

**Step 1: Write failing domain tests**

```ts
// src/domain/geometry.test.ts
import { describe, it, expect } from "vitest";
import { deriveGeometry } from "./geometry";

describe("deriveGeometry", () => {
  it("computes sets and bit widths", () => {
    expect(deriveGeometry({ totalSizeBytes: 256, blockSizeBytes: 16, associativity: 2 })).toEqual({
      numSets: 8,
      offsetBits: 4,
      indexBits: 3
    });
  });
});
```

```ts
// src/domain/constants.test.ts
import { describe, it, expect } from "vitest";
import { V1_LIMITS } from "./constants";

describe("V1_LIMITS", () => {
  it("defines finite memory address bounds and legal value range", () => {
    expect(V1_LIMITS.memoryWords).toBe(1024);
    expect(V1_LIMITS.minAddress).toBe(0);
    expect(V1_LIMITS.maxAddress).toBe(1023);
    expect(V1_LIMITS.minValue).toBe(0);
    expect(V1_LIMITS.maxValue).toBe(255);
  });
});
```

```ts
// src/domain/types.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type { CacheLevelConfig } from "./types";

describe("CacheLevelConfig", () => {
  it("keeps write-hit and write-miss policy fields as separate per-level properties", () => {
    expectTypeOf<CacheLevelConfig>().toMatchTypeOf<{
      writeHitPolicy: "WRITE_THROUGH" | "WRITE_BACK";
      writeMissPolicy: "WRITE_ALLOCATE" | "WRITE_NO_ALLOCATE";
    }>();
  });
});
```

**Step 2: Run test to verify failure**

Run: `bun run test -- src/domain/geometry.test.ts`
Expected: FAIL (`Cannot find module './geometry'`).

**Step 3: Add domain types/constants/geometry**

```ts
// src/domain/constants.ts
export const V1_LIMITS = {
  minLevels: 1,
  maxLevels: 3,
  memoryWords: 1024,
  minAddress: 0,
  maxAddress: 1023,
  minValue: 0,
  maxValue: 255,
  singleSimulationOnly: true,
  backendEnabled: false,
  compareModeEnabled: false
} as const;
```

```ts
// src/domain/types.ts
export type ReplacementPolicy = "LRU" | "FIFO";
export type WriteHitPolicy = "WRITE_THROUGH" | "WRITE_BACK";
export type WriteMissPolicy = "WRITE_ALLOCATE" | "WRITE_NO_ALLOCATE";

export type CacheLevelConfig = {
  id: "L1" | "L2" | "L3";
  enabled: boolean;
  totalSizeBytes: number;
  blockSizeBytes: number;
  associativity: number;
  replacementPolicy: ReplacementPolicy;
  writeHitPolicy: WriteHitPolicy;
  writeMissPolicy: WriteMissPolicy;
};
```

```ts
// src/domain/geometry.ts
export function deriveGeometry(input: { totalSizeBytes: number; blockSizeBytes: number; associativity: number }) {
  const numSets = input.totalSizeBytes / (input.blockSizeBytes * input.associativity);
  const offsetBits = Math.log2(input.blockSizeBytes);
  const indexBits = Math.log2(numSets);
  return { numSets, offsetBits, indexBits };
}
```

**Step 4: Run targeted tests**

Run: `bun run test -- src/domain/types.test.ts src/domain/geometry.test.ts src/domain/constants.test.ts`
Expected: PASS; geometry, type fixtures, and finite bounds validate.

**Step 5: Commit**

```bash
git add src/domain src/test/factories.ts
git commit -m "feat(domain): add cache hierarchy types geometry and finite memory bounds"
```

### Task 3: Build workload parser with line diagnostics and range enforcement

**Files:**
- Create: `src/parser/parseWorkload.ts`
- Create: `src/parser/tokenizeNumber.ts`
- Test: `src/parser/parseWorkload.test.ts`

**Step 1: Write failing parser tests for accepted forms and errors**

```ts
// src/parser/parseWorkload.test.ts
import { describe, it, expect } from "vitest";
import { parseWorkload } from "./parseWorkload";

describe("parseWorkload", () => {
  it("parses read and write with decimal and hex", () => {
    const result = parseWorkload("R 26\nW 0x1A 255");
    expect(result.errors).toEqual([]);
    expect(result.ops).toEqual([
      { kind: "R", address: 26 },
      { kind: "W", address: 26, value: 255 }
    ]);
  });

  it("ignores comments and blank lines", () => {
    const result = parseWorkload("# warmup\n\nR 4\n");
    expect(result.ops).toEqual([{ kind: "R", address: 4 }]);
  });

  it("returns line-specific errors", () => {
    const result = parseWorkload("W 12\nQ 3\nR nope");
    expect(result.errors).toEqual([
      expect.objectContaining({ line: 1 }),
      expect.objectContaining({ line: 2 }),
      expect.objectContaining({ line: 3 })
    ]);
  });

  it("accepts lower and upper bounds for address/value", () => {
    const result = parseWorkload("R 0\nR 1023\nW 0 0\nW 1023 255");
    expect(result.errors).toEqual([]);
    expect(result.ops).toHaveLength(4);
  });

  it("emits explicit out-of-range diagnostics for address and value", () => {
    const result = parseWorkload("R -1\nR 1024\nW 4 256\nW 4 -1");
    expect(result.errors).toEqual([
      expect.objectContaining({ line: 1, message: expect.stringContaining("address out of range") }),
      expect.objectContaining({ line: 2, message: expect.stringContaining("address out of range") }),
      expect.objectContaining({ line: 3, message: expect.stringContaining("value out of range") }),
      expect.objectContaining({ line: 4, message: expect.stringContaining("value out of range") })
    ]);
  });
});
```

**Step 2: Run parser test to confirm failure**

Run: `bun run test -- src/parser/parseWorkload.test.ts`
Expected: FAIL (parser module missing).

**Step 3: Implement parser and numeric tokenizer**

```ts
// src/parser/tokenizeNumber.ts
export function parseNumericToken(raw: string): number | null {
  const token = raw.trim();
  if (/^0x[0-9a-f]+$/i.test(token)) return Number.parseInt(token, 16);
  if (/^[0-9]+$/.test(token)) return Number.parseInt(token, 10);
  return null;
}
```

```ts
// src/parser/parseWorkload.ts
export function parseWorkload(input: string) {
  // Return { ops, errors }, skipping blank/comment lines and collecting per-line diagnostics.
}
```

Implementation requirements:
- Accept `R <address>` and `W <address> <value>`.
- Allow lowercase op tokens by normalizing to uppercase.
- Ignore blank lines and `#` comments.
- Emit explicit message text: `Line <n>: ...`.
- Enforce v1 ranges from `V1_LIMITS`: addresses `0..1023`, values `0..255`.
- Emit explicit out-of-range diagnostics:
  - `Line <n>: address out of range (expected 0..1023)`
  - `Line <n>: value out of range (expected 0..255)`
- Do not throw on bad lines; continue parsing remaining lines.

**Step 4: Run parser tests**

Run: `bun run test -- src/parser/parseWorkload.test.ts`
Expected: PASS; all parse and error scenarios are stable.

**Step 5: Commit**

```bash
git add src/parser
git commit -m "feat(parser): add workload parser diagnostics and range checks"
```

### Task 4: Implement configuration validation engine with warnings

**Files:**
- Create: `src/validation/validateConfig.ts`
- Test: `src/validation/validateConfig.test.ts`
- Modify: `src/domain/types.ts`

**Step 1: Write failing validation tests**

```ts
// src/validation/validateConfig.test.ts
import { describe, it, expect } from "vitest";
import { validateConfig } from "./validateConfig";

describe("validateConfig", () => {
  it("errors on non power-of-two sizes", () => {
    const result = validateConfig([{
      id: "L1", enabled: true, totalSizeBytes: 192, blockSizeBytes: 24, associativity: 3,
      replacementPolicy: "LRU", writeHitPolicy: "WRITE_BACK", writeMissPolicy: "WRITE_ALLOCATE"
    }]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("errors when size equation is inconsistent", () => {
    const result = validateConfig([/* config fixture with non-integer set count */]);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "GEOMETRY_INCONSISTENT" }));
  });

  it("errors on non-monotonic hierarchy", () => {
    const result = validateConfig([/* L1 larger than L2 */]);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "HIERARCHY_MONOTONICITY" }));
  });

  it("errors when next-level block size is smaller than previous level", () => {
    const result = validateConfig([/* L1 block 64, L2 block 32 */]);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "BLOCK_SIZE_MONOTONICITY" }));
  });

  it("warns for non-standard write policy combos", () => {
    const result = validateConfig([/* WRITE_BACK + WRITE_NO_ALLOCATE */]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "NON_STANDARD_POLICY" }));
  });

  it("keeps non-standard policy combos as warnings only", () => {
    const result = validateConfig([/* WRITE_THROUGH + WRITE_ALLOCATE */]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "NON_STANDARD_POLICY" }));
  });
});
```

**Step 2: Run test to verify failure**

Run: `bun run test -- src/validation/validateConfig.test.ts`
Expected: FAIL (missing validator).

**Step 3: Implement validator**

```ts
// src/validation/validateConfig.ts
export function validateConfig(levels: CacheLevelConfig[]) {
  // Return { errors: ValidationIssue[], warnings: ValidationIssue[] }
  // Rules: power-of-two, equation consistency, L(n+1) size and block monotonicity, policy sanity warnings.
}
```

Validation rules:
- Hard error: `blockSizeBytes`, `associativity`, and derived `numSets` must be positive powers of two.
- Hard error: `totalSizeBytes === numSets * associativity * blockSizeBytes` with integer `numSets`.
- Hard error: for enabled adjacent levels, `totalSizeBytes(next) > totalSizeBytes(prev)` and `blockSizeBytes(next) >= blockSizeBytes(prev)`.
- Warning only: `WRITE_BACK + WRITE_NO_ALLOCATE` and `WRITE_THROUGH + WRITE_ALLOCATE` flagged as non-standard.
- Warnings are non-blocking by design; only `errors.length > 0` blocks simulation controls.

**Step 4: Run validation tests**

Run: `bun run test -- src/validation/validateConfig.test.ts`
Expected: PASS; errors vs warnings separated correctly.

**Step 5: Commit**

```bash
git add src/validation src/domain/types.ts
git commit -m "feat(validation): enforce cache config invariants and policy warnings"
```

### Task 5: Implement deterministic simulation core and event model

**Files:**
- Create: `src/engine/addressing.ts`
- Create: `src/engine/replacement.ts`
- Create: `src/engine/simulateStep.ts`
- Create: `src/engine/cascade.ts`
- Create: `src/engine/initialState.ts`
- Test: `src/engine/addressing.test.ts`
- Test: `src/engine/replacement.test.ts`
- Test: `src/engine/simulateStep.test.ts`

**Step 1: Write failing address decode and replacement tests**

```ts
// src/engine/addressing.test.ts
import { describe, it, expect } from "vitest";
import { decodeAddress } from "./addressing";

describe("decodeAddress", () => {
  it("splits tag/index/offset", () => {
    expect(decodeAddress({ address: 0b110101, offsetBits: 2, indexBits: 2 })).toEqual({
      tag: 0b11,
      index: 0b01,
      offset: 0b01
    });
  });
});
```

```ts
// src/engine/replacement.test.ts
import { describe, it, expect } from "vitest";
import { chooseVictimWay } from "./replacement";

describe("chooseVictimWay", () => {
  it("prefers invalid way before eviction", () => { /* ... */ });
  it("uses LRU policy when all ways valid", () => { /* ... */ });
  it("uses FIFO policy when all ways valid", () => { /* ... */ });
});
```

**Step 2: Run tests to verify failure**

Run: `bun run test -- src/engine/addressing.test.ts src/engine/replacement.test.ts`
Expected: FAIL (engine modules missing).

**Step 3: Implement pure engine modules**

```ts
// src/engine/simulateStep.ts
export function simulateStep(state: SimState, op: WorkloadOp): SimStepResult {
  // 1) decode tag/index/offset per active level
  // 2) choose set by index
  // 3) compare tag across valid ways
  // 4) apply read/write hit-miss behavior
  // 5) apply replacement (LRU/FIFO)
  // 6) cascade dirty write-back evictions down levels or memory
  // 7) update stats + append event log
  // 8) return new immutable state
}
```

Simulation requirements:
- Evaluate `writeHitPolicy` and `writeMissPolicy` independently at each level; never assume one global write policy.
- On write miss, branch explicitly between WA and WNA before deciding WT/WB handling.
- WA path must then apply WT/WB behavior after fill.
- WNA path must bypass local fill and forward write to the next level (or memory at terminal level).
- Preserve deterministic event ordering for all branches so timeline playback is stable.
- Add runtime guardrail for direct engine calls: if op address/value violates `V1_LIMITS`, return explicit diagnostic (for example `Runtime: address out of range (expected 0..1023)`) and skip mutation.

Required event payload fields:
- `stage`: `decode | compare | hit | miss | fill | eviction | writeback | memory`.
- `levelId`, `opKind`, `address`, `tag`, `index`, `offset`.
- `comparedWays[]` with `{ way, valid, tag, match }`.
- `victimWay` and `dirtyEvictionTarget` when applicable.

**Step 4: Add end-to-end engine behavior tests (read/write + cascade)**

```ts
// src/engine/simulateStep.test.ts
it("marks dirty on write-back hit and emits cascade on dirty eviction", () => {
  // arrange L1/L2, perform writes to force eviction, assert writeback events order
});

it("propagates write-through hits downstream immediately", () => {
  // assert downstream write event and memory traffic increments
});

it("handles write-miss WA + WT by filling then propagating write", () => {
  // assert miss -> fill event -> downstream write event sequence
});

it("handles write-miss WA + WB by filling then marking dirty", () => {
  // assert fill created line and dirty bit set without immediate downstream write
});

it("handles write-miss WNA by bypassing local fill and forwarding downstream", () => {
  // assert no local allocation event and downstream (or memory) write occurs
});

it("returns explicit runtime diagnostic when an out-of-range op bypasses parser", () => {
  // call simulateStep with address 1024 or value 256, assert no state mutation and diagnostic message
});
```

Run: `bun run test -- src/engine/simulateStep.test.ts`
Expected: PASS with deterministic event sequence assertions.

**Step 5: Commit**

```bash
git add src/engine
git commit -m "feat(engine): add deterministic cache simulation pipeline"
```

### Task 6: Add immutable app store/reducer for control flow

**Files:**
- Create: `src/state/actions.ts`
- Create: `src/state/reducer.ts`
- Create: `src/state/store.tsx`
- Create: `src/state/selectors.ts`
- Create: `src/workloads/examples.ts`
- Test: `src/state/reducer.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write failing reducer tests for required actions**

```ts
// src/state/reducer.test.ts
import { describe, it, expect } from "vitest";
import { reducer, initialAppState } from "./reducer";

describe("app reducer", () => {
  it("loads built-in example trace into editor text and parse preview", () => { /* LOAD_EXAMPLE_TRACE */ });
  it("loads parsed trace", () => { /* LOAD_TRACE */ });
  it("steps one operation", () => { /* STEP */ });
  it("advances on play tick", () => { /* PLAY_TICK */ });
  it("pauses playback", () => { /* PAUSE */ });
  it("resets simulation", () => { /* RESET */ });
  it("updates config and revalidates", () => { /* UPDATE_CONFIG */ });
  it("updates writeHitPolicy per level without mutating other levels", () => { /* UPDATE_CONFIG */ });
  it("updates writeMissPolicy per level without mutating other levels", () => { /* UPDATE_CONFIG */ });
  it("blocks STEP and PLAY_TICK when parseResult.errors.length > 0", () => { /* gating */ });
  it("allows STEP and PLAY_TICK when only warnings exist", () => { /* warning-only */ });
});
```

**Step 2: Run tests to verify failure**

Run: `bun run test -- src/state/reducer.test.ts`
Expected: FAIL (state modules missing).

**Step 3: Implement reducer/store/selectors**

```ts
// src/state/actions.ts
export type Action =
  | { type: "LOAD_EXAMPLE_TRACE"; payload: { exampleId: string } }
  | { type: "LOAD_TRACE"; payload: { text: string } }
  | { type: "STEP" }
  | { type: "PLAY_TICK" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "UPDATE_CONFIG"; payload: { levelId: "L1" | "L2" | "L3"; patch: Partial<CacheLevelConfig> } };
```

```ts
// src/workloads/examples.ts
export const BUILTIN_WORKLOAD_EXAMPLES = [
  {
    id: "sequential-read-warmup",
    label: "Sequential Read Warmup",
    description: "Simple read walk to illustrate compulsory misses and then hits.",
    text: "R 0\nR 4\nR 8\nR 0\nR 4"
  },
  {
    id: "writeback-eviction-cascade",
    label: "Write-Back Eviction Cascade",
    description: "Writes that force dirty eviction and downstream write-back.",
    text: "W 0 10\nW 64 20\nW 128 30\nR 0"
  },
  {
    id: "wna-bypass-demo",
    label: "Write-No-Allocate Bypass",
    description: "Write misses that bypass local allocation under WNA.",
    text: "W 32 7\nW 96 9\nR 32"
  }
] as const;
```

```ts
// src/state/reducer.ts
export function reducer(state: AppState, action: Action): AppState {
  // Always return new state object; never mutate nested cache arrays in place.
}
```

Implementation requirements:
- `LOAD_EXAMPLE_TRACE` must look up `exampleId` in `src/workloads/examples.ts`, set editor text, parse it, and refresh preview operations/diagnostics.
- Keep `writeHitPolicy` and `writeMissPolicy` as separate fields in state for each level.
- `UPDATE_CONFIG` must patch one level at a time by `levelId`; never broadcast policy changes to all levels.
- Re-run config validation after each policy change and preserve warning vs error separation.
- Hard-gate simulation controls in reducer: if `parseResult.errors.length > 0`, `STEP` and `PLAY_TICK` become no-ops and set blocking UI text `Fix parse errors before running simulation.`
- Warning-only states remain runnable (warnings never trigger `STEP`/`RUN` blocking).

**Step 4: Verify reducer behavior**

Run: `bun run test -- src/state/reducer.test.ts`
Expected: PASS; all required action paths produce deterministic state.

**Step 5: Commit**

```bash
git add src/state src/workloads/examples.ts src/App.tsx
git commit -m "feat(state): add reducer gating and built-in workload loading"
```

### Task 7: Build UI shell and simulator panels

**Files:**
- Create: `src/ui/layout/AppShell.tsx`
- Create: `src/ui/controls/GlobalControlBar.tsx`
- Create: `src/ui/config/HierarchyBuilderPanel.tsx`
- Create: `src/ui/stats/StatsPanel.tsx`
- Create: `src/ui/cache/CacheVisualizationPanel.tsx`
- Create: `src/ui/memory/MemoryPanel.tsx`
- Create: `src/ui/workload/WorkloadEditorPanel.tsx`
- Create: `src/ui/timeline/EventTimelinePanel.tsx`
- Create: `src/ui/common/CollapsibleCard.tsx`
- Test: `src/ui/layout/AppShell.test.tsx`
- Test: `src/ui/workload/WorkloadEditorPanel.test.tsx`
- Test: `src/ui/controls/GlobalControlBar.test.tsx`
- Test: `src/ui/config/HierarchyBuilderPanel.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write failing UI interaction tests**

```tsx
// src/ui/controls/GlobalControlBar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalControlBar } from "./GlobalControlBar";

it("keeps control bar visible and dispatches step/run/pause/reset", async () => {
  // render with callbacks; assert callback calls
});
```

```tsx
// src/ui/workload/WorkloadEditorPanel.test.tsx
it("renders parser diagnostics preview with line numbers", async () => {
  // type invalid input; assert line-specific errors visible
});

it("loads selected built-in example into editor and parsed preview", async () => {
  // choose example from selector; assert textarea text and parsed op preview update
});
```

```tsx
// src/ui/config/HierarchyBuilderPanel.test.tsx
it("renders separate write-hit and write-miss controls per enabled level", async () => {
  // set L1/L2 enabled; change L1 writeMissPolicy; assert L2 selection unchanged
});

it("shows non-standard policy warnings without blocking config edits", async () => {
  // choose WB+WNA or WT+WA; assert warning text visible and panel stays interactive
});
```

```tsx
// src/ui/layout/AppShell.test.tsx
it("applies progressive disclosure defaults for collapsible panels", () => {
  // assert default: hierarchy/workload/stats expanded; memory collapsed
});

it("uses desktop-first layout and falls back to functional stacked mobile layout", () => {
  // assert desktop two-column container class; mobile breakpoint stacks panels without parity assertions
});
```

**Step 2: Run UI tests to verify failure**

Run: `bun run test -- src/ui/layout/AppShell.test.tsx src/ui/controls/GlobalControlBar.test.tsx src/ui/config/HierarchyBuilderPanel.test.tsx src/ui/workload/WorkloadEditorPanel.test.tsx`
Expected: FAIL (components missing).

**Step 3: Implement panel components and wire to state**

```tsx
// src/ui/cache/CacheVisualizationPanel.tsx
// Show sets/ways with valid, dirty, tag, and per-block data toggle.
// Highlight active set/way from latest event.
```

```tsx
// src/ui/memory/MemoryPanel.tsx
// Render sparse list: only addresses accessed/modified so far.
```

```tsx
// src/ui/config/HierarchyBuilderPanel.tsx
// Collapsible; enforce fields for total size, block size, associativity, policies.
```

UI composition requirements:
- Global control bar remains visible at top during scroll.
- Hierarchy builder, workload input, stats, event timeline, cache level cards, and memory panels are collapsible.
- Progressive disclosure defaults: hierarchy/workload/stats expanded, event timeline expanded while stepping, enabled cache levels expanded, memory collapsed.
- Stats panel supports floating mode on desktop.
- Workload editor includes parsed preview list.
- Workload editor includes built-in example selector wired to `LOAD_EXAMPLE_TRACE`.
- Event timeline is always available in results column.
- Desktop-first two-column layout is the primary target; mobile is functional stacked fallback only (no parity requirement).

**Step 4: Run UI tests and smoke app test**

Run: `bun run test -- src/ui/layout/AppShell.test.tsx src/ui/controls/GlobalControlBar.test.tsx src/ui/config/HierarchyBuilderPanel.test.tsx src/ui/workload/WorkloadEditorPanel.test.tsx && bun run test:e2e -- tests/smoke/app-load.spec.ts`
Expected: PASS; core sections render and interactions dispatch actions.

**Step 5: Commit**

```bash
git add src/ui src/App.tsx
git commit -m "feat(ui): add simulator panels and control surfaces"
```

### Task 8: Add clean academic theme with minimal dark mode

**Files:**
- Modify: `src/styles/theme.css`
- Modify: `src/styles/app.css`
- Create: `src/ui/common/ThemeToggle.tsx`
- Test: `src/ui/common/ThemeToggle.test.tsx`
- Modify: `src/ui/controls/GlobalControlBar.tsx`

**Step 1: Write failing theme toggle test**

```tsx
// src/ui/common/ThemeToggle.test.tsx
it("defaults to light and toggles dark class", async () => {
  // assert documentElement dataset/class transitions
});
```

**Step 2: Run test to verify failure**

Run: `bun run test -- src/ui/common/ThemeToggle.test.tsx`
Expected: FAIL (toggle not implemented).

**Step 3: Implement tokenized theme system**

```css
/* src/styles/theme.css */
:root {
  --bg: #f3f6fb;
  --panel: #ffffff;
  --text: #122033;
  --muted: #4c6078;
  --accent: #2f6fb2;
}

[data-theme="dark"] {
  --bg: #0f1722;
  --panel: #172233;
  --text: #e6edf7;
  --muted: #9fb0c5;
  --accent: #6da6e4;
}
```

Implementation notes:
- Keep light as default.
- Dark mode is minimal functional variant, not separate visual redesign.
- Preserve readability for monospace data fields.

**Step 4: Run theme tests and visual smoke**

Run: `bun run test -- src/ui/common/ThemeToggle.test.tsx && bun run test:e2e -- tests/smoke/app-load.spec.ts`
Expected: PASS; theme defaults to light and toggles cleanly.

**Step 5: Commit**

```bash
git add src/styles src/ui/common/ThemeToggle.tsx src/ui/controls/GlobalControlBar.tsx
git commit -m "feat(ui): apply academic theme tokens and dark mode toggle"
```

### Task 9: Add integration and smoke coverage for step/run/reset and validation gating

**Files:**
- Create: `tests/integration/simulator-flow.test.tsx`
- Create: `tests/integration/validation-blocking.test.tsx`
- Create: `tests/e2e/step-run-reset.spec.ts`
- Modify: `playwright.config.ts`

**Step 1: Write failing integration tests for complete flow**

```tsx
// tests/integration/simulator-flow.test.tsx
it("loads trace then step/run/pause/reset updates timeline and stats", async () => {
  // render App, load workload, dispatch user actions, assert timeline length and counters
});
```

```tsx
// tests/integration/validation-blocking.test.tsx
it("blocks simulation controls when config has hard validation errors", async () => {
  // set invalid geometry, assert step/run disabled and inline errors visible
});

it("blocks simulation controls when parseResult.errors.length > 0", async () => {
  // enter malformed workload, assert Step/Run disabled with parse blocking message
});

it("does not block simulation controls when only policy sensibility warnings exist", async () => {
  // set non-standard policy combo, assert warning visible and step/run remain enabled
});

it("keeps simulation runnable for warning-only parse/config state", async () => {
  // load valid workload + non-blocking warnings, assert Step/Run enabled
});
```

**Step 2: Run integration tests to verify failure**

Run: `bun run test -- tests/integration/simulator-flow.test.tsx tests/integration/validation-blocking.test.tsx`
Expected: FAIL until flow wiring is complete.

**Step 3: Add minimal glue fixes to satisfy tests**

```ts
// Example behavior requirement
// If validation.errors.length > 0, disable Step/Run and show "Fix configuration errors to simulate".
// If parseResult.errors.length > 0, disable Step/Run and show "Fix parse errors before running simulation."
// If warnings-only (parse warnings none, config warnings any), Step/Run remain enabled.
```

**Step 4: Add and run E2E smoke for step/run/reset**

```ts
// tests/e2e/step-run-reset.spec.ts
test("user can step, run, pause, and reset", async ({ page }) => {
  // load built-in trace, click controls, assert timeline/state changes
});
```

Run: `bun run test && bun run test:e2e -- tests/e2e/step-run-reset.spec.ts`
Expected: PASS; full flow green.

**Step 5: Commit**

```bash
git add tests playwright.config.ts
git commit -m "test: add integration and e2e coverage for simulator flow"
```

### Task 10: Final verification and docs polish (deployment optional)

**Files:**
- Modify: `README.md`
- Create: `docs/verification/2026-03-03-multi-level-cache-simulator.md`

**Step 1: Write verification checklist doc first**

```md
## Verification Checklist
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E smoke passes
- [ ] Invalid config blocks simulation
- [ ] Dirty write-back cascade visible in timeline
- [ ] Light default + dark toggle works
- [ ] Mobile fallback remains functional
```

**Step 2: Run full verification commands**

Run: `bun run lint && bun run test && bun run test:e2e`
Expected: PASS across all suites.

**Step 3: Validate production build output**

Run: `bun run build && bun run preview`
Expected: PASS; `dist/` created and app serves locally.

**Step 4: Document optional deployment follow-up (not part of core completion gate)**

Document in README/verification notes:
- Core completion gate is local CI/test/build verification only.
- Optional post-implementation deployment may be run separately (`vercel --prod`) after core gates are green.
- Framework preset: Vite, output directory: `dist`, SPA routing via `vercel.json`.

**Step 5: Commit final docs updates**

```bash
git add README.md docs/verification
git commit -m "docs: add verification checklist and optional deployment note"
```

## Explicit v1 scope boundaries

- Single simulation only; no side-by-side compare mode.
- Desktop-first UX; minimal functional mobile fallback only.
- No backend, persistence service, or non-local database.
- No advanced policies beyond LRU/FIFO and write-through/write-back.

## Execution order and checkpointing

- Execute tasks strictly in order (Task 1 to Task 10).
- Do not start UI-heavy tasks before parser + validation + engine + reducer foundations are green.
- At each task boundary, run tests and commit before proceeding.
- If any task fails verification, stop and fix before moving on.
