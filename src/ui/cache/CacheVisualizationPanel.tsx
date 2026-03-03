import type { CacheLevelState, SimEvent } from "../../engine/initialState";
import { CollapsibleCard } from "../common/CollapsibleCard";

type CacheVisualizationPanelProps = {
  levels: CacheLevelState[];
  events: SimEvent[];
};

export function CacheVisualizationPanel({ levels, events }: CacheVisualizationPanelProps) {
  const activeLevelId = events[events.length - 1]?.levelId;

  return (
    <div className="panel-stack">
      {levels.map((level) => (
        <CollapsibleCard key={level.id} title={`${level.id} cache`} defaultExpanded={true} sectionId={`cache-${level.id}`}>
          <div className="cache-level" data-active={activeLevelId === level.id ? "true" : "false"}>
            {level.sets.slice(0, 4).map((set, setIndex) => (
              <div key={`${level.id}-set-${setIndex}`} className="cache-set">
                <h4>Set {setIndex}</h4>
                <ul>
                  {set.ways.map((way, wayIndex) => (
                    <li key={`${level.id}-set-${setIndex}-way-${wayIndex}`}>
                      W{wayIndex}: valid={String(way.valid)} dirty={String(way.dirty)} tag={way.tag} data={way.data}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      ))}
    </div>
  );
}
