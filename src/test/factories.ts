import type { CacheLevelConfig } from "../domain/types";

export function createCacheLevelConfig(
  overrides: Partial<CacheLevelConfig> = {},
): CacheLevelConfig {
  return {
    id: "L1",
    enabled: true,
    totalSizeBytes: 256,
    blockSizeBytes: 16,
    associativity: 2,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE",
    ...overrides,
  };
}
