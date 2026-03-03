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
import { BUILTIN_WORKLOAD_EXAMPLES } from "./workloads/examples";
import { useEffect, useState } from "react";
import type { ThemeMode } from "./ui/common/ThemeToggle";

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

function AppContent() {
  const { state, dispatch } = useStore();
  const canRun = selectCanRunSimulation(state);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState(300);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!state.isPlaying) {
      return;
    }

    if (state.nextOpIndex >= state.parseResult.ops.length) {
      dispatch({ type: "PAUSE" });
      return;
    }

    const timer = window.setInterval(() => {
      dispatch({ type: "PLAY_TICK" });
    }, playbackSpeedMs);

    return () => window.clearInterval(timer);
  }, [
    dispatch,
    playbackSpeedMs,
    state.isPlaying,
    state.nextOpIndex,
    state.parseResult.ops.length
  ]);

  return (
    <AppShell
      theme={theme}
      onToggleTheme={() =>
        setTheme((currentTheme) => getNextTheme(currentTheme))
      }
      hierarchyPanel={
        <HierarchyBuilderPanel
          levels={state.configLevels}
          warnings={state.validation.warnings}
          errors={state.validation.errors}
          inclusionPolicy={state.inclusionPolicy}
          onUpdateInclusionPolicy={(policy) =>
            dispatch({ type: "UPDATE_INCLUSION_POLICY", payload: { policy } })
          }
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
