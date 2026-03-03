import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "../../engine/initialState";
import { EventTimelinePanel } from "./EventTimelinePanel";

describe("EventTimelinePanel", () => {
  it("shows decode details and compare outcomes for the latest operation", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    const events: SimEvent[] = [
      {
        operationId: 1,
        stage: "compare",
        levelId: "L1",
        opKind: "R",
        address: 8,
        tag: 2,
        index: 1,
        offset: 0,
        comparedWays: [{ way: 0, valid: true, tag: 2, match: true }],
      },
      {
        operationId: 2,
        stage: "decode",
        levelId: "L1",
        opKind: "R",
        address: 20,
        tag: 5,
        index: 2,
        offset: 0,
        comparedWays: [],
      },
      {
        operationId: 2,
        stage: "compare",
        levelId: "L1",
        opKind: "R",
        address: 20,
        tag: 5,
        index: 2,
        offset: 0,
        comparedWays: [
          { way: 0, valid: true, tag: 4, match: false },
          { way: 1, valid: true, tag: 5, match: true },
        ],
      },
      {
        operationId: 2,
        stage: "fill",
        levelId: "L1",
        opKind: "R",
        address: 20,
        tag: 5,
        index: 2,
        offset: 0,
        comparedWays: [],
        victimWay: 0,
      },
    ];

    act(() => {
      root.render(<EventTimelinePanel events={events} />);
    });

    expect(host.textContent).toContain("Tag 5");
    expect(host.textContent).toContain("Index 2");
    expect(host.textContent).toContain("Offset 0");
    expect(host.textContent).toContain("Matched ways: 1");
    expect(host.textContent).toContain("Victim cue: way 0");

    act(() => {
      root.unmount();
    });
  });
});
