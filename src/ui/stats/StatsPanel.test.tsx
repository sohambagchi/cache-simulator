import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { StatsPanel } from "./StatsPanel";

describe("StatsPanel", () => {
  it("renders loud global trio, secondary row, and per-level cards", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <StatsPanel
          stats={{
            reads: 1,
            writes: 2,
            hits: 2,
            misses: 1,
            evictions: 1,
            writeBacks: 0,
            memoryReads: 1,
            memoryWrites: 0,
            perLevel: {
              L1: { hits: 2, misses: 1, evictions: 1 },
              L2: { hits: 0, misses: 1, evictions: 0 },
              L3: { hits: 0, misses: 0, evictions: 0 }
            }
          }}
          levels={["L1", "L2"]}
        />
      );
    });

    // Global trio
    const trioCards = host.querySelectorAll(".stats-trio-card");
    expect(trioCards).toHaveLength(3);
    expect(host.querySelector(".stats-trio-card--hits")?.textContent).toContain(
      "2"
    );
    expect(
      host.querySelector(".stats-trio-card--misses")?.textContent
    ).toContain("1");
    expect(host.querySelector(".stats-trio-card--rate")?.textContent).toContain(
      "66.7%"
    );

    // Secondary row
    const secondary = host.querySelector(".stats-panel__secondary")!;
    expect(secondary.textContent).toContain("Reads");
    expect(secondary.textContent).toContain("Writes");
    expect(secondary.textContent).toContain("Evictions");
    expect(secondary.textContent).toContain("Mem Reads");
    expect(secondary.textContent).toContain("Mem Writes");

    // Per-level cards
    const levelCards = host.querySelectorAll(".stats-level-card");
    expect(levelCards).toHaveLength(2);
    expect(levelCards[0].textContent).toContain("L1");
    expect(levelCards[0].textContent).toContain("66.7%");
    expect(levelCards[1].textContent).toContain("L2");
    expect(levelCards[1].textContent).toContain("0.0%");

    // Progress should NOT be present
    expect(host.textContent).not.toContain("Progress");

    act(() => {
      root.unmount();
    });
  });
});
