import { act, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { CacheLevelConfig, ValidationIssue } from "../../domain/types";
import { HierarchyBuilderPanel } from "./HierarchyBuilderPanel";
import {
  TOTAL_SIZE_OPTIONS,
  BLOCK_SIZE_OPTIONS,
  toSliderIndex
} from "./sliderDomain";

function createLevels(): CacheLevelConfig[] {
  return [
    {
      id: "L1",
      enabled: true,
      totalSizeBytes: 256,
      blockSizeBytes: 32,
      associativity: 2,
      replacementPolicy: "LRU",
      writeHitPolicy: "WRITE_BACK",
      writeMissPolicy: "WRITE_ALLOCATE"
    },
    {
      id: "L2",
      enabled: true,
      totalSizeBytes: 512,
      blockSizeBytes: 32,
      associativity: 2,
      replacementPolicy: "FIFO",
      writeHitPolicy: "WRITE_BACK",
      writeMissPolicy: "WRITE_ALLOCATE"
    },
    {
      id: "L3",
      enabled: false,
      totalSizeBytes: 1024,
      blockSizeBytes: 32,
      associativity: 4,
      replacementPolicy: "LRU",
      writeHitPolicy: "WRITE_BACK",
      writeMissPolicy: "WRITE_ALLOCATE"
    }
  ];
}

function Harness({
  warnings = [],
  errors = []
}: {
  warnings?: ValidationIssue[];
  errors?: ValidationIssue[];
}) {
  const [levels, setLevels] = useState(createLevels);
  const [inclusionPolicy, setInclusionPolicy] = useState<
    "INCLUSIVE" | "EXCLUSIVE"
  >("INCLUSIVE");
  const l2MissValue = useMemo(
    () => levels.find((level) => level.id === "L2")?.writeMissPolicy ?? "",
    [levels]
  );

  return (
    <>
      <HierarchyBuilderPanel
        levels={levels}
        warnings={warnings}
        errors={errors}
        inclusionPolicy={inclusionPolicy}
        onUpdateInclusionPolicy={setInclusionPolicy}
        onUpdateLevel={(levelId, patch) => {
          setLevels((current) =>
            current.map((level) =>
              level.id === levelId ? { ...level, ...patch } : level
            )
          );
        }}
      />
      <output data-testid="l2-write-miss-policy">{l2MissValue}</output>
    </>
  );
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  );
  descriptor?.set?.call(input, value);
}

describe("HierarchyBuilderPanel", () => {
  it("renders geometry controls as range sliders and keeps policy controls as selects", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <HierarchyBuilderPanel
          levels={createLevels()}
          warnings={[]}
          inclusionPolicy="INCLUSIVE"
          onUpdateInclusionPolicy={() => undefined}
          onUpdateLevel={() => undefined}
        />
      );
    });

    const totalSlider = host.querySelector(
      'input[aria-label="L1 total size bytes"]'
    ) as HTMLInputElement;
    const blockSlider = host.querySelector(
      'input[aria-label="L1 block size bytes"]'
    ) as HTMLInputElement;
    const assocSlider = host.querySelector(
      'input[aria-label="L1 associativity"]'
    ) as HTMLInputElement;
    const replacementSelect = host.querySelector(
      'select[aria-label="L1 replacement policy"]'
    ) as HTMLSelectElement;
    const writeHitSelect = host.querySelector(
      'select[aria-label="L1 write hit policy"]'
    ) as HTMLSelectElement;
    const writeMissSelect = host.querySelector(
      'select[aria-label="L1 write miss policy"]'
    ) as HTMLSelectElement;

    expect(totalSlider.type).toBe("range");
    expect(blockSlider.type).toBe("range");
    expect(assocSlider.type).toBe("range");
    expect(replacementSelect.tagName).toBe("SELECT");
    expect(writeHitSelect.tagName).toBe("SELECT");
    expect(writeMissSelect.tagName).toBe("SELECT");

    act(() => {
      root.unmount();
    });
  });

  it("dispatches exact discrete option values from slider movement", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const onUpdateLevel = vi.fn();

    act(() => {
      root.render(
        <HierarchyBuilderPanel
          levels={createLevels()}
          warnings={[]}
          inclusionPolicy="INCLUSIVE"
          onUpdateInclusionPolicy={() => undefined}
          onUpdateLevel={onUpdateLevel}
        />
      );
    });

    const totalSlider = host.querySelector(
      'input[aria-label="L1 total size bytes"]'
    ) as HTMLInputElement;
    // Move to index 3 which is 32
    const targetIndex = 3;
    act(() => {
      setNativeInputValue(totalSlider, String(targetIndex));
      totalSlider.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onUpdateLevel).toHaveBeenCalledWith("L1", {
      totalSizeBytes: TOTAL_SIZE_OPTIONS[targetIndex]
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
      { ...createLevels()[2], enabled: false }
    ];

    act(() => {
      root.render(
        <HierarchyBuilderPanel
          levels={levels}
          warnings={[]}
          inclusionPolicy="INCLUSIVE"
          onUpdateInclusionPolicy={() => undefined}
          onUpdateLevel={() => undefined}
        />
      );
    });

    const l1Toggle = host.querySelector(
      ".cache-level-card input[type='checkbox']"
    ) as HTMLInputElement;
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

    const l1WriteMiss = host.querySelector(
      'select[aria-label="L1 write miss policy"]'
    ) as HTMLSelectElement;
    const l2WriteMiss = host.querySelector(
      'select[aria-label="L2 write miss policy"]'
    ) as HTMLSelectElement;

    expect(l2WriteMiss.value).toBe("WRITE_ALLOCATE");

    act(() => {
      l1WriteMiss.value = "WRITE_NO_ALLOCATE";
      l1WriteMiss.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(l1WriteMiss.value).toBe("WRITE_NO_ALLOCATE");
    expect(
      host.querySelector("[data-testid='l2-write-miss-policy']")?.textContent
    ).toBe("WRITE_ALLOCATE");

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
        message: "L1: non-standard write policy combination"
      }
    ];

    act(() => {
      root.render(<Harness warnings={warnings} />);
    });

    expect(host.textContent).toContain(
      "L1: non-standard write policy combination"
    );

    const l1WriteHit = host.querySelector(
      'select[aria-label="L1 write hit policy"]'
    ) as HTMLSelectElement;
    act(() => {
      l1WriteHit.value = "WRITE_THROUGH";
      l1WriteHit.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(l1WriteHit.value).toBe("WRITE_THROUGH");

    act(() => {
      root.unmount();
    });
  });

  it("shows inline helper text and invalid styling for geometry fields with errors", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const errors: ValidationIssue[] = [
      {
        code: "HIERARCHY_MONOTONICITY",
        levelId: "L2",
        message: "L2: totalSizeBytes must be greater than L1"
      },
      {
        code: "BLOCK_SIZE_MONOTONICITY",
        levelId: "L2",
        message:
          "L2: blockSizeBytes must be greater than or equal to L1.blockSizeBytes"
      }
    ];

    act(() => {
      root.render(<Harness errors={errors} />);
    });

    expect(host.textContent).toContain(
      "L2: totalSizeBytes must be greater than L1"
    );
    expect(host.textContent).toContain(
      "L2: blockSizeBytes must be greater than or equal to L1.blockSizeBytes"
    );

    const l2TotalSlider = host.querySelector(
      'input[aria-label="L2 total size bytes"]'
    ) as HTMLInputElement;
    const l2BlockSlider = host.querySelector(
      'input[aria-label="L2 block size bytes"]'
    ) as HTMLInputElement;
    expect(l2TotalSlider.getAttribute("aria-invalid")).toBe("true");
    expect(l2BlockSlider.getAttribute("aria-invalid")).toBe("true");

    act(() => {
      root.unmount();
    });
  });

  it("marks out-of-order slider regions as soft-invalid without disabling editing", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const onUpdateLevel = vi.fn();

    // L1 total=512, L2 total=256 (invalid: L2 < L1)
    const levels: CacheLevelConfig[] = [
      {
        id: "L1",
        enabled: true,
        totalSizeBytes: 512,
        blockSizeBytes: 32,
        associativity: 2,
        replacementPolicy: "LRU",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      },
      {
        id: "L2",
        enabled: true,
        totalSizeBytes: 256,
        blockSizeBytes: 32,
        associativity: 2,
        replacementPolicy: "LRU",
        writeHitPolicy: "WRITE_BACK",
        writeMissPolicy: "WRITE_ALLOCATE"
      }
    ];

    act(() => {
      root.render(
        <HierarchyBuilderPanel
          levels={levels}
          warnings={[]}
          inclusionPolicy="INCLUSIVE"
          onUpdateInclusionPolicy={() => undefined}
          onUpdateLevel={onUpdateLevel}
        />
      );
    });

    const l2TotalSlider = host.querySelector(
      'input[aria-label="L2 total size bytes"]'
    ) as HTMLInputElement;
    expect(l2TotalSlider.getAttribute("data-soft-invalid")).toBe("true");
    expect(l2TotalSlider.disabled).toBe(false);

    // Can still change the slider
    act(() => {
      setNativeInputValue(
        l2TotalSlider,
        String(toSliderIndex(16, TOTAL_SIZE_OPTIONS))
      );
      l2TotalSlider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onUpdateLevel).toHaveBeenCalledWith("L2", { totalSizeBytes: 16 });

    act(() => {
      root.unmount();
    });
  });
});
