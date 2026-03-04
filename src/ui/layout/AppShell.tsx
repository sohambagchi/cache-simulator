import { type ReactNode, useState } from "react";
import { CollapsibleCard } from "../common/CollapsibleCard";
import { ThemeToggle, type ThemeMode } from "../common/ThemeToggle";
import type { InclusionPolicy } from "../../domain/types";

type AppShellProps = {
  heading?: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  insightPanel?: ReactNode;
  formulaPanel?: ReactNode;
  hierarchyPanel: ReactNode;
  hierarchyHeaderActions?: ReactNode;
  workloadPanel: ReactNode;
  statsPanel: ReactNode;
  cachePanel: ReactNode;
  memoryPanel: ReactNode;
  timelinePanel: (isOpen: boolean, onClose: () => void) => ReactNode;
};

export function AppShell({
  heading = "Caches",
  theme,
  onToggleTheme,
  insightPanel,
  formulaPanel,
  hierarchyPanel,
  hierarchyHeaderActions,
  workloadPanel,
  statsPanel,
  cachePanel,
  memoryPanel,
  timelinePanel
}: AppShellProps) {
  const [timelineOpen, setTimelineOpen] = useState(false);

  return (
    <main className="app-shell">
      <div className="app-shell__header">
        <h1>{heading}</h1>
        {insightPanel && (
          <div className="app-shell__header-insight">{insightPanel}</div>
        )}
        {formulaPanel && (
          <div className="app-shell__header-formula">{formulaPanel}</div>
        )}
        <div className="app-shell__header-actions">
          <button
            className="btn timeline-toggle-btn"
            type="button"
            onClick={() => setTimelineOpen(true)}
            aria-label="Open timeline"
          >
            Timeline
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      <div className="app-shell__columns">
        <section className="app-shell__left">
          <CollapsibleCard
            title="Workload"
            defaultExpanded={true}
            sectionId="workload-panel"
          >
            {workloadPanel}
          </CollapsibleCard>
          <CollapsibleCard
            title="Hierarchy"
            defaultExpanded={true}
            sectionId="hierarchy-panel"
            headerActions={hierarchyHeaderActions}
          >
            {hierarchyPanel}
          </CollapsibleCard>
        </section>
        <section className="app-shell__right">
          <CollapsibleCard
            title="Stats"
            defaultExpanded={true}
            sectionId="stats-panel"
          >
            {statsPanel}
          </CollapsibleCard>
          <section className="app-shell__results">
            <CollapsibleCard
              title="Cache"
              defaultExpanded={true}
              sectionId="cache-panel"
            >
              {cachePanel}
            </CollapsibleCard>
            <CollapsibleCard
              title="Memory"
              defaultExpanded={false}
              sectionId="memory-panel"
            >
              {memoryPanel}
            </CollapsibleCard>
          </section>
        </section>
      </div>
      {timelinePanel(timelineOpen, () => setTimelineOpen(false))}
    </main>
  );
}

export type { InclusionPolicy };
