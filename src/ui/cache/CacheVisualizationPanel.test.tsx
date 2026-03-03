import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { CacheLevelState, SimEvent } from "../../engine/initialState";
import { CacheVisualizationPanel } from "./CacheVisualizationPanel";

function createLevel(levelId: "L1" | "L2", setCount: number): CacheLevelState {
  return {
    id: levelId,
    config: {
      id: levelId,
      enabled: true,
      totalSizeBytes: 16,
      blockSizeBytes: 1,
      associativity: 1,
      replacementPolicy: "LRU",
      writeHitPolicy: "WRITE_BACK",
      writeMissPolicy: "WRITE_ALLOCATE"
    },
    geometry: {
      numSets: setCount,
      offsetBits: 0,
      indexBits: 0
    },
    sets: Array.from({ length: setCount }, (_, setIndex) => ({
      ways: [
        {
          valid: true,
          dirty: false,
          tag: setIndex,
          dataBytes: [100 + setIndex],
          lastUsedAt: 0,
          insertedAt: 0
        }
      ]
    }))
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
    operationId: 1
  };
}

describe("CacheVisualizationPanel", () => {
  it("renders one table per level with a row per way, data visible by default", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <CacheVisualizationPanel levels={[createLevel("L1", 8)]} events={[]} />
      );
    });

    // Single table for the level, 8 rows (one way per set)
    const table = host.querySelector(".cache-table");
    expect(table).not.toBeNull();
    expect(host.querySelectorAll(".cache-row").length).toBe(8);

    // Headers: Set, Way, Tag, Data
    const headers = table!.querySelectorAll("th");
    const headerTexts = Array.from(headers).map((th) => th.textContent);
    expect(headerTexts).toContain("Set");
    expect(headerTexts).toContain("Way");
    expect(headerTexts).toContain("Tag");
    expect(headerTexts).toContain("Data");

    // Data is visible by default (no "hidden" text, no toggle button)
    const dataCell = host.querySelector(
      '[data-set-index="0"][data-way-index="0"] .cache-cell--data'
    );
    expect(dataCell?.textContent).toBe("100");
    expect(
      host.querySelector('button[data-action="toggle-block-data"]')
    ).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("shows valid/dirty status as dot indicators with accessible labels", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const level = createLevel("L1", 2);
    level.sets[0].ways[0].valid = false;
    level.sets[1].ways[0].dirty = true;

    act(() => {
      root.render(<CacheVisualizationPanel levels={[level]} events={[]} />);
    });

    // Invalid way: valid dot should be off, have "Invalid" label
    const invalidRow = host.querySelector(
      '[data-set-index="0"][data-way-index="0"]'
    );
    const invalidDots = invalidRow!.querySelectorAll(".status-dot");
    expect(invalidDots.length).toBe(2);
    expect(invalidDots[0].getAttribute("aria-label")).toBe("Invalid");
    expect(invalidDots[0].classList.contains("status-dot--off")).toBe(true);

    // Invalid way should show empty tag and data
    const invalidTag = invalidRow!.querySelector(".cache-cell--tag");
    expect(invalidTag?.textContent).toBe("");
    const invalidData = invalidRow!.querySelector(".cache-cell--data");
    expect(invalidData?.textContent).toBe("");

    // Dirty way: dirty dot should be on, have "Dirty" label
    const dirtyRow = host.querySelector(
      '[data-set-index="1"][data-way-index="0"]'
    );
    const dirtyDots = dirtyRow!.querySelectorAll(".status-dot");
    expect(dirtyDots[1].getAttribute("aria-label")).toBe("Dirty");
    expect(dirtyDots[1].classList.contains("status-dot--on")).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it("highlights active set and victim line from latest event metadata", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <CacheVisualizationPanel
          levels={[createLevel("L1", 8)]}
          events={[createEvent()]}
        />
      );
    });

    const activeRow = host.querySelector('[data-set-index="3"]');
    const victimRow = host.querySelector(
      '[data-set-index="3"][data-way-index="0"]'
    );

    expect(activeRow?.getAttribute("data-active-set")).toBe("true");
    expect(victimRow?.getAttribute("data-victim-way")).toBe("true");
    expect(victimRow?.classList.contains("cache-way--victim-cue")).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it("applies validity and dirty status cues through state classes", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const level = createLevel("L1", 2);
    level.sets[0].ways[0].valid = false;
    level.sets[1].ways[0].dirty = true;

    act(() => {
      root.render(<CacheVisualizationPanel levels={[level]} events={[]} />);
    });

    const invalidWay = host.querySelector(
      '[data-set-index="0"][data-way-index="0"]'
    );
    const dirtyWay = host.querySelector(
      '[data-set-index="1"][data-way-index="0"]'
    );

    expect(invalidWay?.classList.contains("cache-way--invalid")).toBe(true);
    expect(invalidWay?.classList.contains("cache-way--valid")).toBe(false);
    expect(dirtyWay?.classList.contains("cache-way--dirty")).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it("clears stale highlight cues from earlier operations", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    const staleL2Event = {
      stage: "eviction",
      levelId: "L2",
      opKind: "R",
      address: 0,
      tag: 3,
      index: 3,
      offset: 0,
      victimWay: 0,
      comparedWays: [],
      operationId: 1
    } as SimEvent;

    const currentL1Event = {
      stage: "compare",
      levelId: "L1",
      opKind: "R",
      address: 1,
      tag: 1,
      index: 1,
      offset: 0,
      comparedWays: [{ way: 0, valid: true, tag: 1, match: true }],
      operationId: 2
    } as SimEvent;

    act(() => {
      root.render(
        <CacheVisualizationPanel
          levels={[createLevel("L1", 8), createLevel("L2", 8)]}
          events={[staleL2Event, currentL1Event]}
        />
      );
    });

    const staleRow = host.querySelector(
      '[data-testid="cache-level-L2"] [data-set-index="3"]'
    );
    const staleVictim = host.querySelector(
      '[data-testid="cache-level-L2"] [data-set-index="3"][data-way-index="0"]'
    );

    expect(staleRow?.getAttribute("data-active-set")).toBe("false");
    expect(staleVictim?.getAttribute("data-victim-way")).toBe("false");

    act(() => {
      root.unmount();
    });
  });

  it("renders set cell with rowSpan for multi-way associativity", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const level = createLevel("L1", 2);
    // Add a second way to each set
    for (const set of level.sets) {
      set.ways.push({
        valid: false,
        dirty: false,
        tag: 0,
        dataBytes: [0],
        lastUsedAt: 0,
        insertedAt: 0
      });
    }

    act(() => {
      root.render(<CacheVisualizationPanel levels={[level]} events={[]} />);
    });

    // 4 rows total (2 sets × 2 ways)
    expect(host.querySelectorAll(".cache-row").length).toBe(4);

    // Set cells should have rowSpan=2
    const setCells = host.querySelectorAll(".cache-cell--set");
    expect(setCells.length).toBe(2);
    expect(setCells[0].getAttribute("rowspan")).toBe("2");

    act(() => {
      root.unmount();
    });
  });

  it("shows way label as plain number without W prefix", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <CacheVisualizationPanel levels={[createLevel("L1", 1)]} events={[]} />
      );
    });

    const wayLabel = host.querySelector(".cache-way-label");
    expect(wayLabel?.textContent).toBe("0");

    act(() => {
      root.unmount();
    });
  });

  it("renders uninitialized (invalid) lines with empty tag and data", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const level = createLevel("L1", 1);
    level.sets[0].ways[0].valid = false;
    level.sets[0].ways[0].tag = 0;
    level.sets[0].ways[0].dataBytes = [0, 0, 0, 0];

    act(() => {
      root.render(<CacheVisualizationPanel levels={[level]} events={[]} />);
    });

    const row = host.querySelector('[data-set-index="0"][data-way-index="0"]');
    expect(row!.querySelector(".cache-cell--tag")?.textContent).toBe("");
    expect(row!.querySelector(".cache-cell--data")?.textContent).toBe("");
    expect(row!.querySelector(".cache-data-bytes")).toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
