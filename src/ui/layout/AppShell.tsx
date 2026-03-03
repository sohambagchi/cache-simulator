import { type ReactNode, useState } from "react";
import { CollapsibleCard } from "../common/CollapsibleCard";
import { ThemeToggle, type ThemeMode } from "../common/ThemeToggle";

type AppShellProps = {
  heading?: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  hierarchyPanel: ReactNode;
  workloadPanel: ReactNode;
  statsPanel: ReactNode;
  cachePanel: ReactNode;
  memoryPanel: ReactNode;
  timelinePanel: (isOpen: boolean, onClose: () => void) => ReactNode;
};

export function AppShell({
  heading = "Multi-Level Cache Simulator",
  theme,
  onToggleTheme,
  hierarchyPanel,
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
            title="Hierarchy"
            defaultExpanded={true}
            sectionId="hierarchy-panel"
          >
            {hierarchyPanel}
          </CollapsibleCard>
          <CollapsibleCard
            title="Workload"
            defaultExpanded={true}
            sectionId="workload-panel"
          >
            {workloadPanel}
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
