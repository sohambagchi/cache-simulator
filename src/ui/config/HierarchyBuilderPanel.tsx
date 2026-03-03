import type { CacheLevelConfig, ValidationIssue } from "../../domain/types";

type HierarchyBuilderPanelProps = {
  levels: CacheLevelConfig[];
  warnings: ValidationIssue[];
  onUpdateLevel: (levelId: CacheLevelConfig["id"], patch: Partial<Omit<CacheLevelConfig, "id">>) => void;
};

export function HierarchyBuilderPanel({ levels, warnings, onUpdateLevel }: HierarchyBuilderPanelProps) {
  return (
    <div className="panel-stack">
      {warnings.length > 0 ? (
        <ul className="warning-list" aria-label="Policy warnings">
          {warnings.map((warning, index) => (
            <li key={`${warning.levelId}-${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      {levels.map((level) => (
        <fieldset key={level.id} className="panel-fieldset">
          <legend>{level.id}</legend>
          <label>
            <span>Enabled</span>
            <input
              type="checkbox"
              checked={level.enabled}
              onChange={(event) => onUpdateLevel(level.id, { enabled: event.currentTarget.checked })}
            />
          </label>
          <label>
            <span>Total size (bytes)</span>
            <input
              type="number"
              value={level.totalSizeBytes}
              onChange={(event) => onUpdateLevel(level.id, { totalSizeBytes: Number(event.currentTarget.value) })}
            />
          </label>
          <label>
            <span>Block size (bytes)</span>
            <input
              type="number"
              value={level.blockSizeBytes}
              onChange={(event) => onUpdateLevel(level.id, { blockSizeBytes: Number(event.currentTarget.value) })}
            />
          </label>
          <label>
            <span>Associativity</span>
            <input
              type="number"
              value={level.associativity}
              onChange={(event) => onUpdateLevel(level.id, { associativity: Number(event.currentTarget.value) })}
            />
          </label>
          <label>
            <span>Replacement policy</span>
            <select
              aria-label={`${level.id} replacement policy`}
              value={level.replacementPolicy}
              onChange={(event) =>
                onUpdateLevel(level.id, {
                  replacementPolicy: event.currentTarget.value as CacheLevelConfig["replacementPolicy"],
                })
              }
            >
              <option value="LRU">LRU</option>
              <option value="FIFO">FIFO</option>
            </select>
          </label>
          <label>
            <span>Write hit policy</span>
            <select
              aria-label={`${level.id} write hit policy`}
              value={level.writeHitPolicy}
              onChange={(event) =>
                onUpdateLevel(level.id, {
                  writeHitPolicy: event.currentTarget.value as CacheLevelConfig["writeHitPolicy"],
                })
              }
            >
              <option value="WRITE_BACK">WRITE_BACK</option>
              <option value="WRITE_THROUGH">WRITE_THROUGH</option>
            </select>
          </label>
          <label>
            <span>Write miss policy</span>
            <select
              aria-label={`${level.id} write miss policy`}
              value={level.writeMissPolicy}
              onChange={(event) =>
                onUpdateLevel(level.id, {
                  writeMissPolicy: event.currentTarget.value as CacheLevelConfig["writeMissPolicy"],
                })
              }
            >
              <option value="WRITE_ALLOCATE">WRITE_ALLOCATE</option>
              <option value="WRITE_NO_ALLOCATE">WRITE_NO_ALLOCATE</option>
            </select>
          </label>
        </fieldset>
      ))}
    </div>
  );
}
