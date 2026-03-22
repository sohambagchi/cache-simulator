import type { Action } from "../../state/actions";
import type { WorkloadParseResult } from "../../parser/parseWorkload";
import type { WorkloadExample } from "../../workloads/examples";

type WorkloadPanelProps = {
  // Sim controls
  canRun: boolean;
  isPlaying: boolean;
  statusMessage?: string | null;
  playbackSpeedMs: number;
  onPlaybackSpeedChange: (speedMs: number) => void;
  onDispatch: (action: Action) => void;
  // Progress
  nextOpIndex: number;
  totalOps: number;
  // Workload editor
  workloadText: string;
  parseResult: WorkloadParseResult;
  examples: readonly WorkloadExample[];
  onChangeTrace: (text: string) => void;
  onSelectExample: (exampleId: string) => void;
};

export function WorkloadPanel({
  canRun,
  isPlaying,
  statusMessage,
  playbackSpeedMs,
  onPlaybackSpeedChange,
  onDispatch,
  nextOpIndex,
  totalOps,
  workloadText,
  parseResult,
  examples,
  onChangeTrace,
  onSelectExample
}: WorkloadPanelProps) {
  const selectedExampleId =
    examples.find((example) => example.text === workloadText)?.id ?? "";

  return (
    <div
      className="panel-stack"
      data-testid="global-control-bar"
      data-playing={isPlaying ? "true" : "false"}
    >
      {/* Sim control buttons */}
      <div className="global-control-bar__buttons">
        <button
          className="btn btn--primary"
          data-action="step"
          type="button"
          disabled={!canRun}
          onClick={() => onDispatch({ type: "STEP" })}
        >
          Step
        </button>
        <button
          className="btn btn--primary"
          data-action="run"
          type="button"
          disabled={!canRun}
          onClick={() => onDispatch({ type: "PLAY" })}
        >
          Run
        </button>
        <button
          className="btn"
          data-action="pause"
          type="button"
          onClick={() => onDispatch({ type: "PAUSE" })}
        >
          Pause
        </button>
        <button
          className="btn"
          data-action="reset"
          type="button"
          onClick={() => onDispatch({ type: "RESET" })}
        >
          Reset
        </button>
        <label className="global-control-bar__speed">
          <span>Speed</span>
          <select
            aria-label="Playback speed"
            value={String(playbackSpeedMs)}
            onChange={(event) =>
              onPlaybackSpeedChange(Number(event.currentTarget.value))
            }
          >
            <option value="120">Fast</option>
            <option value="300">Normal</option>
            <option value="600">Slow</option>
            <option value="1000">Step focus</option>
          </select>
        </label>
      </div>

      {statusMessage ? (
        <p className="global-control-bar__status">{statusMessage}</p>
      ) : null}

      {/* Progress */}
      <div className="workload-progress">
        <dt>Progress</dt>
        <dd>
          {nextOpIndex}/{totalOps}
        </dd>
      </div>

      {/* Example picker */}
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

      {/* Trace textarea */}
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
