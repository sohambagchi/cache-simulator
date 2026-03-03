import type { CacheLevelState, SimEvent } from "../../engine/initialState";
import { useState } from "react";
import { CollapsibleCard } from "../common/CollapsibleCard";

type CacheVisualizationPanelProps = {
  levels: CacheLevelState[];
  events: SimEvent[];
};

export function CacheVisualizationPanel({ levels, events }: CacheVisualizationPanelProps) {
  const activeLevelId = events[events.length - 1]?.levelId;
  const [revealedDataKeys, setRevealedDataKeys] = useState<Record<string, boolean>>({});

  function latestLevelEvent(levelId: CacheLevelState["id"]): SimEvent | undefined {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
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
          <div className="cache-level" data-active={activeLevelId === level.id ? "true" : "false"}>
            {level.sets.map((set, setIndex) => {
              const isActiveSet = levelEvent?.index === setIndex;

              return (
              <div
                key={`${level.id}-set-${setIndex}`}
                className="cache-set"
                data-set-index={String(setIndex)}
                data-active-set={isActiveSet ? "true" : "false"}
              >
                <h4>Set {setIndex}</h4>
                <ul>
                  {set.ways.map((way, wayIndex) => {
                    const key = `${level.id}-${setIndex}-${wayIndex}`;
                    const showData = Boolean(revealedDataKeys[key]);
                    const comparedWay = levelEvent?.comparedWays.find((entry) => entry.way === wayIndex);
                    const isVictimWay = isActiveSet && levelEvent?.victimWay === wayIndex;
                    const hasTagCue = isActiveSet && way.valid && levelEvent?.tag === way.tag;

                    return (
                    <li
                      key={`${level.id}-set-${setIndex}-way-${wayIndex}`}
                      data-way-index={String(wayIndex)}
                      data-victim-way={isVictimWay ? "true" : "false"}
                      data-tag-match={hasTagCue ? "true" : "false"}
                      data-compare-match={comparedWay?.match ? "true" : "false"}
                    >
                      W{wayIndex}: valid={String(way.valid)} dirty={String(way.dirty)} tag={way.tag}
                      {showData ? ` data=${way.data}` : ""}
                      <button
                        data-action="toggle-block-data"
                        type="button"
                        onClick={() => toggleData(level.id, setIndex, wayIndex)}
                      >
                        {showData ? "Hide data" : "Show data"}
                      </button>
                    </li>
                  );})}
                </ul>
              </div>
            );})}
          </div>
        </CollapsibleCard>
      );})}
    </div>
  );
}
