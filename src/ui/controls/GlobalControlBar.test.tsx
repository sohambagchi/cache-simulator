import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { GlobalControlBar } from "./GlobalControlBar";

describe("GlobalControlBar", () => {
  it("keeps controls visible and dispatches step/run/pause/reset including PLAY for run", async () => {
    const onDispatch = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<GlobalControlBar canRun={true} isPlaying={false} onDispatch={onDispatch} />);
    });

    const stepButton = host.querySelector('button[data-action="step"]');
    const runButton = host.querySelector('button[data-action="run"]');
    const pauseButton = host.querySelector('button[data-action="pause"]');
    const resetButton = host.querySelector('button[data-action="reset"]');

    act(() => {
      stepButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      pauseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.querySelector("[data-testid='global-control-bar']")).toBeTruthy();
    expect(onDispatch).toHaveBeenNthCalledWith(1, { type: "STEP" });
    expect(onDispatch).toHaveBeenNthCalledWith(2, { type: "PLAY" });
    expect(onDispatch).toHaveBeenNthCalledWith(3, { type: "PAUSE" });
    expect(onDispatch).toHaveBeenNthCalledWith(4, { type: "RESET" });

    act(() => {
      root.unmount();
    });
  });
});
