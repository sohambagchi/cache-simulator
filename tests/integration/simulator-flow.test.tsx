import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";

function clickButton(host: HTMLDivElement, label: string): void {
  const button = Array.from(host.querySelectorAll("button")).find(
    (entry) => entry.textContent?.trim() === label
  );

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function getProgress(host: HTMLDivElement): string {
  const progressLabel = Array.from(host.querySelectorAll("dt")).find(
    (entry) => entry.textContent?.trim() === "Progress"
  );

  if (!progressLabel) {
    throw new Error("Progress label not found");
  }

  const progressValue = progressLabel.nextElementSibling;
  if (!progressValue) {
    throw new Error("Progress value not found");
  }

  return progressValue.textContent?.trim() ?? "";
}

function selectBuiltInExample(host: HTMLDivElement, exampleId: string): void {
  const select = host.querySelector('select[aria-label="Built-in example"]');
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error("Built-in example select not found");
  }

  select.value = exampleId;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function openTimeline(host: HTMLDivElement): void {
  const btn = host.querySelector('button[aria-label="Open timeline"]');
  if (!btn) {
    throw new Error("Timeline toggle button not found");
  }
  btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("simulator integration flow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads trace then step/run/pause/reset updates timeline and stats", () => {
    vi.useFakeTimers();

    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<App />);
    });

    act(() => {
      selectBuiltInExample(host, "writeback-eviction-cascade");
    });

    expect(getProgress(host)).toBe("0/4");

    // Open timeline drawer to verify empty state
    act(() => {
      openTimeline(host);
    });
    expect(host.textContent).toContain("No events yet");

    act(() => {
      clickButton(host, "Step");
    });

    expect(getProgress(host)).toBe("1/4");
    expect(host.querySelectorAll(".timeline-list li").length).toBeGreaterThan(
      0
    );

    // Close the drawer (click backdrop or close button)
    const closeBtn = host.querySelector('button[aria-label="Close timeline"]');
    act(() => {
      closeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      clickButton(host, "Run");
    });

    expect(
      host
        .querySelector("[data-testid='global-control-bar']")
        ?.getAttribute("data-playing")
    ).toBe("true");

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(getProgress(host)).not.toBe("1/4");

    act(() => {
      clickButton(host, "Pause");
    });

    expect(
      host
        .querySelector("[data-testid='global-control-bar']")
        ?.getAttribute("data-playing")
    ).toBe("false");

    act(() => {
      clickButton(host, "Reset");
    });

    expect(getProgress(host)).toBe("0/4");

    // Open timeline to verify it's cleared
    act(() => {
      openTimeline(host);
    });
    expect(host.textContent).toContain("No events yet");

    act(() => {
      root.unmount();
    });
  });
});
