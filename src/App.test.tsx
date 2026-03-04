import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses selected playback speed for run loop ticks", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<App />);
    });

    const speedSelect = host.querySelector(
      'select[aria-label="Playback speed"]'
    ) as HTMLSelectElement;
    const runButton = host.querySelector(
      'button[data-action="run"]'
    ) as HTMLButtonElement;

    act(() => {
      speedSelect.value = "1000";
      speedSelect.dispatchEvent(new Event("change", { bubbles: true }));
      runButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.textContent).toContain("0/12");

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(host.textContent).toContain("0/12");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(host.textContent).toContain("1/12");

    act(() => {
      root.unmount();
    });
  });
});
