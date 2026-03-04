import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  parseWorkload,
  type WorkloadParseResult
} from "../../parser/parseWorkload";
import { BUILTIN_WORKLOAD_EXAMPLES } from "../../workloads/examples";
import { WorkloadEditorPanel } from "./WorkloadEditorPanel";

function Harness() {
  const [workloadText, setWorkloadText] = useState("");
  const [parseResult, setParseResult] = useState<WorkloadParseResult>(() =>
    parseWorkload("")
  );

  return (
    <>
      <button
        type="button"
        aria-label="Load invalid trace"
        onClick={() => {
          const nextText = "Q 1";
          setWorkloadText(nextText);
          setParseResult(parseWorkload(nextText));
        }}
      >
        Invalid
      </button>
      <WorkloadEditorPanel
        workloadText={workloadText}
        parseResult={parseResult}
        examples={BUILTIN_WORKLOAD_EXAMPLES}
        onChangeTrace={(nextText) => {
          setWorkloadText(nextText);
          setParseResult(parseWorkload(nextText));
        }}
        onSelectExample={(exampleId) => {
          const match = BUILTIN_WORKLOAD_EXAMPLES.find(
            (example) => example.id === exampleId
          );
          const nextText = match?.text ?? "";
          setWorkloadText(nextText);
          setParseResult(parseWorkload(nextText));
        }}
      />
    </>
  );
}

describe("WorkloadEditorPanel", () => {
  it("renders parse diagnostics preview with line numbers", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<Harness />);
    });

    const loadInvalid = host.querySelector(
      'button[aria-label="Load invalid trace"]'
    ) as HTMLButtonElement;
    act(() => {
      loadInvalid.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.textContent).toContain("Line 1:");
    expect(host.textContent).toContain("unsupported operation");

    act(() => {
      root.unmount();
    });
  });

  it("loads selected built-in example into editor", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => {
      root.render(<Harness />);
    });

    const select = host.querySelector(
      'select[aria-label="Built-in example"]'
    ) as HTMLSelectElement;
    act(() => {
      select.value = "spatial-locality";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const textarea = host.querySelector(
      'textarea[aria-label="Workload trace"]'
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe(BUILTIN_WORKLOAD_EXAMPLES[0].text);

    act(() => {
      root.unmount();
    });
  });
});
