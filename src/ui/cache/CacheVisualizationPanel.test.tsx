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
  it("renders every set as a grid table and hides payload until a block toggle is used", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<CacheVisualizationPanel levels={[createLevel(8)]} events={[]} />);
    });

    expect(host.querySelectorAll(".cache-set").length).toBe(8);
    const firstTable = host.querySelector('[data-set-index="0"] table');
    expect(firstTable).not.toBeNull();
    expect(firstTable?.textContent).toContain("Way");
    expect(firstTable?.textContent).toContain("V");
    expect(firstTable?.textContent).toContain("D");
    expect(firstTable?.textContent).toContain("Tag");
    expect(firstTable?.textContent).toContain("Data");
    const dataPreview = host.querySelector('[data-set-index="0"] [data-way-index="0"] .cache-cell--data span');
    expect(dataPreview?.textContent).toBe("hidden");

    const revealButton = host.querySelector('button[data-action="toggle-block-data"]');
    act(() => {
      revealButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(dataPreview?.textContent).toBe("100");

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

  it("applies validity and dirty status cues through state classes", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const level = createLevel(2);
    level.sets[0].ways[0].valid = false;
    level.sets[1].ways[0].dirty = true;

    act(() => {
      root.render(<CacheVisualizationPanel levels={[level]} events={[]} />);
    });

    const invalidWay = host.querySelector('[data-set-index="0"] [data-way-index="0"]');
    const dirtyWay = host.querySelector('[data-set-index="1"] [data-way-index="0"]');

    expect(invalidWay?.classList.contains("cache-way--invalid")).toBe(true);
    expect(invalidWay?.classList.contains("cache-way--valid")).toBe(false);
    expect(dirtyWay?.classList.contains("cache-way--dirty")).toBe(true);

    act(() => {
      root.unmount();
    });
  });
});
