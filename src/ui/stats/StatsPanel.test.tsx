import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { StatsPanel } from "./StatsPanel";

describe("StatsPanel", () => {
  it("renders global totals and per-level hit/miss/eviction stats with hit rate", () => {
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
              L3: { hits: 0, misses: 0, evictions: 0 },
            },
          }}
          levels={["L1", "L2"]}
          nextOpIndex={2}
          totalOps={5}
        />,
      );
    });

    expect(host.textContent).toContain("Progress");
    expect(host.textContent).toContain("2/5");
    expect(host.textContent).toContain("Hits");
    expect(host.textContent).toContain("L1 hit rate");
    expect(host.textContent).toContain("66.7%");
    expect(host.textContent).toContain("L2 misses");

    act(() => {
      root.unmount();
    });
  });
});
