import type { Action } from "../../state/actions";
import { useRef, useState } from "react";

type ManualRequestPanelProps = {
  onDispatch: (action: Action) => void;
};

export function ManualRequestPanel({ onDispatch }: ManualRequestPanelProps) {
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
        payload: { request: { kind: "R", address } }
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
      payload: { request: { kind: "W", address, value } }
    });
  }

  return (
    <div className="panel-stack" data-testid="manual-request-panel">
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
        <button
          className="btn btn--primary global-control-bar__request-submit"
          data-action="submit-request"
          type="button"
          onClick={submitRequest}
        >
          Submit
        </button>
      </div>
      {requestError ? (
        <p
          className="global-control-bar__request-error"
          role="status"
          aria-live="polite"
        >
          {requestError}
        </p>
      ) : null}
    </div>
  );
}
