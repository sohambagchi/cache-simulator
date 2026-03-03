import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("renders light theme state when controlled with light value", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<ThemeToggle theme="light" onToggle={() => {}} />);
    });

    const button = host.querySelector('button[data-testid="theme-toggle"]');
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(button?.textContent).toContain("\u2600");

    act(() => {
      root.unmount();
    });
  });

  it("renders dark theme state when controlled with dark value", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<ThemeToggle theme="dark" onToggle={() => {}} />);
    });

    const button = host.querySelector('button[data-testid="theme-toggle"]');
    expect(button).toBeTruthy();
    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(button?.textContent).toContain("\u263D");

    act(() => {
      root.unmount();
    });
  });

  it("invokes onToggle when clicked", () => {
    const onToggle = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<ThemeToggle theme="light" onToggle={onToggle} />);
    });

    const button = host.querySelector('button[data-testid="theme-toggle"]');
    expect(button).toBeTruthy();

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggle).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });
});
