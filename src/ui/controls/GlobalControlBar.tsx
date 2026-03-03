import type { Action } from "../../state/actions";
import { useRef, useState } from "react";
import { ThemeToggle, type ThemeMode } from "../common/ThemeToggle";

type GlobalControlBarProps = {
  canRun: boolean;
  isPlaying: boolean;
  statusMessage?: string | null;
  playbackSpeedMs: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onPlaybackSpeedChange: (speedMs: number) => void;
  onDispatch: (action: Action) => void;
};

export function GlobalControlBar({
  canRun,
  isPlaying,
  statusMessage,
  playbackSpeedMs,
  theme,
  onToggleTheme,
  onPlaybackSpeedChange,
  onDispatch,
}: GlobalControlBarProps) {
  const [requestKind, setRequestKind] = useState<"R" | "W">("R");
  const [requestError, setRequestError] = useState<string | null>(null);
  const requestAddressRef = useRef<HTMLInputElement>(null);
  const requestValueRef = useRef<HTMLInputElement>(null);

  function submitRequest(): void {
    const requestAddress = requestAddressRef.current?.value ?? "0";
    const address = Number.parseInt(requestAddress, 10);
    if (!Number.isSafeInteger(address)) {
      setRequestError("Enter a valid integer address.");
      return;
    }

    if (requestKind === "R") {
      setRequestError(null);
      onDispatch({
        type: "SUBMIT_REQUEST",
        payload: {
          request: {
            kind: "R",
            address,
          },
        },
      });
      return;
    }

    const requestValue = requestValueRef.current?.value ?? "0";
    const value = Number.parseInt(requestValue, 10);
    if (!Number.isSafeInteger(value)) {
      setRequestError("Enter a valid integer value.");
      return;
    }

    setRequestError(null);
    onDispatch({
      type: "SUBMIT_REQUEST",
      payload: {
        request: {
          kind: "W",
          address,
          value,
        },
      },
    });
  }

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
        <label className="global-control-bar__speed">
          <span>Speed</span>
          <select
            aria-label="Playback speed"
            value={String(playbackSpeedMs)}
            onChange={(event) => onPlaybackSpeedChange(Number(event.currentTarget.value))}
          >
            <option value="120">Fast</option>
            <option value="300">Normal</option>
            <option value="600">Slow</option>
            <option value="1000">Step focus</option>
          </select>
        </label>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="global-control-bar__request">
        <label>
          <span>Request</span>
          <select
            aria-label="Request kind"
            value={requestKind}
            onChange={(event) => {
              setRequestKind(event.currentTarget.value as "R" | "W");
              setRequestError(null);
            }}
          >
            <option value="R">R</option>
            <option value="W">W</option>
          </select>
        </label>
        <label>
          <span>Address</span>
          <input
            ref={requestAddressRef}
            aria-label="Request address"
            type="number"
            defaultValue="0"
          />
        </label>
        <label>
          <span>Value</span>
          <input
            ref={requestValueRef}
            aria-label="Request value"
            type="number"
            defaultValue="0"
            disabled={requestKind === "R"}
          />
        </label>
        <button data-action="submit-request" type="button" onClick={submitRequest}>
          Submit request
        </button>
      </div>
      {requestError ? (
        <p className="global-control-bar__request-error" role="status" aria-live="polite">
          {requestError}
        </p>
      ) : null}
      {statusMessage ? <p className="global-control-bar__status">{statusMessage}</p> : null}
    </section>
  );
}
