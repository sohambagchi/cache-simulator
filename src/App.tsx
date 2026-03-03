import { StoreProvider } from "./state/store";
import { useStore } from "./state/store";
import { selectCanRunSimulation } from "./state/selectors";
import { GlobalControlBar } from "./ui/controls/GlobalControlBar";
import { HierarchyBuilderPanel } from "./ui/config/HierarchyBuilderPanel";
import { WorkloadEditorPanel } from "./ui/workload/WorkloadEditorPanel";
import { StatsPanel } from "./ui/stats/StatsPanel";
import { CacheVisualizationPanel } from "./ui/cache/CacheVisualizationPanel";
import { MemoryPanel } from "./ui/memory/MemoryPanel";
import { EventTimelinePanel } from "./ui/timeline/EventTimelinePanel";
import { AppShell } from "./ui/layout/AppShell";
import { BUILTIN_WORKLOAD_EXAMPLES } from "./workloads/examples";
import { useEffect } from "react";

function AppContent() {
  const { state, dispatch } = useStore();
  const canRun = selectCanRunSimulation(state);

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
    }, 300);

    return () => window.clearInterval(timer);
  }, [dispatch, state.isPlaying, state.nextOpIndex, state.parseResult.ops.length]);

  return (
    <AppShell
      controlBar={
        <GlobalControlBar
          canRun={canRun}
          isPlaying={state.isPlaying}
          statusMessage={state.statusMessage}
          onDispatch={dispatch}
        />
      }
      hierarchyPanel={
        <HierarchyBuilderPanel
          levels={state.configLevels}
          warnings={state.validation.warnings}
          onUpdateLevel={(levelId, patch) => dispatch({ type: "UPDATE_CONFIG", payload: { levelId, patch } })}
        />
      }
      workloadPanel={
        <WorkloadEditorPanel
          workloadText={state.workloadText}
          parseResult={state.parseResult}
          examples={BUILTIN_WORKLOAD_EXAMPLES}
          onChangeTrace={(text) => dispatch({ type: "LOAD_TRACE", payload: { text } })}
          onSelectExample={(exampleId) => dispatch({ type: "LOAD_EXAMPLE_TRACE", payload: { exampleId } })}
        />
      }
      statsPanel={
        <StatsPanel
          stats={state.simState.stats}
          nextOpIndex={state.nextOpIndex}
          totalOps={state.parseResult.ops.length}
        />
      }
      cachePanel={<CacheVisualizationPanel levels={state.simState.levels} events={state.simState.events} />}
      memoryPanel={<MemoryPanel memory={state.simState.memory} events={state.simState.events} />}
      timelinePanel={<EventTimelinePanel events={state.simState.events} />}
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
