import type { CacheLevelState, SimEvent } from "../../engine/initialState";
import { CollapsibleCard } from "../common/CollapsibleCard";

type CacheVisualizationPanelProps = {
  levels: CacheLevelState[];
  events: SimEvent[];
};

function StatusDot({
  active,
  kind
}: {
  active: boolean;
  kind: "valid" | "dirty";
}) {
  const label =
    kind === "valid"
      ? active
        ? "Valid"
        : "Invalid"
      : active
        ? "Dirty"
        : "Clean";

  const className = [
    "status-dot",
    `status-dot--${kind}`,
    active ? "status-dot--on" : "status-dot--off"
  ].join(" ");

  return <span className={className} title={label} aria-label={label} />;
}

export function CacheVisualizationPanel({
  levels,
  events
}: CacheVisualizationPanelProps) {
  const currentOperationId = events[events.length - 1]?.operationId;
  const currentOperationEvents = currentOperationId
    ? events.filter((event) => event.operationId === currentOperationId)
    : [];
  const activeLevelId =
    currentOperationEvents[currentOperationEvents.length - 1]?.levelId;

  function latestLevelEvent(
    levelId: CacheLevelState["id"]
  ): SimEvent | undefined {
    for (
      let index = currentOperationEvents.length - 1;
      index >= 0;
      index -= 1
    ) {
      const event = currentOperationEvents[index];
      if (event.levelId === levelId) {
        return event;
      }
    }
    return undefined;
  }

  return (
    <div className="panel-stack">
      {levels.map((level) => {
        const levelEvent = latestLevelEvent(level.id);

        return (
          <CollapsibleCard
            key={level.id}
            title={`${level.id} cache`}
            defaultExpanded={true}
            sectionId={`cache-${level.id}`}
          >
            <div
              className="cache-level"
              data-testid={`cache-level-${level.id}`}
              data-active={activeLevelId === level.id ? "true" : "false"}
            >
              <table className="cache-table">
                <thead>
                  <tr>
                    <th scope="col" className="cache-th cache-th--set">
                      Set
                    </th>
                    <th scope="col" className="cache-th cache-th--way">
                      Way
                    </th>
                    <th scope="col" className="cache-th cache-th--tag">
                      Tag
                    </th>
                    <th scope="col" className="cache-th cache-th--data">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {level.sets.map((set, setIndex) => {
                    const isActiveSet = levelEvent?.index === setIndex;

                    return set.ways.map((way, wayIndex) => {
                      const comparedWay = levelEvent?.comparedWays.find(
                        (entry) => entry.way === wayIndex
                      );
                      const isVictimWay =
                        isActiveSet && levelEvent?.victimWay === wayIndex;
                      const hasTagCue =
                        isActiveSet && way.valid && levelEvent?.tag === way.tag;
                      const hasCompareCue = Boolean(comparedWay?.match);
                      const rowClassName = [
                        "cache-row",
                        way.valid ? "cache-way--valid" : "cache-way--invalid",
                        way.dirty ? "cache-way--dirty" : "cache-way--clean",
                        isVictimWay ? "cache-way--victim-cue" : "",
                        hasTagCue ? "cache-way--tag-cue" : "",
                        hasCompareCue ? "cache-way--compare-cue" : ""
                      ].join(" ");

                      return (
                        <tr
                          key={`${level.id}-set-${setIndex}-way-${wayIndex}`}
                          className={rowClassName}
                          data-set-index={String(setIndex)}
                          data-way-index={String(wayIndex)}
                          data-active-set={isActiveSet ? "true" : "false"}
                          data-victim-way={isVictimWay ? "true" : "false"}
                          data-tag-match={hasTagCue ? "true" : "false"}
                          data-compare-match={hasCompareCue ? "true" : "false"}
                        >
                          {wayIndex === 0 && (
                            <td
                              className="cache-cell cache-cell--set"
                              rowSpan={set.ways.length}
                            >
                              {setIndex}
                            </td>
                          )}
                          <td className="cache-cell cache-cell--way">
                            <div className="cache-cell--way__inner">
                              <span className="cache-way-label">
                                {wayIndex}
                              </span>
                              <span className="cache-way-indicators">
                                <StatusDot active={way.valid} kind="valid" />
                                <StatusDot active={way.dirty} kind="dirty" />
                              </span>
                            </div>
                          </td>
                          <td className="cache-cell cache-cell--tag">
                            {way.valid ? way.tag : ""}
                          </td>
                          <td className="cache-cell cache-cell--data">
                            {way.valid ? (
                              <span className="cache-data-bytes">
                                {way.dataBytes.map((byte, byteIndex) => (
                                  <span key={byteIndex} className="cache-byte">
                                    {byte}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleCard>
        );
      })}
    </div>
  );
}
