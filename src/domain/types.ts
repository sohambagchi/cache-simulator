export type CacheLevelId = "L1" | "L2" | "L3";

export type ReplacementPolicy = "LRU" | "FIFO";

export type WriteHitPolicy = "WRITE_THROUGH" | "WRITE_BACK";

export type WriteMissPolicy = "WRITE_ALLOCATE" | "WRITE_NO_ALLOCATE";

export type CacheLevelConfig = {
  id: CacheLevelId;
  enabled: boolean;
  totalSizeBytes: number;
  blockSizeBytes: number;
  associativity: number;
  replacementPolicy: ReplacementPolicy;
  writeHitPolicy: WriteHitPolicy;
  writeMissPolicy: WriteMissPolicy;
};

export type ValidationIssueCode =
  | "GEOMETRY_INCONSISTENT"
  | "HIERARCHY_MONOTONICITY"
  | "BLOCK_SIZE_MONOTONICITY"
  | "NON_STANDARD_POLICY";

export type ValidationIssue = {
  code: ValidationIssueCode;
  levelId: CacheLevelId;
  message: string;
};
