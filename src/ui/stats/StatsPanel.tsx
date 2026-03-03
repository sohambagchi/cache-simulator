import type { SimStats } from "../../engine/initialState";

type StatsPanelProps = {
  stats: SimStats;
  nextOpIndex: number;
  totalOps: number;
};

export function StatsPanel({ stats, nextOpIndex, totalOps }: StatsPanelProps) {
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
    </dl>
  );
}
