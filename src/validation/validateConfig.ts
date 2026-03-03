import type { CacheLevelConfig, ValidationIssue } from "../domain/types";

type ValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

const LEVEL_ORDER: Record<CacheLevelConfig["id"], number> = {
  L1: 0,
  L2: 1,
  L3: 2,
};

function isPositivePowerOfTwo(value: number): boolean {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return false;
  }

  const integer = BigInt(value);

  return (integer & (integer - 1n)) === 0n;
}

function createIssue(
  levelId: CacheLevelConfig["id"],
  code: ValidationIssue["code"],
  message: string,
): ValidationIssue {
  return { levelId, code, message };
}

function geometryIssuesForLevel(level: CacheLevelConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const hasValidBlockSize = isPositivePowerOfTwo(level.blockSizeBytes);
  const hasValidAssociativity = isPositivePowerOfTwo(level.associativity);

  if (!hasValidBlockSize) {
    issues.push(
      createIssue(
        level.id,
        "GEOMETRY_INCONSISTENT",
        `${level.id}: blockSizeBytes must be a positive power of two`,
      ),
    );
  }

  if (!hasValidAssociativity) {
    issues.push(
      createIssue(
        level.id,
        "GEOMETRY_INCONSISTENT",
        `${level.id}: associativity must be a positive power of two`,
      ),
    );
  }

  if (!hasValidBlockSize || !hasValidAssociativity) {
    return issues;
  }

  const denominator = level.associativity * level.blockSizeBytes;
  const numSets = level.totalSizeBytes / denominator;

  if (!isPositivePowerOfTwo(numSets)) {
    issues.push(
      createIssue(
        level.id,
        "GEOMETRY_INCONSISTENT",
        `${level.id}: derived numSets must be a positive power of two`,
      ),
    );
  }

  const isIntegerNumSets = Number.isInteger(numSets);
  const isConsistentEquation = isIntegerNumSets
    ? level.totalSizeBytes === numSets * level.associativity * level.blockSizeBytes
    : false;

  if (!isIntegerNumSets || !isConsistentEquation) {
    issues.push(
      createIssue(
        level.id,
        "GEOMETRY_INCONSISTENT",
        `${level.id}: totalSizeBytes must equal numSets * associativity * blockSizeBytes with integer numSets`,
      ),
    );
  }

  return issues;
}

function hasNonStandardWritePolicy(level: CacheLevelConfig): boolean {
  const isWriteBackNoAllocate =
    level.writeHitPolicy === "WRITE_BACK" && level.writeMissPolicy === "WRITE_NO_ALLOCATE";
  const isWriteThroughAllocate =
    level.writeHitPolicy === "WRITE_THROUGH" && level.writeMissPolicy === "WRITE_ALLOCATE";

  return isWriteBackNoAllocate || isWriteThroughAllocate;
}

export function validateConfig(levels: CacheLevelConfig[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const enabledLevels = levels
    .filter((level) => level.enabled)
    .sort((left, right) => LEVEL_ORDER[left.id] - LEVEL_ORDER[right.id]);

  let previousEnabledLevel: CacheLevelConfig | null = null;

  for (const level of enabledLevels) {

    errors.push(...geometryIssuesForLevel(level));

    if (previousEnabledLevel !== null) {
      if (level.totalSizeBytes <= previousEnabledLevel.totalSizeBytes) {
        errors.push(
          createIssue(
            level.id,
            "HIERARCHY_MONOTONICITY",
            `${level.id}: totalSizeBytes must be greater than ${previousEnabledLevel.id}`,
          ),
        );
      }

      if (level.blockSizeBytes < previousEnabledLevel.blockSizeBytes) {
        errors.push(
          createIssue(
            level.id,
            "BLOCK_SIZE_MONOTONICITY",
            `${level.id}: blockSizeBytes must be greater than or equal to ${previousEnabledLevel.id}.blockSizeBytes`,
          ),
        );
      }
    }

    if (hasNonStandardWritePolicy(level)) {
      warnings.push(
        createIssue(
          level.id,
          "NON_STANDARD_POLICY",
          `${level.id}: non-standard write policy combination`,
        ),
      );
    }

    previousEnabledLevel = level;
  }

  return { errors, warnings };
}
