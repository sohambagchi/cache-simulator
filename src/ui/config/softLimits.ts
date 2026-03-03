import type { CacheLevelConfig, CacheLevelId } from "../../domain/types";

type GeometryField = "totalSizeBytes" | "blockSizeBytes";

export function getSoftLimitBounds(
  levels: CacheLevelConfig[],
  levelId: CacheLevelId,
  field: GeometryField
) {
  const enabled = levels.filter((level) => level.enabled);
  const index = enabled.findIndex((level) => level.id === levelId);
  const previous = index > 0 ? enabled[index - 1] : null;

  if (field === "totalSizeBytes") {
    return { minExclusive: previous?.totalSizeBytes ?? null };
  }

  return { minInclusive: previous?.blockSizeBytes ?? null };
}
