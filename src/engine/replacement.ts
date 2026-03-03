import type { ReplacementPolicy } from "../domain/types";

export type ReplacementCandidate = {
  way: number;
  valid: boolean;
  lastUsedAt: number;
  insertedAt: number;
};

export function chooseVictimWay(
  candidates: ReplacementCandidate[],
  replacementPolicy: ReplacementPolicy,
): number {
  const firstInvalid = candidates.find((candidate) => !candidate.valid);
  if (firstInvalid) {
    return firstInvalid.way;
  }

  const sorted = [...candidates].sort((left, right) => {
    if (replacementPolicy === "LRU") {
      if (left.lastUsedAt !== right.lastUsedAt) {
        return left.lastUsedAt - right.lastUsedAt;
      }

      return left.way - right.way;
    }

    if (left.insertedAt !== right.insertedAt) {
      return left.insertedAt - right.insertedAt;
    }

    return left.way - right.way;
  });

  return sorted[0].way;
}
