import { StoreProvider } from "./state/store";
import { useStore } from "./state/store";
import { selectCanRunSimulation } from "./state/selectors";
import { HierarchyBuilderPanel } from "./ui/config/HierarchyBuilderPanel";
import { WorkloadPanel } from "./ui/workload/WorkloadPanel";
import { StatsPanel } from "./ui/stats/StatsPanel";
import { CacheVisualizationPanel } from "./ui/cache/CacheVisualizationPanel";
import { MemoryPanel } from "./ui/memory/MemoryPanel";
import { TimelineDrawer } from "./ui/timeline/TimelineDrawer";
import { AppShell } from "./ui/layout/AppShell";
import { BlockDiagram } from "./ui/diagram/BlockDiagram";
import { ExplanationLog } from "./ui/diagram/ExplanationLog";
import { FormulaPanel } from "./ui/formula/FormulaPanel";
import { BUILTIN_WORKLOAD_EXAMPLES } from "./workloads/examples";
import { useEffect, useMemo, useState } from "react";
import type { ThemeMode } from "./ui/common/ThemeToggle";
import type { CacheLevelId } from "./domain/types";
import type { SimEvent } from "./engine/initialState";

function getInitialTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return "light";
  }

  const currentTheme = document.documentElement.getAttribute("data-theme");
  return currentTheme === "dark" || currentTheme === "light"
    ? currentTheme
    : "light";
}

function getNextTheme(theme: ThemeMode): ThemeMode {
  return theme === "light" ? "dark" : "light";
}

/** How long (ms) each sub-event is shown before advancing to the next. */
const SUB_EVENT_DWELL_MS = 700;

function AppContent() {
  const { state, dispatch } = useStore();
  const canRun = selectCanRunSimulation(state);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState(300);
  const [hierarchyActiveTab, setHierarchyActiveTab] = useState<string>(
    () =>
      state.configLevels.find((l) => l.enabled)?.id ??
      state.configLevels[0]?.id ??
      "L1"
  );

  const enabledLevels = useMemo<CacheLevelId[]>(
    () => state.simState.levels.map((level) => level.id),
    [state.simState.levels]
  );

  // ── Extract the current operation's events ──────────────────────
  const latestEvents = useMemo<SimEvent[]>(() => {
    if (state.simState.events.length === 0) return [];
    const lastOpId =
      state.simState.events[state.simState.events.length - 1].operationId;
    return state.simState.events.filter((e) => e.operationId === lastOpId);
  }, [state.simState.events]);

  // The workload op that just ran (index before nextOpIndex)
  const currentOp = useMemo(
    () =>
      state.nextOpIndex > 0
        ? state.parseResult.ops[state.nextOpIndex - 1]
        : undefined,
    [state.nextOpIndex, state.parseResult.ops]
  );

  // ── Sub-event cursor ─────────────────────────────────────────────
  // Track { opId, index } atomically so a reset and advance can never race.
  // We use a single state object: when opId changes, index resets to 0 in the
  // same setState call, preventing Effect 2 from ever seeing a stale index
  // against a new operation's event list.
  const [subEventCursor, setSubEventCursor] = useState<{
    opId: number | null;
    index: number;
  }>({ opId: null, index: 0 });

  const currentOpId =
    latestEvents.length > 0 ? latestEvents[0].operationId : null;

  // Reset the cursor whenever the operation changes (derive new state
  // synchronously from the incoming opId, not from a separate effect).
  const subEventIndex =
    subEventCursor.opId === currentOpId ? subEventCursor.index : 0;

  // Keep the stored opId in sync so future ticks know which op they belong to.
  useEffect(() => {
    if (currentOpId === null) return;
    if (currentOpId !== subEventCursor.opId) {
      setSubEventCursor({ opId: currentOpId, index: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOpId]);

  // Auto-advance through sub-events while events are present.
  // Uses `subEventIndex` (the derived, already-reset value) so the timer
  // always starts from 0 on a fresh operation.
  useEffect(() => {
    if (latestEvents.length === 0) return;
    if (subEventIndex >= latestEvents.length - 1) return;

    const capturedOpId = currentOpId;
    const timer = window.setTimeout(() => {
      setSubEventCursor((prev) => {
        // Guard: only advance if we're still on the same operation
        if (prev.opId !== capturedOpId) return prev;
        return {
          opId: prev.opId,
          index: Math.min(prev.index + 1, latestEvents.length - 1)
        };
      });
    }, SUB_EVENT_DWELL_MS);

    return () => window.clearTimeout(timer);
    // `currentOpId` is derived from `latestEvents` — including it ensures the
    // effect re-runs (and its cleanup fires) whenever the operation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestEvents, subEventIndex, currentOpId]);

  const activeEvent = latestEvents[subEventIndex] ?? null;

  // ── Theme ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ── Playback ──────────────────────────────────────────────────────
  // Use a single setTimeout per operation (not setInterval) so the timer
  // always resets cleanly after each tick. The sub-event animation is
  // purely cosmetic and runs independently of this timer.
  useEffect(() => {
    if (!state.isPlaying) {
      return;
    }

    if (state.nextOpIndex >= state.parseResult.ops.length) {
      dispatch({ type: "PAUSE" });
      return;
    }

    const timer = window.setTimeout(() => {
      dispatch({ type: "PLAY_TICK" });
    }, playbackSpeedMs);

    return () => window.clearTimeout(timer);
  }, [
    dispatch,
    playbackSpeedMs,
    state.isPlaying,
    state.nextOpIndex,
    state.parseResult.ops.length
  ]);

  const { inclusionPolicy } = state;

  return (
    <AppShell
      theme={theme}
      onToggleTheme={() =>
        setTheme((currentTheme) => getNextTheme(currentTheme))
      }
      insightPanel={
        <div className="insight-panel">
          <BlockDiagram
            enabledLevels={enabledLevels}
            activeEvent={activeEvent}
          />
          <ExplanationLog
            activeEvent={activeEvent}
            currentOp={currentOp}
            opIndex={state.nextOpIndex}
            subEventIndex={subEventIndex}
            totalSubEvents={latestEvents.length}
          />
        </div>
      }
      formulaPanel={<FormulaPanel levels={state.configLevels} />}
      hierarchyHeaderActions={
        <div
          role="group"
          aria-label="Inclusion policy"
          style={{ display: "flex", gap: "0.25rem" }}
        >
          <button
            type="button"
            className={`btn btn--ghost${inclusionPolicy === "INCLUSIVE" ? " btn--active" : ""}`}
            aria-pressed={inclusionPolicy === "INCLUSIVE"}
            onClick={() =>
              dispatch({
                type: "UPDATE_INCLUSION_POLICY",
                payload: { policy: "INCLUSIVE" }
              })
            }
          >
            Inclusive
          </button>
          <button
            type="button"
            className={`btn btn--ghost${inclusionPolicy === "EXCLUSIVE" ? " btn--active" : ""}`}
            aria-pressed={inclusionPolicy === "EXCLUSIVE"}
            onClick={() =>
              dispatch({
                type: "UPDATE_INCLUSION_POLICY",
                payload: { policy: "EXCLUSIVE" }
              })
            }
          >
            Exclusive
          </button>
        </div>
      }
      hierarchyPanel={
        <HierarchyBuilderPanel
          levels={state.configLevels}
          warnings={state.validation.warnings}
          errors={state.validation.errors}
          activeTab={hierarchyActiveTab}
          onSetActiveTab={setHierarchyActiveTab}
          onUpdateLevel={(levelId, patch) =>
            dispatch({ type: "UPDATE_CONFIG", payload: { levelId, patch } })
          }
        />
      }
      workloadPanel={
        <WorkloadPanel
          canRun={canRun}
          isPlaying={state.isPlaying}
          statusMessage={state.statusMessage}
          playbackSpeedMs={playbackSpeedMs}
          onPlaybackSpeedChange={setPlaybackSpeedMs}
          onDispatch={dispatch}
          nextOpIndex={state.nextOpIndex}
          totalOps={state.parseResult.ops.length}
          workloadText={state.workloadText}
          parseResult={state.parseResult}
          examples={BUILTIN_WORKLOAD_EXAMPLES}
          onChangeTrace={(text) =>
            dispatch({ type: "LOAD_TRACE", payload: { text } })
          }
          onSelectExample={(exampleId) =>
            dispatch({ type: "LOAD_EXAMPLE_TRACE", payload: { exampleId } })
          }
        />
      }
      statsPanel={
        <StatsPanel
          stats={state.simState.stats}
          levels={state.simState.levels.map((level) => level.id)}
        />
      }
      cachePanel={
        <CacheVisualizationPanel
          levels={state.simState.levels}
          events={state.simState.events}
        />
      }
      memoryPanel={
        <MemoryPanel
          memory={state.simState.memory}
          events={state.simState.events}
        />
      }
      timelinePanel={(isOpen, onClose) => (
        <TimelineDrawer
          events={state.simState.events}
          isOpen={isOpen}
          onClose={onClose}
        />
      )}
    />
  );
}

export function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
