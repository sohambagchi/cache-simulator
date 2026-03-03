import type { CacheLevelConfig, ValidationIssue } from "../../domain/types";

type HierarchyBuilderPanelProps = {
  levels: CacheLevelConfig[];
  warnings: ValidationIssue[];
  onUpdateLevel: (levelId: CacheLevelConfig["id"], patch: Partial<Omit<CacheLevelConfig, "id">>) => void;
};

function nearestPowerOfTwo(value: number): number {
  if (!Number.isFinite(value) || value <= 1) {
    return 1;
  }

  let upperBound = 1;
  while (upperBound < value && upperBound < Number.MAX_SAFE_INTEGER / 2) {
    upperBound *= 2;
  }

  const lowerBound = Math.max(1, upperBound / 2);
  return value - lowerBound < upperBound - value ? lowerBound : upperBound;
}

function positiveIntegerOrFallback(value: number, fallback: number): number {
  const rounded = Math.round(value);
  return Number.isSafeInteger(rounded) && rounded > 0 ? rounded : fallback;
}

function normalizeGeometryPatch(
  level: CacheLevelConfig,
  patch: Pick<Partial<CacheLevelConfig>, "totalSizeBytes" | "blockSizeBytes" | "associativity">,
): Pick<CacheLevelConfig, "totalSizeBytes" | "blockSizeBytes" | "associativity"> {
  const currentBlockSize = nearestPowerOfTwo(positiveIntegerOrFallback(level.blockSizeBytes, 1));
  const currentAssociativity = nearestPowerOfTwo(positiveIntegerOrFallback(level.associativity, 1));

  const nextBlockSize =
    patch.blockSizeBytes === undefined
      ? currentBlockSize
      : nearestPowerOfTwo(positiveIntegerOrFallback(patch.blockSizeBytes, currentBlockSize));
  const nextAssociativity =
    patch.associativity === undefined
      ? currentAssociativity
      : nearestPowerOfTwo(positiveIntegerOrFallback(patch.associativity, currentAssociativity));

  const rawTotalSize =
    patch.totalSizeBytes === undefined
      ? positiveIntegerOrFallback(level.totalSizeBytes, nextBlockSize * nextAssociativity)
      : positiveIntegerOrFallback(patch.totalSizeBytes, level.totalSizeBytes);
  const geometryUnit = nextBlockSize * nextAssociativity;
  const targetSetCount = nearestPowerOfTwo(rawTotalSize / geometryUnit);

  return {
    blockSizeBytes: nextBlockSize,
    associativity: nextAssociativity,
    totalSizeBytes: geometryUnit * targetSetCount,
  };
}

export function HierarchyBuilderPanel({ levels, warnings, onUpdateLevel }: HierarchyBuilderPanelProps) {
  const enabledCount = levels.filter((level) => level.enabled).length;

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
              disabled={level.enabled && enabledCount === 1}
              onChange={(event) => onUpdateLevel(level.id, { enabled: event.currentTarget.checked })}
            />
          </label>
          <label>
            <span>Total size (bytes)</span>
            <input
              aria-label={`${level.id} total size bytes`}
              type="number"
              value={level.totalSizeBytes}
              onChange={(event) =>
                onUpdateLevel(level.id, normalizeGeometryPatch(level, { totalSizeBytes: Number(event.currentTarget.value) }))
              }
            />
          </label>
          <label>
            <span>Block size (bytes)</span>
            <input
              aria-label={`${level.id} block size bytes`}
              type="number"
              value={level.blockSizeBytes}
              onChange={(event) =>
                onUpdateLevel(level.id, normalizeGeometryPatch(level, { blockSizeBytes: Number(event.currentTarget.value) }))
              }
            />
          </label>
          <label>
            <span>Associativity</span>
            <input
              aria-label={`${level.id} associativity`}
              type="number"
              value={level.associativity}
              onChange={(event) =>
                onUpdateLevel(level.id, normalizeGeometryPatch(level, { associativity: Number(event.currentTarget.value) }))
              }
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
