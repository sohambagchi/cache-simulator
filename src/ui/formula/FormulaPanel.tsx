import type { CacheLevelConfig } from "../../domain/types";
import { deriveGeometry } from "../../domain/geometry";

type FormulaPanelProps = {
  levels: CacheLevelConfig[];
};

function tryDeriveGeometry(level: CacheLevelConfig) {
  try {
    return deriveGeometry(
      level.totalSizeBytes,
      level.blockSizeBytes,
      level.associativity
    );
  } catch {
    return null;
  }
}

export function FormulaPanel({ levels }: FormulaPanelProps) {
  const enabledLevels = levels.filter((l) => l.enabled);
  const totalBits = 16; // simulator uses 16-bit addresses

  return (
    <div className="formula-panel" aria-label="Address decomposition formula">
      <div className="formula-panel__title">
        Address bits [{totalBits - 1}…0]
      </div>
      <div className="formula-panel__levels">
        {enabledLevels.map((level) => {
          const geo = tryDeriveGeometry(level);
          if (!geo) return null;
          const tagBits = totalBits - geo.indexBits - geo.offsetBits;
          const tagHi = totalBits - 1;
          const tagLo = geo.indexBits + geo.offsetBits;
          const idxHi = geo.offsetBits + geo.indexBits - 1;
          const idxLo = geo.offsetBits;
          const offHi = geo.offsetBits - 1;

          return (
            <div key={level.id} className="formula-panel__level">
              <span className="formula-panel__level-id">{level.id}</span>
              <div className="formula-panel__segments">
                <span className="formula-panel__seg formula-panel__seg--tag">
                  <span className="formula-panel__seg-label">Tag</span>
                  <span className="formula-panel__seg-range">
                    [{tagHi}…{tagLo}]
                  </span>
                  <span className="formula-panel__seg-bits">{tagBits}b</span>
                </span>
                {geo.indexBits > 0 && (
                  <span className="formula-panel__seg formula-panel__seg--index">
                    <span className="formula-panel__seg-label">Index</span>
                    <span className="formula-panel__seg-range">
                      [{idxHi}…{idxLo}]
                    </span>
                    <span className="formula-panel__seg-bits">
                      {geo.indexBits}b
                    </span>
                  </span>
                )}
                <span className="formula-panel__seg formula-panel__seg--offset">
                  <span className="formula-panel__seg-label">Offset</span>
                  <span className="formula-panel__seg-range">[{offHi}…0]</span>
                  <span className="formula-panel__seg-bits">
                    {geo.offsetBits}b
                  </span>
                </span>
              </div>
              <span className="formula-panel__sets">
                {geo.numSets} set{geo.numSets !== 1 ? "s" : ""} ×{" "}
                {level.associativity}-way
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
