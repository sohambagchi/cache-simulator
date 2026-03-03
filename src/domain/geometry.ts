type CacheGeometry = {
  numSets: number;
  offsetBits: number;
  indexBits: number;
};

export function deriveGeometry(
  totalSizeBytes: number,
  blockSizeBytes: number,
  associativity: number,
): CacheGeometry {
  if (blockSizeBytes <= 0 || associativity <= 0) {
    throw new Error("blockSizeBytes and associativity must be greater than zero");
  }

  const numSets = totalSizeBytes / (blockSizeBytes * associativity);

  return {
    numSets,
    offsetBits: Math.log2(blockSizeBytes),
    indexBits: Math.log2(numSets),
  };
}
