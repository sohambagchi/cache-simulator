import type { CacheLevelId } from "../domain/types";
import type { SimState } from "./initialState";

export function dirtyEvictionTarget(
  state: SimState,
  currentLevelIndex: number,
): CacheLevelId | "MEMORY" {
  const nextLevel = state.levels[currentLevelIndex + 1];

  if (!nextLevel) {
    return "MEMORY";
  }

  return nextLevel.id;
}
