import type { Action } from "../../state/actions";
import { ThemeToggle } from "../common/ThemeToggle";

type GlobalControlBarProps = {
  canRun: boolean;
  isPlaying: boolean;
  statusMessage?: string | null;
  onDispatch: (action: Action) => void;
};

export function GlobalControlBar({ canRun, isPlaying, statusMessage, onDispatch }: GlobalControlBarProps) {
  return (
    <section
      className="global-control-bar"
      data-testid="global-control-bar"
      data-playing={isPlaying ? "true" : "false"}
      aria-label="Simulation controls"
    >
      <div className="global-control-bar__buttons">
        <button data-action="step" type="button" disabled={!canRun} onClick={() => onDispatch({ type: "STEP" })}>
          Step
        </button>
        <button data-action="run" type="button" disabled={!canRun} onClick={() => onDispatch({ type: "PLAY" })}>
          Run
        </button>
        <button data-action="pause" type="button" onClick={() => onDispatch({ type: "PAUSE" })}>
          Pause
        </button>
        <button data-action="reset" type="button" onClick={() => onDispatch({ type: "RESET" })}>
          Reset
        </button>
        <ThemeToggle />
      </div>
      {statusMessage ? <p className="global-control-bar__status">{statusMessage}</p> : null}
    </section>
  );
}
