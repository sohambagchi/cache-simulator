import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { GlobalControlBar } from "./GlobalControlBar";

describe("GlobalControlBar", () => {
  it("keeps controls visible and dispatches step/run/pause/reset including PLAY for run", async () => {
    const onDispatch = vi.fn();
    const onToggleTheme = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <GlobalControlBar
          canRun={true}
          isPlaying={false}
          theme="light"
          onToggleTheme={onToggleTheme}
          onDispatch={onDispatch}
        />,
      );
    });

    const stepButton = host.querySelector('button[data-action="step"]');
    const runButton = host.querySelector('button[data-action="run"]');
    const pauseButton = host.querySelector('button[data-action="pause"]');
    const resetButton = host.querySelector('button[data-action="reset"]');
    const themeButton = host.querySelector('button[data-testid="theme-toggle"]');

    act(() => {
      stepButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      pauseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      themeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.querySelector("[data-testid='global-control-bar']")).toBeTruthy();
    expect(onDispatch).toHaveBeenNthCalledWith(1, { type: "STEP" });
    expect(onDispatch).toHaveBeenNthCalledWith(2, { type: "PLAY" });
    expect(onDispatch).toHaveBeenNthCalledWith(3, { type: "PAUSE" });
    expect(onDispatch).toHaveBeenNthCalledWith(4, { type: "RESET" });
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    const kindSelect = host.querySelector('select[aria-label="Request kind"]') as HTMLSelectElement;
    const addressInput = host.querySelector('input[aria-label="Request address"]') as HTMLInputElement;
    const valueInput = host.querySelector('input[aria-label="Request value"]') as HTMLInputElement;
    const submitButton = host.querySelector('button[data-action="submit-request"]');

    act(() => {
      kindSelect.value = "W";
      kindSelect.dispatchEvent(new Event("change", { bubbles: true }));
      addressInput.value = "12";
      addressInput.dispatchEvent(new Event("change", { bubbles: true }));
      valueInput.value = "99";
      valueInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    act(() => {
      submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onDispatch).toHaveBeenNthCalledWith(5, {
      type: "SUBMIT_REQUEST",
      payload: { request: { kind: "W", address: 12, value: 99 } },
    });

    act(() => {
      root.unmount();
    });
  });
});
