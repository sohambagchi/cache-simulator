import { act, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { CacheLevelConfig, ValidationIssue } from "../../domain/types";
import { HierarchyBuilderPanel } from "./HierarchyBuilderPanel";

function createLevels(): CacheLevelConfig[] {
  return [
    {
      id: "L1",
      enabled: true,
      totalSizeBytes: 256,
      blockSizeBytes: 16,
      associativity: 2,
      replacementPolicy: "LRU",
      writeHitPolicy: "WRITE_BACK",
      writeMissPolicy: "WRITE_ALLOCATE",
    },
    {
      id: "L2",
      enabled: true,
      totalSizeBytes: 512,
      blockSizeBytes: 16,
      associativity: 2,
      replacementPolicy: "FIFO",
      writeHitPolicy: "WRITE_BACK",
      writeMissPolicy: "WRITE_ALLOCATE",
    },
    {
      id: "L3",
      enabled: false,
      totalSizeBytes: 1024,
      blockSizeBytes: 16,
      associativity: 4,
      replacementPolicy: "LRU",
      writeHitPolicy: "WRITE_BACK",
      writeMissPolicy: "WRITE_ALLOCATE",
    },
  ];
}

function Harness({ warnings = [] }: { warnings?: ValidationIssue[] }) {
  const [levels, setLevels] = useState(createLevels);
  const l2MissValue = useMemo(
    () => levels.find((level) => level.id === "L2")?.writeMissPolicy ?? "",
    [levels],
  );

  return (
    <>
      <HierarchyBuilderPanel
        levels={levels}
        warnings={warnings}
        onUpdateLevel={(levelId, patch) => {
          setLevels((current) =>
            current.map((level) => (level.id === levelId ? { ...level, ...patch } : level)),
          );
        }}
      />
      <output data-testid="l2-write-miss-policy">{l2MissValue}</output>
    </>
  );
}

describe("HierarchyBuilderPanel", () => {
  it("renders separate per-level write-hit and write-miss controls without cross-level mutation", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<Harness />);
    });

    const l1WriteMiss = host.querySelector('select[aria-label="L1 write miss policy"]') as HTMLSelectElement;
    const l2WriteMiss = host.querySelector('select[aria-label="L2 write miss policy"]') as HTMLSelectElement;

    expect(l2WriteMiss.value).toBe("WRITE_ALLOCATE");

    act(() => {
      l1WriteMiss.value = "WRITE_NO_ALLOCATE";
      l1WriteMiss.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(l1WriteMiss.value).toBe("WRITE_NO_ALLOCATE");
    expect(host.querySelector("[data-testid='l2-write-miss-policy']")?.textContent).toBe("WRITE_ALLOCATE");

    act(() => {
      root.unmount();
    });
  });

  it("shows non-standard policy warnings and keeps edits non-blocking", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const warnings: ValidationIssue[] = [
      {
        code: "NON_STANDARD_POLICY",
        levelId: "L1",
        message: "L1: non-standard write policy combination",
      },
    ];

    act(() => {
      root.render(<Harness warnings={warnings} />);
    });

    expect(host.textContent).toContain("L1: non-standard write policy combination");

    const l1WriteHit = host.querySelector('select[aria-label="L1 write hit policy"]') as HTMLSelectElement;
    act(() => {
      l1WriteHit.value = "WRITE_THROUGH";
      l1WriteHit.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(l1WriteHit.value).toBe("WRITE_THROUGH");

    act(() => {
      root.unmount();
    });
  });
});
