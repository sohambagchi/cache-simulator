import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

function createPanel(label: string) {
  return <div>{label} content</div>;
}

describe("AppShell", () => {
  it("applies progressive disclosure defaults for collapsible panels", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <AppShell
          controlBar={<div>controls</div>}
          hierarchyPanel={createPanel("hierarchy")}
          workloadPanel={createPanel("workload")}
          statsPanel={createPanel("stats")}
          cachePanel={createPanel("cache")}
          memoryPanel={createPanel("memory")}
          timelinePanel={createPanel("timeline")}
        />,
      );
    });

    const hierarchyButton = host.querySelector('button[aria-controls="hierarchy-panel"]');
    const workloadButton = host.querySelector('button[aria-controls="workload-panel"]');
    const statsButton = host.querySelector('button[aria-controls="stats-panel"]');
    const memoryButton = host.querySelector('button[aria-controls="memory-panel"]');
    const timelineButton = host.querySelector('button[aria-controls="timeline-panel"]');
    const memoryPanel = host.querySelector("#memory-panel") as HTMLDivElement;

    expect(hierarchyButton?.getAttribute("aria-expanded")).toBe("true");
    expect(workloadButton?.getAttribute("aria-expanded")).toBe("true");
    expect(statsButton?.getAttribute("aria-expanded")).toBe("true");
    expect(memoryButton?.getAttribute("aria-expanded")).toBe("false");
    expect(timelineButton?.getAttribute("aria-expanded")).toBe("true");
    expect(memoryPanel).toBeTruthy();
    expect(memoryPanel.hidden).toBe(true);
    expect(memoryPanel.getAttribute("aria-hidden")).toBe("true");

    act(() => {
      root.unmount();
    });
  });

  it("uses desktop-first two-column structure with stacked mobile fallback hooks", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <AppShell
          controlBar={<div>controls</div>}
          hierarchyPanel={createPanel("hierarchy")}
          workloadPanel={createPanel("workload")}
          statsPanel={createPanel("stats")}
          cachePanel={createPanel("cache")}
          memoryPanel={createPanel("memory")}
          timelinePanel={createPanel("timeline")}
        />,
      );
    });

    expect(host.querySelector(".app-shell__columns")).toBeTruthy();
    expect(host.querySelector(".app-shell__left")).toBeTruthy();
    expect(host.querySelector(".app-shell__right")).toBeTruthy();
    expect(host.querySelector(".app-shell__results")).toBeTruthy();

    act(() => {
      root.unmount();
    });
  });
});
