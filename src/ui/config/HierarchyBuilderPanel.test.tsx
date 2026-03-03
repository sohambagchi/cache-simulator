import { act, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
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

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
}

describe("HierarchyBuilderPanel", () => {
  it("keeps geometry interdependent by coercing powers-of-two and deterministic total size", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const onUpdateLevel = vi.fn();

    act(() => {
      root.render(<HierarchyBuilderPanel levels={createLevels()} warnings={[]} onUpdateLevel={onUpdateLevel} />);
    });

    const total = host.querySelector('input[aria-label="L1 total size bytes"]') as HTMLInputElement;
    const block = host.querySelector('input[aria-label="L1 block size bytes"]') as HTMLInputElement;
    const associativity = host.querySelector('input[aria-label="L1 associativity"]') as HTMLInputElement;

    act(() => {
      setNativeInputValue(block, "24");
      block.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onUpdateLevel).toHaveBeenNthCalledWith(1, "L1", {
      blockSizeBytes: 32,
      associativity: 2,
      totalSizeBytes: 256,
    });

    act(() => {
      setNativeInputValue(associativity, "3");
      associativity.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onUpdateLevel).toHaveBeenNthCalledWith(2, "L1", {
      blockSizeBytes: 16,
      associativity: 4,
      totalSizeBytes: 256,
    });

    act(() => {
      setNativeInputValue(total, "300");
      total.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onUpdateLevel).toHaveBeenNthCalledWith(3, "L1", {
      blockSizeBytes: 16,
      associativity: 2,
      totalSizeBytes: 256,
    });

    act(() => {
      root.unmount();
    });
  });

  it("disables enabled toggle for the final active level", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const levels = [
      { ...createLevels()[0], enabled: true },
      { ...createLevels()[1], enabled: false },
      { ...createLevels()[2], enabled: false },
    ];

    act(() => {
      root.render(<HierarchyBuilderPanel levels={levels} warnings={[]} onUpdateLevel={() => undefined} />);
    });

    const l1Toggle = host.querySelector("fieldset input[type='checkbox']") as HTMLInputElement;
    expect(l1Toggle.disabled).toBe(true);

    act(() => {
      root.unmount();
    });
  });

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
