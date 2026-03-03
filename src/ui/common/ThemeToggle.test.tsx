import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });

  it("defaults to light theme on initial render", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.documentElement.setAttribute("data-theme", "dark");

    act(() => {
      root.render(<ThemeToggle />);
    });

    const button = host.querySelector('button[data-testid="theme-toggle"]');
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(button?.textContent).toContain("Light");

    act(() => {
      root.unmount();
    });
  });

  it("toggles to dark mode and back to light mode", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<ThemeToggle />);
    });

    const button = host.querySelector('button[data-testid="theme-toggle"]');
    expect(button).toBeTruthy();

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(button?.textContent).toContain("Dark");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(button?.textContent).toContain("Light");

    act(() => {
      root.unmount();
    });
  });
});
