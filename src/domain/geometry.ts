export type CacheGeometry = {
  numSets: number;
  offsetBits: number;
  indexBits: number;
};

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isPowerOfTwo(value: number): boolean {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return false;
  }

  const safeIntegerValue = BigInt(value);

  return (safeIntegerValue & (safeIntegerValue - 1n)) === 0n;
}

export function deriveGeometry(
  totalSizeBytes: number,
  blockSizeBytes: number,
  associativity: number,
): CacheGeometry {
  if (!isPositiveInteger(totalSizeBytes)) {
    throw new Error("totalSizeBytes must be a positive integer");
  }

  if (!isPositiveInteger(blockSizeBytes)) {
    throw new Error("blockSizeBytes must be a positive integer");
  }

  if (!isPositiveInteger(associativity)) {
    throw new Error("associativity must be a positive integer");
  }

  if (!isPowerOfTwo(blockSizeBytes)) {
    throw new Error("blockSizeBytes must be a power of two");
  }

  if (totalSizeBytes % blockSizeBytes !== 0) {
    throw new Error("totalSizeBytes must be divisible by blockSizeBytes");
  }

  const numSets = totalSizeBytes / (blockSizeBytes * associativity);

  if (!isPositiveInteger(numSets)) {
    throw new Error("derived numSets must be a positive integer");
  }

  if (!isPowerOfTwo(numSets)) {
    throw new Error("derived numSets must be a power of two");
  }

  return {
    numSets,
    offsetBits: Math.log2(blockSizeBytes),
    indexBits: Math.log2(numSets),
  };
}
