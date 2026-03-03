import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { CacheLevelState, SimEvent } from "../../engine/initialState";
import { CacheVisualizationPanel } from "./CacheVisualizationPanel";

function createLevel(setCount: number): CacheLevelState {
  return {
    id: "L1",
    config: {
      id: "L1",
      enabled: true,
      totalSizeBytes: 16,
      blockSizeBytes: 1,
      associativity: 1,
      replacementPolicy: "LRU",
      writeHitPolicy: "WRITE_BACK",
      writeMissPolicy: "WRITE_ALLOCATE",
    },
    geometry: {
      numSets: setCount,
      offsetBits: 0,
      indexBits: 0,
    },
    sets: Array.from({ length: setCount }, (_, setIndex) => ({
      ways: [
        {
          valid: true,
          dirty: false,
          tag: setIndex,
          data: 100 + setIndex,
          lastUsedAt: 0,
          insertedAt: 0,
        },
      ],
    })),
  };
}

function createEvent(): SimEvent {
  return {
    stage: "eviction",
    levelId: "L1",
    opKind: "R",
    address: 0,
    tag: 3,
    index: 3,
    offset: 0,
    victimWay: 0,
    comparedWays: [],
  };
}

describe("CacheVisualizationPanel", () => {
  it("renders all sets and hides payload until a block toggle is used", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<CacheVisualizationPanel levels={[createLevel(8)]} events={[]} />);
    });

    expect(host.querySelectorAll(".cache-set").length).toBe(8);
    expect(host.textContent).not.toContain("data=100");

    const revealButton = host.querySelector('button[data-action="toggle-block-data"]');
    act(() => {
      revealButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.textContent).toContain("data=100");

    act(() => {
      root.unmount();
    });
  });

  it("highlights active set and victim line from latest event metadata", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<CacheVisualizationPanel levels={[createLevel(8)]} events={[createEvent()]} />);
    });

    const activeSet = host.querySelector('[data-set-index="3"]');
    const victimLine = host.querySelector('[data-set-index="3"] [data-way-index="0"]');

    expect(activeSet?.getAttribute("data-active-set")).toBe("true");
    expect(victimLine?.getAttribute("data-victim-way")).toBe("true");

    act(() => {
      root.unmount();
    });
  });
});
