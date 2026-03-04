import type { CacheLevelId } from "../../domain/types";
import type { SimEvent, SimEventStage } from "../../engine/initialState";
import type { WorkloadOp } from "../../parser/parseWorkload";

type ExplanationLogProps = {
  activeEvent: SimEvent | null;
  currentOp: WorkloadOp | undefined;
  /** 1-based op index shown as a label */
  opIndex: number;
  /** Which sub-event we're on (0-based) */
  subEventIndex: number;
  /** Total sub-events for this op */
  totalSubEvents: number;
};

function levelLabel(levelId: CacheLevelId | "MEMORY"): string {
  return levelId === "MEMORY" ? "Main Memory" : levelId;
}

/** Returns { keyword, rest } so the keyword can be bolded separately. */
type SentenceParts = { keyword: string | null; rest: string };

function partsForEvent(event: SimEvent, op: WorkloadOp): SentenceParts {
  const lvl = levelLabel(event.levelId);

  switch (event.stage) {
    case "decode":
      return {
        keyword: null,
        rest: `Checking ${lvl} — address ${event.address} maps to set ${event.index}, tag ${event.tag}, offset ${event.offset}.`
      };

    case "compare": {
      if (event.comparedWays.length === 0)
        return { keyword: null, rest: `Comparing tags in ${lvl}…` };
      const parts = event.comparedWays.map((w) => {
        if (!w.valid) return `way ${w.way}: empty`;
        if (w.match) return `way ${w.way}: tag ${w.tag} ✓`;
        return `way ${w.way}: tag ${w.tag} ✗`;
      });
      return {
        keyword: null,
        rest: `Comparing tags in ${lvl} — ${parts.join(", ")}.`
      };
    }

    case "hit":
      return {
        keyword: "HIT!",
        rest:
          op.kind === "R"
            ? ` Found in ${lvl}, set ${event.index}. Returning data to CPU.`
            : ` Found in ${lvl}, set ${event.index}. Updating in place.`
      };

    case "miss":
      return {
        keyword: "MISS",
        rest: ` in ${lvl}. Block not present — searching deeper.`
      };

    case "eviction": {
      const dirtyNote =
        event.dirtyEvictionTarget !== undefined
          ? `, dirty — writing back to ${levelLabel(event.dirtyEvictionTarget)}.`
          : ", clean.";
      return {
        keyword: "EVICTING",
        rest: ` way ${event.victimWay} from ${lvl} set ${event.index}${dirtyNote}`
      };
    }

    case "writeback":
      return {
        keyword: "WRITE BACK",
        rest: ` — dirty block at address ${event.address} flushed to ${event.dirtyEvictionTarget ? levelLabel(event.dirtyEvictionTarget) : "lower level"}.`
      };

    case "fill":
      return {
        keyword: "FILL",
        rest: ` — loading block into ${lvl} set ${event.index}, way ${event.victimWay}.`
      };

    case "memory":
      return event.opKind === "R"
        ? {
            keyword: "MAIN MEMORY",
            rest: ` — fetching block at address ${event.address}.`
          }
        : {
            keyword: "MAIN MEMORY",
            rest: ` — writing address ${event.address}.`
          };
  }
}

/** Maps a stage to a colour token used as a CSS modifier. */
function toneForStage(stage: SimEventStage | null): string {
  if (!stage) return "idle";
  switch (stage) {
    case "hit":
      return "hit";
    case "miss":
      return "miss";
    case "eviction":
    case "writeback":
      return "warn";
    case "fill":
    case "memory":
      return "info";
    case "decode":
    case "compare":
    default:
      return "neutral";
  }
}

export function ExplanationLog({
  activeEvent,
  currentOp,
  opIndex,
  subEventIndex,
  totalSubEvents
}: ExplanationLogProps) {
  const hasContent = currentOp !== undefined && totalSubEvents > 0;
  const parts =
    activeEvent && currentOp ? partsForEvent(activeEvent, currentOp) : null;
  const tone = toneForStage(activeEvent?.stage ?? null);

  return (
    <div
      className="explanation-log"
      aria-live="polite"
      aria-label="Step explanation"
    >
      {hasContent && currentOp ? (
        <>
          {/* Prominent op header */}
          <div className="explanation-log__op-header">
            <span className="explanation-log__op-index">#{opIndex}</span>
            <span
              className={`explanation-log__op-kind explanation-log__op-kind--${currentOp.kind === "R" ? "read" : "write"}`}
            >
              {currentOp.kind === "R" ? "READ" : "WRITE"}
            </span>
            <span className="explanation-log__op-address">
              addr&nbsp;{currentOp.address}
            </span>
            {currentOp.kind === "W" && (
              <span className="explanation-log__op-value">
                = {currentOp.value}
              </span>
            )}
          </div>

          {/* Styled message box */}
          <div className={`explanation-log__box explanation-log__box--${tone}`}>
            <p className="explanation-log__sentence">
              {parts?.keyword && (
                <strong className="explanation-log__keyword">
                  {parts.keyword}
                </strong>
              )}
              {parts?.rest ?? ""}
            </p>
          </div>

          {/* Pip progress row only */}
          <div className="explanation-log__pip-row" aria-hidden="true">
            {Array.from({ length: totalSubEvents }, (_, i) => (
              <span
                key={i}
                className={
                  "explanation-log__pip" +
                  (i === subEventIndex ? " explanation-log__pip--active" : "")
                }
              />
            ))}
          </div>
        </>
      ) : (
        <div className="explanation-log__box explanation-log__box--idle">
          <p className="explanation-log__sentence explanation-log__sentence--idle">
            Step through operations to see an explanation.
          </p>
        </div>
      )}
    </div>
  );
}
