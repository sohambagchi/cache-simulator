import { useState } from "react";
import type {
  CacheLevelConfig,
  InclusionPolicy,
  ValidationIssue
} from "../../domain/types";
import {
  GEOMETRY_SIZE_OPTIONS,
  TOTAL_SIZE_OPTIONS,
  BLOCK_SIZE_OPTIONS,
  ASSOCIATIVITY_OPTIONS,
  toSliderIndex,
  fromSliderIndex,
  formatBytesLabel,
  formatWaysLabel
} from "./sliderDomain";
import { getSoftLimitBounds } from "./softLimits";

type HierarchyBuilderPanelProps = {
  levels: CacheLevelConfig[];
  warnings: ValidationIssue[];
  errors?: ValidationIssue[];
  inclusionPolicy: InclusionPolicy;
  onUpdateInclusionPolicy: (policy: InclusionPolicy) => void;
  onUpdateLevel: (
    levelId: CacheLevelConfig["id"],
    patch: Partial<Omit<CacheLevelConfig, "id">>
  ) => void;
};

function getFieldErrors(
  errors: ValidationIssue[],
  levelId: string,
  field: "totalSizeBytes" | "blockSizeBytes" | "associativity"
): ValidationIssue[] {
  return errors.filter((error) => {
    if (error.levelId !== levelId) return false;
    if (error.code === "HIERARCHY_MONOTONICITY" && field === "totalSizeBytes")
      return true;
    if (error.code === "BLOCK_SIZE_MONOTONICITY" && field === "blockSizeBytes")
      return true;
    if (error.code === "GEOMETRY_INCONSISTENT") {
      if (field === "totalSizeBytes" && error.message.includes("numSets"))
        return true;
      if (
        field === "totalSizeBytes" &&
        error.message.includes("totalSizeBytes")
      )
        return true;
      if (
        field === "blockSizeBytes" &&
        error.message.includes("blockSizeBytes")
      )
        return true;
      if (field === "associativity" && error.message.includes("associativity"))
        return true;
    }
    return false;
  });
}

export function HierarchyBuilderPanel({
  levels,
  warnings,
  errors = [],
  inclusionPolicy,
  onUpdateInclusionPolicy,
  onUpdateLevel
}: HierarchyBuilderPanelProps) {
  const enabledCount = levels.filter((level) => level.enabled).length;
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>(
    () => Object.fromEntries(levels.map((l) => [l.id, l.enabled]))
  );

  function handleToggleEnabled(
    levelId: CacheLevelConfig["id"],
    enabled: boolean
  ) {
    if (!enabled) {
      setExpandedLevels((prev) => ({ ...prev, [levelId]: false }));
    } else {
      setExpandedLevels((prev) => ({ ...prev, [levelId]: true }));
    }
    onUpdateLevel(levelId, { enabled });
  }

  return (
    <div className="panel-stack">
      <div
        className="inclusion-policy-toggle"
        role="group"
        aria-label="Inclusion policy"
      >
        <button
          type="button"
          className={`btn btn--ghost${inclusionPolicy === "INCLUSIVE" ? " btn--active" : ""}`}
          aria-pressed={inclusionPolicy === "INCLUSIVE"}
          onClick={() => onUpdateInclusionPolicy("INCLUSIVE")}
        >
          Inclusive
        </button>
        <button
          type="button"
          className={`btn btn--ghost${inclusionPolicy === "EXCLUSIVE" ? " btn--active" : ""}`}
          aria-pressed={inclusionPolicy === "EXCLUSIVE"}
          onClick={() => onUpdateInclusionPolicy("EXCLUSIVE")}
        >
          Exclusive
        </button>
      </div>

      {warnings.length > 0 ? (
        <ul className="warning-list" aria-label="Policy warnings">
          {warnings.map((warning, index) => (
            <li key={`${warning.levelId}-${warning.code}-${index}`}>
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}

      {levels.map((level) => {
        const totalSizeErrors = getFieldErrors(
          errors,
          level.id,
          "totalSizeBytes"
        );
        const blockSizeErrors = getFieldErrors(
          errors,
          level.id,
          "blockSizeBytes"
        );
        const associativityErrors = getFieldErrors(
          errors,
          level.id,
          "associativity"
        );

        const totalSizeBounds = getSoftLimitBounds(
          levels,
          level.id,
          "totalSizeBytes"
        );
        const blockSizeBounds = getSoftLimitBounds(
          levels,
          level.id,
          "blockSizeBytes"
        );

        const totalSizeIndex = toSliderIndex(
          level.totalSizeBytes,
          TOTAL_SIZE_OPTIONS
        );
        const blockSizeIndex = toSliderIndex(
          level.blockSizeBytes,
          BLOCK_SIZE_OPTIONS
        );
        const associativityIndex = toSliderIndex(
          level.associativity,
          ASSOCIATIVITY_OPTIONS
        );

        let totalSizeSoftInvalid = false;
        let totalSizeInvalidEndPct = 0;
        if (totalSizeBounds.minExclusive !== null) {
          const minInvalidIndex = GEOMETRY_SIZE_OPTIONS.findIndex(
            (v) => v > totalSizeBounds.minExclusive!
          );
          const boundaryIndex =
            minInvalidIndex >= 0
              ? minInvalidIndex - 1
              : GEOMETRY_SIZE_OPTIONS.length - 1;
          if (totalSizeIndex <= boundaryIndex) {
            totalSizeSoftInvalid = true;
          }
          if (boundaryIndex >= 0) {
            totalSizeInvalidEndPct =
              (boundaryIndex / (GEOMETRY_SIZE_OPTIONS.length - 1)) * 100;
          }
        }

        let blockSizeSoftInvalid = false;
        let blockSizeInvalidEndPct = 0;
        if (blockSizeBounds.minInclusive !== null) {
          const boundaryIndex =
            BLOCK_SIZE_OPTIONS.findIndex(
              (v) => v >= blockSizeBounds.minInclusive!
            ) - 1;
          if (boundaryIndex >= 0 && blockSizeIndex < boundaryIndex) {
            blockSizeSoftInvalid = true;
          }
          if (boundaryIndex >= 0) {
            blockSizeInvalidEndPct =
              (boundaryIndex / (BLOCK_SIZE_OPTIONS.length - 1)) * 100;
          }
        }

        const isExpanded = level.enabled && (expandedLevels[level.id] ?? false);

        return (
          <div key={level.id} className="cache-level-card">
            <div className="cache-level-header">
              {level.enabled ? (
                <button
                  type="button"
                  className="btn btn--ghost cache-level-header__toggle"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${level.id}`}
                  onClick={() =>
                    setExpandedLevels((prev) => ({
                      ...prev,
                      [level.id]: !prev[level.id]
                    }))
                  }
                >
                  {isExpanded ? "\u25BC" : "\u25B6"}
                </button>
              ) : (
                <span className="cache-level-header__toggle-placeholder" />
              )}
              <label className="cache-level-header__enable">
                <input
                  type="checkbox"
                  checked={level.enabled}
                  disabled={level.enabled && enabledCount === 1}
                  onChange={(event) =>
                    handleToggleEnabled(level.id, event.currentTarget.checked)
                  }
                />
              </label>
              <span className="cache-level-header__id">{level.id}</span>
              {level.enabled && (
                <>
                  <span className="cache-level-header__policies">
                    {level.replacementPolicy} · {level.writeHitPolicy} ·{" "}
                    {level.writeMissPolicy}
                  </span>
                  <span className="cache-level-header__size">
                    {formatBytesLabel(level.totalSizeBytes)}
                  </span>
                </>
              )}
            </div>

            {isExpanded && (
              <div className="cache-level-body">
                <div className="slider-field">
                  <label>
                    <span>
                      Total size: {formatBytesLabel(level.totalSizeBytes)}
                    </span>
                    <input
                      aria-label={`${level.id} total size bytes`}
                      aria-invalid={totalSizeErrors.length > 0}
                      type="range"
                      min={0}
                      max={TOTAL_SIZE_OPTIONS.length - 1}
                      value={totalSizeIndex}
                      data-soft-invalid={
                        totalSizeSoftInvalid ? "true" : "false"
                      }
                      style={
                        {
                          "--invalid-end-pct": `${totalSizeInvalidEndPct}%`
                        } as React.CSSProperties
                      }
                      onChange={(event) =>
                        onUpdateLevel(level.id, {
                          totalSizeBytes: fromSliderIndex(
                            Number(event.currentTarget.value),
                            TOTAL_SIZE_OPTIONS
                          )
                        })
                      }
                    />
                  </label>
                  {totalSizeErrors.map((error, i) => (
                    <p key={i} className="field-error" role="alert">
                      {error.message}
                    </p>
                  ))}
                </div>

                <div className="slider-field">
                  <label>
                    <span>
                      Block size: {formatBytesLabel(level.blockSizeBytes)}
                    </span>
                    <input
                      aria-label={`${level.id} block size bytes`}
                      aria-invalid={blockSizeErrors.length > 0}
                      type="range"
                      min={0}
                      max={BLOCK_SIZE_OPTIONS.length - 1}
                      value={blockSizeIndex}
                      data-soft-invalid={
                        blockSizeSoftInvalid ? "true" : "false"
                      }
                      style={
                        {
                          "--invalid-end-pct": `${blockSizeInvalidEndPct}%`
                        } as React.CSSProperties
                      }
                      onChange={(event) =>
                        onUpdateLevel(level.id, {
                          blockSizeBytes: fromSliderIndex(
                            Number(event.currentTarget.value),
                            BLOCK_SIZE_OPTIONS
                          )
                        })
                      }
                    />
                  </label>
                  {blockSizeErrors.map((error, i) => (
                    <p key={i} className="field-error" role="alert">
                      {error.message}
                    </p>
                  ))}
                </div>

                <div className="slider-field">
                  <label>
                    <span>
                      Associativity: {formatWaysLabel(level.associativity)}
                    </span>
                    <input
                      aria-label={`${level.id} associativity`}
                      aria-invalid={associativityErrors.length > 0}
                      type="range"
                      min={0}
                      max={ASSOCIATIVITY_OPTIONS.length - 1}
                      value={associativityIndex}
                      onChange={(event) =>
                        onUpdateLevel(level.id, {
                          associativity: fromSliderIndex(
                            Number(event.currentTarget.value),
                            ASSOCIATIVITY_OPTIONS
                          )
                        })
                      }
                    />
                  </label>
                  {associativityErrors.map((error, i) => (
                    <p key={i} className="field-error" role="alert">
                      {error.message}
                    </p>
                  ))}
                </div>

                <label>
                  <span>Replacement policy</span>
                  <select
                    aria-label={`${level.id} replacement policy`}
                    value={level.replacementPolicy}
                    onChange={(event) =>
                      onUpdateLevel(level.id, {
                        replacementPolicy: event.currentTarget
                          .value as CacheLevelConfig["replacementPolicy"]
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
                        writeHitPolicy: event.currentTarget
                          .value as CacheLevelConfig["writeHitPolicy"]
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
                        writeMissPolicy: event.currentTarget
                          .value as CacheLevelConfig["writeMissPolicy"]
                      })
                    }
                  >
                    <option value="WRITE_ALLOCATE">WRITE_ALLOCATE</option>
                    <option value="WRITE_NO_ALLOCATE">WRITE_NO_ALLOCATE</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
