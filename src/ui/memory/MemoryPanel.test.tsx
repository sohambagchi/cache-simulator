import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "../../engine/initialState";
import { MemoryPanel } from "./MemoryPanel";

function createEvent(overrides: Partial<SimEvent>): SimEvent {
  return {
    operationId: 1,
    stage: "decode",
    levelId: "L1",
    opKind: "R",
    address: 0,
    tag: 0,
    index: 0,
    offset: 0,
    comparedWays: [],
    ...overrides
  };
}

describe("MemoryPanel", () => {
  it("renders a grid cell for every memory address", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const memory = [10, 20, 30, 40];

    act(() => {
      root.render(
        <MemoryPanel
          memory={memory}
          events={[]}
          levels={[{ id: "L1", blockSizeBytes: 4 }]}
        />
      );
    });

    const cells = host.querySelectorAll(".memory-cell");
    expect(cells).toHaveLength(4);
    expect(cells[0].textContent).toBe("10");
    expect(cells[1].textContent).toBe("20");
    expect(cells[2].textContent).toBe("30");
    expect(cells[3].textContent).toBe("40");

    act(() => {
      root.unmount();
    });
  });

  it("shows tooltip with address, block number, reads, and writes", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <MemoryPanel
          memory={[0, 0, 0, 0, 0, 0, 0, 0]}
          events={[
            createEvent({ stage: "memory", address: 5, opKind: "R" }),
            createEvent({ stage: "memory", address: 5, opKind: "W" }),
            createEvent({ stage: "memory", address: 5, opKind: "R" })
          ]}
          levels={[
            { id: "L1", blockSizeBytes: 4 },
            { id: "L2", blockSizeBytes: 8 }
          ]}
        />
      );
    });

    const cells = host.querySelectorAll(".memory-cell");
    const tooltip = cells[5].getAttribute("data-tooltip")!;
    expect(tooltip).toContain("Addr: 5");
    expect(tooltip).toContain("L1: 1"); // block 5/4 = 1
    expect(tooltip).toContain("L2: 0"); // block 5/8 = 0
    expect(tooltip).toContain("Reads: 2");
    expect(tooltip).toContain("Writes: 1");

    act(() => {
      root.unmount();
    });
  });

  it("applies heat color to touched cells", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <MemoryPanel
          memory={[0, 0, 0, 0]}
          events={[createEvent({ stage: "memory", address: 2, opKind: "R" })]}
          levels={[]}
        />
      );
    });

    const cells = host.querySelectorAll(".memory-cell");
    // Untouched cell should have the cold color
    const untouchedBg = (cells[0] as HTMLElement).style.backgroundColor;
    // Touched cell should have a different (hot) color
    const touchedBg = (cells[2] as HTMLElement).style.backgroundColor;
    expect(untouchedBg).not.toBe(touchedBg);

    act(() => {
      root.unmount();
    });
  });

  it("renders the grid container with memory-grid class", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <MemoryPanel memory={[0, 0, 0, 0]} events={[]} levels={[]} />
      );
    });

    const grid = host.querySelector(".memory-grid");
    expect(grid).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
