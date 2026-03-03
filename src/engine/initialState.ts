import { V1_LIMITS } from "../domain/constants";
import { deriveGeometry, type CacheGeometry } from "../domain/geometry";
import type { CacheLevelConfig, CacheLevelId } from "../domain/types";

export type PerLevelStats = Record<CacheLevelId, { hits: number; misses: number; evictions: number }>;

export type ComparedWay = {
  way: number;
  valid: boolean;
  tag: number;
  match: boolean;
};

export type SimEventStage =
  | "decode"
  | "compare"
  | "hit"
  | "miss"
  | "fill"
  | "eviction"
  | "writeback"
  | "memory";

export type SimEvent = {
  operationId: number;
  stage: SimEventStage;
  levelId: CacheLevelId | "MEMORY";
  opKind: "R" | "W";
  address: number;
  tag: number;
  index: number;
  offset: number;
  comparedWays: ComparedWay[];
  victimWay?: number;
  dirtyEvictionTarget?: CacheLevelId | "MEMORY";
};

export type CacheLineState = {
  valid: boolean;
  tag: number;
  dataBytes: number[];
  dirty: boolean;
  lastUsedAt: number;
  insertedAt: number;
};

export type CacheSetState = {
  ways: CacheLineState[];
};

export type CacheLevelState = {
  id: CacheLevelId;
  config: CacheLevelConfig;
  geometry: CacheGeometry;
  sets: CacheSetState[];
};

export type SimStats = {
  reads: number;
  writes: number;
  hits: number;
  misses: number;
  evictions: number;
  writeBacks: number;
  memoryReads: number;
  memoryWrites: number;
  perLevel: PerLevelStats;
};

function createPerLevelStats(): PerLevelStats {
  return {
    L1: { hits: 0, misses: 0, evictions: 0 },
    L2: { hits: 0, misses: 0, evictions: 0 },
    L3: { hits: 0, misses: 0, evictions: 0 },
  };
}

export type SimState = {
  levels: CacheLevelState[];
  memory: number[];
  clock: number;
  diagnostics: string[];
  events: SimEvent[];
  stats: SimStats;
};

export type SimStepResult = {
  state: SimState;
  events: SimEvent[];
  diagnostic?: string;
};

function createEmptyLine(blockSizeBytes: number): CacheLineState {
  return {
    valid: false,
    tag: 0,
    dataBytes: Array.from({ length: blockSizeBytes }, () => 0),
    dirty: false,
    lastUsedAt: 0,
    insertedAt: 0,
  };
}

function createStats(): SimStats {
  return {
    reads: 0,
    writes: 0,
    hits: 0,
    misses: 0,
    evictions: 0,
    writeBacks: 0,
    memoryReads: 0,
    memoryWrites: 0,
    perLevel: createPerLevelStats(),
  };
}

export function createInitialState(levelConfigs: CacheLevelConfig[]): SimState {
  const enabledLevels = levelConfigs.filter((levelConfig) => levelConfig.enabled);
  const levels = enabledLevels.map((levelConfig) => {
    const geometry = deriveGeometry(
      levelConfig.totalSizeBytes,
      levelConfig.blockSizeBytes,
      levelConfig.associativity,
    );

    return {
      id: levelConfig.id,
      config: levelConfig,
      geometry,
      sets: Array.from({ length: geometry.numSets }, () => ({
        ways: Array.from({ length: levelConfig.associativity }, () => createEmptyLine(levelConfig.blockSizeBytes)),
      })),
    };
  });

  return {
    levels,
    memory: Array.from({ length: V1_LIMITS.memoryWords }, () => 0),
    clock: 0,
    diagnostics: [],
    events: [],
    stats: createStats(),
  };
}
