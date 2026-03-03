import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "../../engine/initialState";
import { MemoryPanel } from "./MemoryPanel";

function createEvent(overrides: Partial<SimEvent>): SimEvent {
  return {
    operationId: 1,
    stage: "decode",
    levelId: "L1",
    opKind: "R",
    address: 0,
    tag: 0,
    index: 0,
    offset: 0,
    comparedWays: [],
    ...overrides,
  };
}

describe("MemoryPanel", () => {
  it("renders only addresses touched by memory stage events", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(
        <MemoryPanel
          memory={[11, 22, 33, 44, 55]}
          events={[
            createEvent({ stage: "decode", address: 1 }),
            createEvent({ stage: "fill", address: 2 }),
            createEvent({ stage: "memory", address: 4 }),
            createEvent({ stage: "memory", address: 1 }),
          ]}
        />,
      );
    });

    expect(host.textContent).toContain("[1] = 22");
    expect(host.textContent).toContain("[4] = 55");
    expect(host.textContent).not.toContain("[2] = 33");

    act(() => {
      root.unmount();
    });
  });
});
