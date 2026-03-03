import type { SimStats } from "../../engine/initialState";
import type { CacheLevelId } from "../../domain/types";

type StatsPanelProps = {
  stats: SimStats;
  levels: CacheLevelId[];
  nextOpIndex: number;
  totalOps: number;
};

function hitRate(hits: number, misses: number): string {
  const total = hits + misses;
  if (total === 0) {
    return "0.0%";
  }

  return `${((hits / total) * 100).toFixed(1)}%`;
}

export function StatsPanel({ stats, levels, nextOpIndex, totalOps }: StatsPanelProps) {
  return (
    <dl className="stats-grid">
      <div>
        <dt>Progress</dt>
        <dd>
          {nextOpIndex}/{totalOps}
        </dd>
      </div>
      <div>
        <dt>Reads</dt>
        <dd>{stats.reads}</dd>
      </div>
      <div>
        <dt>Writes</dt>
        <dd>{stats.writes}</dd>
      </div>
      <div>
        <dt>Hits</dt>
        <dd>{stats.hits}</dd>
      </div>
      <div>
        <dt>Misses</dt>
        <dd>{stats.misses}</dd>
      </div>
      <div>
        <dt>Memory Writes</dt>
        <dd>{stats.memoryWrites}</dd>
      </div>
      {levels.map((levelId) => {
        const levelStats = stats.perLevel[levelId];

        return (
          <div key={`${levelId}-hits`}>
            <dt>{levelId} hits</dt>
            <dd>{levelStats.hits}</dd>
            <dt>{levelId} misses</dt>
            <dd>{levelStats.misses}</dd>
            <dt>{levelId} evictions</dt>
            <dd>{levelStats.evictions}</dd>
            <dt>{levelId} hit rate</dt>
            <dd>{hitRate(levelStats.hits, levelStats.misses)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
