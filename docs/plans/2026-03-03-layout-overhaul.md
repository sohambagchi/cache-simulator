# Layout Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the UI into a cleaner layout: controls co-located with workload, timeline as a right-side drawer, hierarchy as per-level collapsible cards, stats reorganized with loud global section + per-level boxes, and global hit/miss logic fixed to count any-level cache service as a hit.

**Architecture:** All changes are pure UI/layout except Task 1 (engine fix for global stats). The engine fix modifies `simulateStep.ts` so global hits/misses correctly reflect any-level cache service. Layout changes flow from `AppShell` → individual panels. A new `TimelineDrawer` component replaces the inline timeline card. `HierarchyBuilderPanel` gets per-level collapsible headers. `GlobalControlBar` content moves into `WorkloadPanel`. `StatsPanel` is redesigned with a loud global section and per-level cards.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, plain CSS (no CSS framework)

---

### Task 1: Fix global hit/miss engine logic

**Files:**

- Modify: `src/engine/simulateStep.ts`
- Modify: `src/engine/simulateStep.test.ts`

The current logic only counts a write as a global miss if L1 misses, and counts reads as a global miss only at L1. The fix: a request is a **global hit** if any cache level served it; a **global miss** only if it fell all the way to memory.

**Reads:** Already mostly correct — `mutable.nextState.stats.hits += 1` happens on any level hit and `mutable.nextState.stats.misses += 1` happens only when `levelIndex === 0` misses. But that miss at L1 fires even if L2 then hits. Fix: move the global miss increment to after the loop, only if `resolvedLevelIndex === mutable.nextState.levels.length` (i.e., no level hit).

**Writes:** `applyWrite` currently does `mutable.nextState.stats.misses += firstHitWay === undefined ? 1 : 0` and `hits += firstHitWay !== undefined ? 1 : 0` — only checks L1. Fix: track whether any level in `forwardWrite` had a hit, and return that signal so `applyWrite` can record the global hit/miss.

**Step 1: Add a failing test for the read case**

In `src/engine/simulateStep.test.ts`, add a test that verifies a read miss at L1 but hit at L2 counts as a global hit (not a global miss):

```typescript
it("counts a read that misses L1 but hits L2 as a global hit", () => {
  // Set up two-level state where address 0 is in L2 but not L1
  // Run a read, check stats.hits === 1, stats.misses === 0
});
```

Run: `bun run test src/engine/simulateStep.test.ts`
Expected: FAIL

**Step 2: Fix read global miss counting in `applyRead`**

In `src/engine/simulateStep.ts`, remove the early-miss increment inside the loop:

```typescript
// REMOVE this block inside the loop:
if (levelIndex === 0) {
  mutable.nextState.stats.misses += 1;
}
```

Add after the loop, before the fill-back section:

```typescript
if (resolvedLevelIndex === mutable.nextState.levels.length) {
  mutable.nextState.stats.misses += 1;
}
```

`stats.hits` is already incremented correctly inside the loop on any hit — no change needed there.

**Step 3: Run read test**
Run: `bun run test src/engine/simulateStep.test.ts`
Expected: PASS for that test

**Step 4: Add a failing test for the write case**

Add a test: a write that misses all levels (WRITE_NO_ALLOCATE path to memory) counts as a global miss; a write that hits L1 counts as a global hit; a write that misses L1 but hits L2 counts as a global hit.

**Step 5: Fix write global hit/miss in `forwardWrite` + `applyWrite`**

Change `forwardWrite` signature to return `boolean` (whether any level hit):

```typescript
function forwardWrite(
  mutable: MutableStep,
  startLevelIndex: number,
  address: number,
  value: number | undefined,
  incomingBlock?: BlockTransfer
): boolean {
  let anyHit = false;
  // ... existing loop ...
  // where hitWay !== undefined: set anyHit = true (already returns early for WRITE_BACK,
  // so set before return)
  // ...
  return anyHit;
}
```

In `applyWrite`, replace the current hit/miss logic:

```typescript
function applyWrite(
  mutable: MutableStep,
  address: number,
  value: number
): void {
  if (mutable.nextState.levels.length === 0) {
    writeMemory(mutable, "W", address, value, { tag: 0, index: 0, offset: 0 });
    mutable.nextState.stats.misses += 1;
    return;
  }

  const anyHit = forwardWrite(mutable, 0, address, value);
  if (anyHit) {
    mutable.nextState.stats.hits += 1;
  } else {
    mutable.nextState.stats.misses += 1;
  }
}
```

Note: `forwardWrite` is also called recursively for dirty writebacks (eviction path). Those recursive calls should NOT affect global hit/miss — they are internal writeback propagation, not user-visible requests. The `anyHit` return value from recursive calls should be ignored. The simplest approach: only the top-level call from `applyWrite` uses the return value; recursive writeback calls discard it.

**Step 6: Run all engine tests**
Run: `bun run test src/engine/`
Expected: all PASS

**Step 7: Commit**

```bash
git add src/engine/simulateStep.ts src/engine/simulateStep.test.ts
git commit -m "fix: global hit/miss counts any-level cache service, not just L1"
```

---

### Task 2: Theme toggle — move to title bar

**Files:**

- Modify: `src/ui/layout/AppShell.tsx`
- Modify: `src/ui/controls/GlobalControlBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`

**Step 1: Update `AppShell` to accept theme props and render toggle in header**

Add `theme`, `onToggleTheme` props to `AppShellProps`. Replace the `<h1>` with a flex header row:

```tsx
import { ThemeToggle, type ThemeMode } from "../common/ThemeToggle";

type AppShellProps = {
  heading?: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  // ... rest unchanged
};

// In JSX, replace <h1>{heading}</h1> with:
<div className="app-shell__header">
  <h1>{heading}</h1>
  <ThemeToggle theme={theme} onToggle={onToggleTheme} />
</div>;
```

**Step 2: Remove theme props from `GlobalControlBar`**

Remove `theme`, `onToggleTheme` from `GlobalControlBarProps` and the `ThemeToggle` usage from the buttons row.

**Step 3: Update `App.tsx`**

Pass `theme` and `onToggleTheme` to `AppShell` instead of `GlobalControlBar`.

**Step 4: Add CSS for the header row**

```css
.app-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
```

The existing `.theme-toggle` styles stay unchanged — the button just renders in a new location.

**Step 5: Run tests**
Run: `bun run test`
Expected: PASS (ThemeToggle tests still pass, AppShell test may need prop update)

**Step 6: Commit**

```bash
git add src/ui/layout/AppShell.tsx src/ui/controls/GlobalControlBar.tsx src/App.tsx src/styles/app.css
git commit -m "feat: move theme toggle to title bar"
```

---

### Task 3: Merge controls into Workload panel

**Files:**

- Create: `src/ui/workload/WorkloadPanel.tsx`
- Modify: `src/ui/layout/AppShell.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`
- Modify: (optionally keep) `src/ui/controls/GlobalControlBar.tsx` — remove the request section, or keep as-is and compose

The cleanest approach: create a new `WorkloadPanel` that composes `GlobalControlBar` content + `WorkloadEditorPanel` content into one scrollable panel. This avoids rewriting tests for the two existing components.

**Step 1: Create `WorkloadPanel.tsx`**

This component takes all props from both `GlobalControlBar` (minus theme) and `WorkloadEditorPanel`, plus `nextOpIndex` and `totalOps` for progress display:

```tsx
// src/ui/workload/WorkloadPanel.tsx
import type { Action } from "../../state/actions";
import type { WorkloadParseResult } from "../../parser/parseWorkload";
import type { WorkloadExample } from "../../workloads/examples";
import { useRef, useState } from "react";

type WorkloadPanelProps = {
  // Sim controls
  canRun: boolean;
  isPlaying: boolean;
  statusMessage?: string | null;
  playbackSpeedMs: number;
  onPlaybackSpeedChange: (speedMs: number) => void;
  onDispatch: (action: Action) => void;
  // Progress
  nextOpIndex: number;
  totalOps: number;
  // Workload editor
  workloadText: string;
  parseResult: WorkloadParseResult;
  examples: readonly WorkloadExample[];
  onChangeTrace: (text: string) => void;
  onSelectExample: (exampleId: string) => void;
};

export function WorkloadPanel({ ... }: WorkloadPanelProps) {
  // Move all state/logic from GlobalControlBar (requestKind, requestError, requestAddressRef, etc.)
  // Render order:
  // 1. Sim control buttons row (Step/Run/Pause/Reset/Speed)
  // 2. Manual request entry row
  // 3. Status / request error messages
  // 4. Divider
  // 5. Progress: "X / Y ops"
  // 6. Example picker
  // 7. Trace textarea
  // 8. Parsed preview
  // 9. Diagnostics
}
```

**Step 2: Update `AppShell`**

Remove `controlBar` prop. Replace the `workloadPanel` prop slot rendering with the new `WorkloadPanel`. Remove `app-shell__top` div.

```tsx
// Remove:
controlBar: ReactNode;
// Remove from render:
<div className="app-shell__top">{controlBar}</div>;
```

**Step 3: Update `App.tsx`**

Remove `GlobalControlBar` import and `controlBar` prop. Add `WorkloadPanel` import. Pass all required props to `workloadPanel={<WorkloadPanel ... />}`.

**Step 4: Update CSS**

Remove `.app-shell__top` sticky positioning. The workload panel is now just a regular card in the left column.

Add progress display style:

```css
.workload-progress {
  font-size: 0.85rem;
  color: var(--text-muted);
  padding: 0.25rem 0;
}
```

**Step 5: Run tests**
Run: `bun run test`
Expected: PASS (existing GlobalControlBar and WorkloadEditorPanel tests still pass since those components still exist; AppShell test needs updating for removed controlBar prop)

**Step 6: Commit**

```bash
git add src/ui/workload/WorkloadPanel.tsx src/ui/layout/AppShell.tsx src/App.tsx src/styles/app.css
git commit -m "feat: co-locate simulation controls with workload panel"
```

---

### Task 4: Timeline right-side drawer

**Files:**

- Create: `src/ui/timeline/TimelineDrawer.tsx`
- Modify: `src/ui/layout/AppShell.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`

**Step 1: Create `TimelineDrawer.tsx`**

```tsx
// src/ui/timeline/TimelineDrawer.tsx
import type { SimEvent } from "../../engine/initialState";

type TimelineDrawerProps = {
  events: SimEvent[];
  isOpen: boolean;
  onClose: () => void;
};

export function TimelineDrawer({
  events,
  isOpen,
  onClose
}: TimelineDrawerProps) {
  if (!isOpen) return null;

  // existing EventTimelinePanel content goes here
  const latestOperationId = events[events.length - 1]?.operationId;
  // ... (copy logic from EventTimelinePanel)

  return (
    <>
      {/* Backdrop */}
      <div
        className="timeline-drawer__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        className="timeline-drawer"
        aria-label="Event timeline"
        role="complementary"
      >
        <div className="timeline-drawer__header">
          <h2>Timeline</h2>
          <button
            type="button"
            className="timeline-drawer__close"
            onClick={onClose}
            aria-label="Close timeline"
          >
            ✕
          </button>
        </div>
        <div className="timeline-drawer__body">
          {events.length === 0 ? (
            <p>No events yet</p>
          ) : (
            <>
              <section aria-label="Latest decode details">
                <p>
                  Tag {latestDecode.tag} Index {latestDecode.index} Offset{" "}
                  {latestDecode.offset}
                </p>
                <p>
                  Matched ways:{" "}
                  {matchedWays.length > 0 ? matchedWays.join(", ") : "none"}
                </p>
                <p>
                  Victim cue:{" "}
                  {victimCueEvent?.victimWay !== undefined
                    ? `way ${victimCueEvent.victimWay}`
                    : "none"}
                </p>
              </section>
              <ol className="timeline-list">
                {events.map((event, index) => (
                  <li key={`${event.levelId}-${event.stage}-${index}`}>
                    {event.stage} {event.levelId} {event.opKind} @{" "}
                    {event.address}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
```

**Step 2: Add a "Timeline" toggle button to `AppShell`**

Add `timelineOpen` state and a toggle button. The toggle button floats at the top-right of the layout (not inside the sticky bar — just a regular positioned element). Pass `timelineOpen`/`onToggleTimeline` down, or manage state in `AppShell` directly since `AppShell` owns the layout.

In `AppShell`, replace the `timelinePanel` prop slot (currently inside the right column) with the drawer:

```tsx
// AppShell manages timeline open state
const [timelineOpen, setTimelineOpen] = useState(false);

// In JSX, remove the CollapsibleCard for timeline from app-shell__results.
// Add a floating toggle button near the top-right:
<button
  className="timeline-toggle-btn"
  type="button"
  onClick={() => setTimelineOpen(true)}
  aria-label="Open timeline"
>
  Timeline
</button>;

// Render drawer outside the column grid:
{
  timelinePanel(timelineOpen, () => setTimelineOpen(false));
}
```

The `timelinePanel` prop changes to a render prop: `timelinePanel: (isOpen: boolean, onClose: () => void) => ReactNode`. Or simpler: manage open state in `AppShell`, pass `isOpen`/`onClose` directly.

Simplest approach: `AppShell` owns `timelineOpen` state. `timelinePanel` prop is just the `<TimelineDrawer>` element with no open state — `App.tsx` passes `isOpen` from `AppShell`'s state. But that creates a circular dependency.

**Cleanest approach:** `AppShell` manages `timelineOpen` itself. The `timelinePanel` prop becomes a render function `(isOpen: boolean, onClose: () => void) => ReactNode`:

```tsx
// AppShell:
const [timelineOpen, setTimelineOpen] = useState(false);
// ...
{timelinePanel(timelineOpen, () => setTimelineOpen(false))}

// App.tsx:
timelinePanel={(isOpen, onClose) => (
  <TimelineDrawer events={state.simState.events} isOpen={isOpen} onClose={onClose} />
)}
```

**Step 3: Add CSS for drawer**

```css
.timeline-drawer__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 10;
}

.timeline-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: clamp(20rem, 35vw, 32rem);
  background: var(--surface-card);
  border-left: 1px solid var(--border-muted);
  z-index: 11;
  display: flex;
  flex-direction: column;
}

.timeline-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border-muted);
  flex-shrink: 0;
}

.timeline-drawer__header h2 {
  margin: 0;
  font-size: 1rem;
}

.timeline-drawer__close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--text-strong);
  padding: 0.25rem 0.5rem;
}

.timeline-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
}

.timeline-toggle-btn {
  /* Positioned in a natural flow spot — inside the app-shell header area */
  border: 1px solid var(--border-muted);
  border-radius: 0.35rem;
  background: var(--surface-accent);
  color: var(--text-strong);
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
}
```

**Step 4: Run tests**
Run: `bun run test`
Expected: PASS (EventTimelinePanel tests still pass; new TimelineDrawer has no tests needed for this pass)

**Step 5: Commit**

```bash
git add src/ui/timeline/TimelineDrawer.tsx src/ui/layout/AppShell.tsx src/App.tsx src/styles/app.css
git commit -m "feat: timeline as right-side drawer overlay"
```

---

### Task 5: Hierarchy per-level collapsible headers

**Files:**

- Modify: `src/ui/config/HierarchyBuilderPanel.tsx`
- Modify: `src/styles/app.css`

**Step 1: Redesign `HierarchyBuilderPanel`**

Each level renders a header that is always visible. The header contains:

1. Chevron toggle button (▶ collapsed / ▼ expanded) — only shown when enabled
2. Enable/disable checkbox
3. Level ID label (`L1`, `L2`, `L3`)
4. Policy summary string (e.g., `LRU · WRITE_BACK · WRITE_ALLOCATE`)
5. Total size label (e.g., `32 KB`)

Rules:

- Disabled level: header visible, no chevron, config body hidden (no expansion possible)
- Enabled + collapsed: header visible with chevron pointing right, config body hidden
- Enabled + expanded: header visible with chevron pointing down, config body visible

Use per-level `expanded` state. Initialize to `true` for enabled levels.

```tsx
// Inside HierarchyBuilderPanel, add per-level expanded state:
const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>(
  () => Object.fromEntries(levels.map((l) => [l.id, l.enabled]))
);

// When a level is disabled, also collapse it:
function handleToggleEnabled(levelId: string, enabled: boolean) {
  if (!enabled) {
    setExpandedLevels((prev) => ({ ...prev, [levelId]: false }));
  }
  onUpdateLevel(levelId as CacheLevelConfig["id"], { enabled });
}

// Header JSX per level:
<div className="cache-level-header">
  {level.enabled && (
    <button
      type="button"
      className="cache-level-header__toggle"
      aria-expanded={expandedLevels[level.id]}
      onClick={() =>
        setExpandedLevels((prev) => ({ ...prev, [level.id]: !prev[level.id] }))
      }
      aria-label={`${expandedLevels[level.id] ? "Collapse" : "Expand"} ${level.id}`}
    >
      {expandedLevels[level.id] ? "▼" : "▶"}
    </button>
  )}
  <label className="cache-level-header__enable">
    <input
      type="checkbox"
      checked={level.enabled}
      disabled={level.enabled && enabledCount === 1}
      onChange={(e) => handleToggleEnabled(level.id, e.currentTarget.checked)}
    />
  </label>
  <span className="cache-level-header__id">{level.id}</span>
  {level.enabled && (
    <>
      <span className="cache-level-header__policies">
        {level.replacementPolicy} · {level.writeHitPolicy} ·{" "}
        {level.writeMissPolicy}
      </span>
      <span className="cache-level-header__size">
        {formatBytesLabel(level.totalSizeBytes)}
      </span>
    </>
  )}
</div>;

{
  /* Config body — only if enabled AND expanded */
}
{
  level.enabled && expandedLevels[level.id] && (
    <div className="cache-level-body">
      {/* all sliders and selects, minus the Enabled checkbox */}
    </div>
  );
}
```

Remove the old `<fieldset>` wrapper and the `Enabled` checkbox from inside the config body. The config body now only contains the sliders and policy selects.

**Step 2: Add CSS**

```css
.cache-level-card {
  border: 1px solid var(--border-subtle);
  border-radius: 0.4rem;
  overflow: clip;
}

.cache-level-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-muted);
  cursor: default;
}

.cache-level-header__toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-strong);
  font-size: 0.75rem;
  padding: 0.1rem 0.2rem;
  line-height: 1;
}

.cache-level-header__id {
  font-weight: 700;
  color: var(--text-strong);
}

.cache-level-header__policies {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-left: 0.25rem;
}

.cache-level-header__size {
  margin-left: auto;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-strong);
}

.cache-level-body {
  padding: 0.5rem 0.75rem;
}
```

**Step 3: Run tests**
Run: `bun run test src/ui/config/`
Expected: PASS (tests check rendered output; verify the enable checkbox and level labels still render)

**Step 4: Commit**

```bash
git add src/ui/config/HierarchyBuilderPanel.tsx src/styles/app.css
git commit -m "feat: hierarchy levels as collapsible cards with policy summary headers"
```

---

### Task 6: Stats panel redesign

**Files:**

- Modify: `src/ui/stats/StatsPanel.tsx`
- Modify: `src/styles/app.css`

**Step 1: Rewrite `StatsPanel`**

New structure:

```tsx
export function StatsPanel({ stats, levels }: StatsPanelProps) {
  // Remove nextOpIndex/totalOps — progress moves to WorkloadPanel
  const globalHitRate = hitRate(stats.hits, stats.misses);

  return (
    <div className="stats-panel">
      {/* Global stats — loud section */}
      <div className="stats-global">
        <div className="stats-global__primary">
          <div className="stats-stat stats-stat--loud">
            <span className="stats-stat__label">Hits</span>
            <span className="stats-stat__value">{stats.hits}</span>
          </div>
          <div className="stats-stat stats-stat--loud">
            <span className="stats-stat__label">Misses</span>
            <span className="stats-stat__value">{stats.misses}</span>
          </div>
          <div className="stats-stat stats-stat--loud stats-stat--rate">
            <span className="stats-stat__label">Hit Rate</span>
            <span className="stats-stat__value">{globalHitRate}</span>
          </div>
        </div>
        <div className="stats-global__secondary">
          <div className="stats-stat">
            <span className="stats-stat__label">Reads</span>
            <span className="stats-stat__value">{stats.reads}</span>
          </div>
          <div className="stats-stat">
            <span className="stats-stat__label">Writes</span>
            <span className="stats-stat__value">{stats.writes}</span>
          </div>
          <div className="stats-stat">
            <span className="stats-stat__label">Evictions</span>
            <span className="stats-stat__value">{stats.evictions}</span>
          </div>
          <div className="stats-stat">
            <span className="stats-stat__label">Mem Reads</span>
            <span className="stats-stat__value">{stats.memoryReads}</span>
          </div>
          <div className="stats-stat">
            <span className="stats-stat__label">Mem Writes</span>
            <span className="stats-stat__value">{stats.memoryWrites}</span>
          </div>
        </div>
      </div>

      {/* Per-level boxes */}
      <div className="stats-levels">
        {levels.map((levelId) => {
          const ls = stats.perLevel[levelId];
          return (
            <div key={levelId} className="stats-level-card">
              <div className="stats-level-card__title">{levelId}</div>
              <dl className="stats-level-card__grid">
                <div>
                  <dt>Hits</dt>
                  <dd>{ls.hits}</dd>
                </div>
                <div>
                  <dt>Misses</dt>
                  <dd>{ls.misses}</dd>
                </div>
                <div>
                  <dt>Evictions</dt>
                  <dd>{ls.evictions}</dd>
                </div>
                <div>
                  <dt>Hit Rate</dt>
                  <dd>{hitRate(ls.hits, ls.misses)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Remove `nextOpIndex` and `totalOps` from `StatsPanelProps` — these are now in `WorkloadPanel`.

**Step 2: Update `App.tsx`** — remove `nextOpIndex` and `totalOps` from `StatsPanel` usage.

**Step 3: Add CSS**

```css
.stats-panel {
  display: grid;
  gap: 1rem;
}

.stats-global {
  display: grid;
  gap: 0.5rem;
}

.stats-global__primary {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stats-global__secondary {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
}

.stats-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.stats-stat__label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats-stat__value {
  font-weight: 700;
  font-size: 1rem;
}

.stats-stat--loud .stats-stat__value {
  font-size: 1.75rem;
  line-height: 1.1;
}

.stats-stat--rate .stats-stat__value {
  color: var(--text-strong);
}

.stats-levels {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.stats-level-card {
  flex: 1;
  min-width: 8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.4rem;
  overflow: clip;
}

.stats-level-card__title {
  background: var(--surface-muted);
  padding: 0.35rem 0.6rem;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-strong);
}

.stats-level-card__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem;
  margin: 0;
}

.stats-level-card__grid dt {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.stats-level-card__grid dd {
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
}
```

**Step 4: Run tests**
Run: `bun run test src/ui/stats/`
Expected: PASS (update snapshot/assertions for removed progress prop)

**Step 5: Commit**

```bash
git add src/ui/stats/StatsPanel.tsx src/App.tsx src/styles/app.css
git commit -m "feat: redesign stats panel with loud global section and per-level cards"
```

---

### Task 7: Final integration check

**Step 1: Run full test suite**
Run: `bun run test`
Expected: all PASS

**Step 2: Run build**
Run: `bun run build`
Expected: no TypeScript errors, build succeeds

**Step 3: Commit any remaining fixes**

**Step 4: Final commit**

```bash
git commit -m "chore: layout overhaul complete"
```
