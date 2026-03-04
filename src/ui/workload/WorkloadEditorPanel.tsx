import type { WorkloadParseResult } from "../../parser/parseWorkload";
import type { WorkloadExample } from "../../workloads/examples";

type WorkloadEditorPanelProps = {
  workloadText: string;
  parseResult: WorkloadParseResult;
  examples: readonly WorkloadExample[];
  onChangeTrace: (text: string) => void;
  onSelectExample: (exampleId: string) => void;
};

export function WorkloadEditorPanel({
  workloadText,
  parseResult,
  examples,
  onChangeTrace,
  onSelectExample
}: WorkloadEditorPanelProps) {
  const selectedExampleId =
    examples.find((example) => example.text === workloadText)?.id ?? "";

  return (
    <div className="panel-stack">
      <label>
        <span>Built-in example</span>
        <select
          aria-label="Built-in example"
          value={selectedExampleId}
          onChange={(event) => onSelectExample(event.currentTarget.value)}
        >
          <option value="" disabled>
            Select an example
          </option>
          {examples.map((example) => (
            <option key={example.id} value={example.id}>
              {example.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Workload trace</span>
        <textarea
          aria-label="Workload trace"
          value={workloadText}
          rows={8}
          onChange={(event) => onChangeTrace(event.currentTarget.value)}
        />
      </label>

      {/* Parse errors — only shown when present */}
      {parseResult.errors.length > 0 && (
        <ul className="warning-list" aria-label="Parse errors">
          {parseResult.errors.map((error, index) => (
            <li key={`${error.line}-${index}`}>{error.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
