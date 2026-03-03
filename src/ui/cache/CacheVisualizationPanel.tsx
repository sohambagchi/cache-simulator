import type { CacheLevelState, SimEvent } from "../../engine/initialState";
import { useState } from "react";
import { CollapsibleCard } from "../common/CollapsibleCard";

type CacheVisualizationPanelProps = {
  levels: CacheLevelState[];
  events: SimEvent[];
};

export function CacheVisualizationPanel({ levels, events }: CacheVisualizationPanelProps) {
  const currentOperationId = events[events.length - 1]?.operationId;
  const currentOperationEvents = currentOperationId
    ? events.filter((event) => event.operationId === currentOperationId)
    : [];
  const activeLevelId = currentOperationEvents[currentOperationEvents.length - 1]?.levelId;
  const [revealedDataKeys, setRevealedDataKeys] = useState<Record<string, boolean>>({});

  function latestLevelEvent(levelId: CacheLevelState["id"]): SimEvent | undefined {
    for (let index = currentOperationEvents.length - 1; index >= 0; index -= 1) {
      const event = currentOperationEvents[index];
      if (event.levelId === levelId) {
        return event;
      }
    }

    return undefined;
  }

  function toggleData(levelId: string, setIndex: number, wayIndex: number): void {
    const key = `${levelId}-${setIndex}-${wayIndex}`;
    setRevealedDataKeys((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <div className="panel-stack">
      {levels.map((level) => {
        const levelEvent = latestLevelEvent(level.id);

        return (
          <CollapsibleCard key={level.id} title={`${level.id} cache`} defaultExpanded={true} sectionId={`cache-${level.id}`}>
            <div
              className="cache-level"
              data-testid={`cache-level-${level.id}`}
              data-active={activeLevelId === level.id ? "true" : "false"}
            >
              {level.sets.map((set, setIndex) => {
                const isActiveSet = levelEvent?.index === setIndex;
                const setClassName = isActiveSet ? "cache-set cache-set--active-cue" : "cache-set";

                return (
                  <div
                    key={`${level.id}-set-${setIndex}`}
                    className={setClassName}
                    data-set-index={String(setIndex)}
                    data-active-set={isActiveSet ? "true" : "false"}
                  >
                    <h4>Set {setIndex}</h4>
                    <table className="cache-set-table">
                      <thead>
                        <tr>
                          <th scope="col">Way</th>
                          <th scope="col">V</th>
                          <th scope="col">D</th>
                          <th scope="col">Tag</th>
                          <th scope="col">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {set.ways.map((way, wayIndex) => {
                          const key = `${level.id}-${setIndex}-${wayIndex}`;
                          const showData = Boolean(revealedDataKeys[key]);
                          const comparedWay = levelEvent?.comparedWays.find((entry) => entry.way === wayIndex);
                          const isVictimWay = isActiveSet && levelEvent?.victimWay === wayIndex;
                          const hasTagCue = isActiveSet && way.valid && levelEvent?.tag === way.tag;
                          const hasCompareCue = Boolean(comparedWay?.match);
                          const wayStatusClassName = [
                            "cache-way-row",
                            way.valid ? "cache-way--valid" : "cache-way--invalid",
                            way.dirty ? "cache-way--dirty" : "cache-way--clean",
                            isVictimWay ? "cache-way--victim-cue" : "",
                            hasTagCue ? "cache-way--tag-cue" : "",
                            hasCompareCue ? "cache-way--compare-cue" : "",
                          ].join(" ");

                          return (
                            <tr
                              key={`${level.id}-set-${setIndex}-way-${wayIndex}`}
                              className={wayStatusClassName}
                              data-way-index={String(wayIndex)}
                              data-victim-way={isVictimWay ? "true" : "false"}
                              data-tag-match={hasTagCue ? "true" : "false"}
                              data-compare-match={hasCompareCue ? "true" : "false"}
                            >
                              <td className="cache-cell cache-cell--way">W{wayIndex}</td>
                              <td className={`cache-cell ${way.valid ? "cache-cell--valid-true" : "cache-cell--valid-false"}`}>
                                {way.valid ? "1" : "0"}
                              </td>
                              <td className={`cache-cell ${way.dirty ? "cache-cell--dirty-true" : "cache-cell--dirty-false"}`}>
                                {way.dirty ? "1" : "0"}
                              </td>
                              <td className="cache-cell cache-cell--tag">{way.tag}</td>
                              <td className="cache-cell cache-cell--data">
                                <span>{showData ? String(way.data) : "hidden"}</span>
                                <button
                                  data-action="toggle-block-data"
                                  type="button"
                                  onClick={() => toggleData(level.id, setIndex, wayIndex)}
                                >
                                  {showData ? "Hide data" : "Show data"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        );
      })}
    </div>
  );
}
