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
  onSelectExample,
}: WorkloadEditorPanelProps) {
  return (
    <div className="panel-stack">
      <label>
        <span>Built-in example</span>
        <select aria-label="Built-in example" defaultValue="" onChange={(event) => onSelectExample(event.currentTarget.value)}>
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
          onInput={(event) => onChangeTrace((event.target as HTMLTextAreaElement).value)}
        />
      </label>

      <section>
        <h3>Parsed preview</h3>
        <ul>
          {parseResult.ops.map((op, index) => (
            <li key={`${op.kind}-${op.address}-${index}`}>
              {op.kind === "W" ? `W @ ${op.address} = ${op.value}` : `R @ ${op.address}`}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Diagnostics</h3>
        {parseResult.errors.length === 0 ? (
          <p>No parse errors</p>
        ) : (
          <ul>
            {parseResult.errors.map((error, index) => (
              <li key={`${error.line}-${index}`}>{error.message}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
