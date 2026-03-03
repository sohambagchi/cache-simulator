import type { ReactNode } from "react";
import { CollapsibleCard } from "../common/CollapsibleCard";

type AppShellProps = {
  heading?: string;
  controlBar: ReactNode;
  hierarchyPanel: ReactNode;
  workloadPanel: ReactNode;
  statsPanel: ReactNode;
  cachePanel: ReactNode;
  memoryPanel: ReactNode;
  timelinePanel: ReactNode;
};

export function AppShell({
  heading = "Multi-Level Cache Simulator",
  controlBar,
  hierarchyPanel,
  workloadPanel,
  statsPanel,
  cachePanel,
  memoryPanel,
  timelinePanel,
}: AppShellProps) {
  return (
    <main className="app-shell">
      <h1>{heading}</h1>
      <div className="app-shell__top">{controlBar}</div>
      <div className="app-shell__columns">
        <section className="app-shell__left">
          <CollapsibleCard title="Hierarchy" defaultExpanded={true} sectionId="hierarchy-panel">
            {hierarchyPanel}
          </CollapsibleCard>
          <CollapsibleCard title="Workload" defaultExpanded={true} sectionId="workload-panel">
            {workloadPanel}
          </CollapsibleCard>
        </section>
        <section className="app-shell__right">
          <CollapsibleCard title="Stats" defaultExpanded={true} sectionId="stats-panel">
            {statsPanel}
          </CollapsibleCard>
          <section className="app-shell__results">
            <CollapsibleCard title="Cache" defaultExpanded={true} sectionId="cache-panel">
              {cachePanel}
            </CollapsibleCard>
            <CollapsibleCard title="Memory" defaultExpanded={false} sectionId="memory-panel">
              {memoryPanel}
            </CollapsibleCard>
            <CollapsibleCard title="Timeline" defaultExpanded={true} sectionId="timeline-panel">
              {timelinePanel}
            </CollapsibleCard>
          </section>
        </section>
      </div>
    </main>
  );
}
