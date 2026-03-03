import type { SimStats } from "../../engine/initialState";
import type { CacheLevelId } from "../../domain/types";

type StatsPanelProps = {
  stats: SimStats;
  levels: CacheLevelId[];
};

function hitRate(hits: number, misses: number): string {
  const total = hits + misses;
  if (total === 0) {
    return "0.0%";
  }

  return `${((hits / total) * 100).toFixed(1)}%`;
}

export function StatsPanel({ stats, levels }: StatsPanelProps) {
  return (
    <div className="stats-panel">
      {/* Loud global trio */}
      <div className="stats-panel__global-trio">
        <div className="stats-trio-card stats-trio-card--hits">
          <dt>Hits</dt>
          <dd>{stats.hits}</dd>
        </div>
        <div className="stats-trio-card stats-trio-card--misses">
          <dt>Misses</dt>
          <dd>{stats.misses}</dd>
        </div>
        <div className="stats-trio-card stats-trio-card--rate">
          <dt>Hit Rate</dt>
          <dd>{hitRate(stats.hits, stats.misses)}</dd>
        </div>
      </div>

      {/* Secondary row */}
      <dl className="stats-panel__secondary">
        <div>
          <dt>Reads</dt>
          <dd>{stats.reads}</dd>
        </div>
        <div>
          <dt>Writes</dt>
          <dd>{stats.writes}</dd>
        </div>
        <div>
          <dt>Evictions</dt>
          <dd>{stats.evictions}</dd>
        </div>
        <div>
          <dt>Mem Reads</dt>
          <dd>{stats.memoryReads}</dd>
        </div>
        <div>
          <dt>Mem Writes</dt>
          <dd>{stats.memoryWrites}</dd>
        </div>
      </dl>

      {/* Per-level cards */}
      {levels.length > 0 && (
        <div className="stats-panel__levels">
          {levels.map((levelId) => {
            const ls = stats.perLevel[levelId];
            return (
              <dl key={levelId} className="stats-level-card">
                <h4 className="stats-level-card__title">{levelId}</h4>
                <div>
                  <dt>Hits</dt>
                  <dd>{ls.hits}</dd>
                </div>
                <div>
                  <dt>Misses</dt>
                  <dd>{ls.misses}</dd>
                </div>
                <div>
                  <dt>Evictions</dt>
                  <dd>{ls.evictions}</dd>
                </div>
                <div>
                  <dt>Hit Rate</dt>
                  <dd>{hitRate(ls.hits, ls.misses)}</dd>
                </div>
              </dl>
            );
          })}
        </div>
      )}
    </div>
  );
}
