import "@testing-library/jest-dom/vitest";

// jsdom does not implement ResizeObserver; provide a no-op stub for tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
