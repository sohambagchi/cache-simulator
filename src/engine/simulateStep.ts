import { V1_LIMITS } from "../domain/constants";
import type { WorkloadOp } from "../parser/parseWorkload";
import { decodeAddress, encodeAddress } from "./addressing";
import { dirtyEvictionTarget } from "./cascade";
import type {
  CacheLineState,
  ComparedWay,
  SimEvent,
  SimState,
  SimStepResult
} from "./initialState";
import { chooseVictimWay } from "./replacement";

type MutableStep = {
  nextState: SimState;
  events: SimEvent[];
  tick: number;
};

type BlockTransfer = {
  baseAddress: number;
  dataBytes: number[];
};

function cloneState(state: SimState): SimState {
  return {
    ...state,
    levels: state.levels.map((level) => ({
      ...level,
      sets: level.sets.map((set) => ({
        ways: set.ways.map((way) => ({ ...way, dataBytes: [...way.dataBytes] }))
      }))
    })),
    memory: [...state.memory],
    diagnostics: [...state.diagnostics],
    events: [],
    stats: {
      ...state.stats,
      perLevel: {
        L1: { ...state.stats.perLevel.L1 },
        L2: { ...state.stats.perLevel.L2 },
        L3: { ...state.stats.perLevel.L3 }
      }
    }
  };
}

function runtimeDiagnostic(op: WorkloadOp): string | null {
  if (op.address < V1_LIMITS.minAddress || op.address > V1_LIMITS.maxAddress) {
    return `Runtime: address out of range (expected ${V1_LIMITS.minAddress}..${V1_LIMITS.maxAddress})`;
  }

  if (
    op.kind === "W" &&
    (op.value < V1_LIMITS.minValue || op.value > V1_LIMITS.maxValue)
  ) {
    return `Runtime: value out of range (expected ${V1_LIMITS.minValue}..${V1_LIMITS.maxValue})`;
  }

  return null;
}

function appendEvent(
  mutable: MutableStep,
  event: Omit<SimEvent, "operationId" | "comparedWays"> & {
    comparedWays?: ComparedWay[];
  }
): void {
  mutable.events.push({
    operationId: mutable.tick,
    ...event,
    comparedWays: event.comparedWays ?? []
  });
}

function buildComparedWays(ways: CacheLineState[], tag: number): ComparedWay[] {
  return ways.map((way, wayIndex) => ({
    way: wayIndex,
    valid: way.valid,
    tag: way.tag,
    match: way.valid && way.tag === tag
  }));
}

function blockBaseAddress(address: number, offset: number): number {
  return address - offset;
}

function readBlockFromMemory(
  memory: number[],
  baseAddress: number,
  blockSizeBytes: number
): number[] {
  return Array.from(
    { length: blockSizeBytes },
    (_, offset) => memory[baseAddress + offset] ?? 0
  );
}

function mergeBlockTransfer(
  targetBytes: number[],
  targetBaseAddress: number,
  transfer: BlockTransfer | undefined
): number[] {
  if (!transfer) {
    return [...targetBytes];
  }

  const merged = [...targetBytes];
  for (let offset = 0; offset < merged.length; offset += 1) {
    const absoluteAddress = targetBaseAddress + offset;
    const transferOffset = absoluteAddress - transfer.baseAddress;
    if (transferOffset >= 0 && transferOffset < transfer.dataBytes.length) {
      merged[offset] = transfer.dataBytes[transferOffset];
    }
  }

  return merged;
}

function withOffsetWrite(
  dataBytes: number[],
  offset: number,
  writeValue: number | undefined
): number[] {
  if (writeValue === undefined) {
    return dataBytes;
  }

  const nextBytes = [...dataBytes];
  nextBytes[offset] = writeValue;
  return nextBytes;
}

function readBlockFromLevelLine(
  line: CacheLineState,
  sourceBaseAddress: number,
  targetBaseAddress: number,
  targetBlockSizeBytes: number,
  memory: number[]
): number[] {
  const fallback = readBlockFromMemory(
    memory,
    targetBaseAddress,
    targetBlockSizeBytes
  );

  for (let offset = 0; offset < targetBlockSizeBytes; offset += 1) {
    const absoluteAddress = targetBaseAddress + offset;
    const sourceOffset = absoluteAddress - sourceBaseAddress;
    if (sourceOffset >= 0 && sourceOffset < line.dataBytes.length) {
      fallback[offset] = line.dataBytes[sourceOffset];
    }
  }

  return fallback;
}

function readBlockFromHierarchy(
  state: SimState,
  startLevelIndex: number,
  address: number,
  targetBlockSizeBytes: number
): BlockTransfer {
  const targetBaseAddress = blockBaseAddress(
    address,
    address % targetBlockSizeBytes
  );

  for (
    let levelIndex = startLevelIndex;
    levelIndex < state.levels.length;
    levelIndex += 1
  ) {
    const level = state.levels[levelIndex];
    const decoded = decodeAddress({
      address,
      offsetBits: level.geometry.offsetBits,
      indexBits: level.geometry.indexBits
    });
    const set = level.sets[decoded.index];
    const hitLine = set.ways.find(
      (way) => way.valid && way.tag === decoded.tag
    );
    if (!hitLine) {
      continue;
    }

    const sourceBaseAddress = blockBaseAddress(address, decoded.offset);

    return {
      baseAddress: targetBaseAddress,
      dataBytes: readBlockFromLevelLine(
        hitLine,
        sourceBaseAddress,
        targetBaseAddress,
        targetBlockSizeBytes,
        state.memory
      )
    };
  }

  return {
    baseAddress: targetBaseAddress,
    dataBytes: readBlockFromMemory(
      state.memory,
      targetBaseAddress,
      targetBlockSizeBytes
    )
  };
}

function writeMemory(
  mutable: MutableStep,
  opKind: "R" | "W",
  address: number,
  value: number,
  source: { tag: number; index: number; offset: number }
): void {
  if (opKind === "R") {
    mutable.nextState.stats.memoryReads += 1;
  } else {
    mutable.nextState.memory[address] = value;
    mutable.nextState.stats.memoryWrites += 1;
  }

  appendEvent(mutable, {
    stage: "memory",
    levelId: "MEMORY",
    opKind,
    address,
    tag: source.tag,
    index: source.index,
    offset: source.offset
  });
}

function setLine(
  line: CacheLineState,
  values: {
    tag: number;
    dataBytes: number[];
    dirty: boolean;
    tick: number;
    setInsertedAt: boolean;
  }
): void {
  line.valid = true;
  line.tag = values.tag;
  line.dataBytes = [...values.dataBytes];
  line.dirty = values.dirty;
  line.lastUsedAt = values.tick;

  if (values.setInsertedAt) {
    line.insertedAt = values.tick;
  }
}

function fillReadMissAtLevel(
  mutable: MutableStep,
  levelIndex: number,
  address: number,
  blockTransfer: BlockTransfer
): void {
  const level = mutable.nextState.levels[levelIndex];
  const decoded = decodeAddress({
    address,
    offsetBits: level.geometry.offsetBits,
    indexBits: level.geometry.indexBits
  });
  const set = level.sets[decoded.index];
  const victimWay = chooseVictimWay(
    set.ways.map((way, wayIndex) => ({
      way: wayIndex,
      valid: way.valid,
      lastUsedAt: way.lastUsedAt,
      insertedAt: way.insertedAt
    })),
    level.config.replacementPolicy
  );
  const victim = set.ways[victimWay];

  if (victim.valid) {
    const target = dirtyEvictionTarget(mutable.nextState, levelIndex);
    appendEvent(mutable, {
      stage: "eviction",
      levelId: level.id,
      opKind: "R",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
      victimWay,
      dirtyEvictionTarget: victim.dirty ? target : undefined
    });
    mutable.nextState.stats.evictions += 1;
    mutable.nextState.stats.perLevel[level.id].evictions += 1;

    if (victim.dirty) {
      const evictedAddress = encodeAddress({
        tag: victim.tag,
        index: decoded.index,
        offset: 0,
        offsetBits: level.geometry.offsetBits,
        indexBits: level.geometry.indexBits
      });
      const evictedDecoded = decodeAddress({
        address: evictedAddress,
        offsetBits: level.geometry.offsetBits,
        indexBits: level.geometry.indexBits
      });

      appendEvent(mutable, {
        stage: "writeback",
        levelId: level.id,
        opKind: "R",
        address: evictedAddress,
        tag: evictedDecoded.tag,
        index: evictedDecoded.index,
        offset: evictedDecoded.offset,
        victimWay,
        dirtyEvictionTarget: target
      });
      mutable.nextState.stats.writeBacks += 1;
      forwardWrite(mutable, levelIndex + 1, evictedAddress, undefined, {
        baseAddress: evictedAddress,
        dataBytes: victim.dataBytes
      });
    }
  }

  appendEvent(mutable, {
    stage: "fill",
    levelId: level.id,
    opKind: "R",
    address,
    tag: decoded.tag,
    index: decoded.index,
    offset: decoded.offset,
    victimWay
  });

  setLine(set.ways[victimWay], {
    tag: decoded.tag,
    dataBytes: blockTransfer.dataBytes,
    dirty: false,
    tick: mutable.tick,
    setInsertedAt: true
  });

  // EXCLUSIVE: invalidate the block from level N+1 after filling it into level N
  if (
    mutable.nextState.inclusionPolicy === "EXCLUSIVE" &&
    levelIndex + 1 < mutable.nextState.levels.length
  ) {
    const nextLevel = mutable.nextState.levels[levelIndex + 1];
    const nextDecoded = decodeAddress({
      address,
      offsetBits: nextLevel.geometry.offsetBits,
      indexBits: nextLevel.geometry.indexBits
    });
    const nextSet = nextLevel.sets[nextDecoded.index];
    const invalidateWayIndex = nextSet.ways.findIndex(
      (way) => way.valid && way.tag === nextDecoded.tag
    );
    if (invalidateWayIndex !== -1) {
      const wayToInvalidate = nextSet.ways[invalidateWayIndex];
      wayToInvalidate.valid = false;
      wayToInvalidate.tag = 0;
      wayToInvalidate.dirty = false;
      wayToInvalidate.dataBytes = Array.from(
        { length: wayToInvalidate.dataBytes.length },
        () => 0
      );
    }
  }
}

function forwardWrite(
  mutable: MutableStep,
  startLevelIndex: number,
  address: number,
  value: number | undefined,
  incomingBlock?: BlockTransfer
): boolean {
  let anyHit = false;

  for (
    let levelIndex = startLevelIndex;
    levelIndex < mutable.nextState.levels.length;
    levelIndex += 1
  ) {
    const level = mutable.nextState.levels[levelIndex];
    const decoded = decodeAddress({
      address,
      offsetBits: level.geometry.offsetBits,
      indexBits: level.geometry.indexBits
    });
    const set = level.sets[decoded.index];
    const comparedWays = buildComparedWays(set.ways, decoded.tag);
    const hitWay = comparedWays.find((way) => way.match)?.way;

    appendEvent(mutable, {
      stage: "decode",
      levelId: level.id,
      opKind: "W",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset
    });
    appendEvent(mutable, {
      stage: "compare",
      levelId: level.id,
      opKind: "W",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
      comparedWays
    });

    if (hitWay !== undefined) {
      const hitLine = set.ways[hitWay];
      mutable.nextState.stats.perLevel[level.id].hits += 1;
      anyHit = true;
      appendEvent(mutable, {
        stage: "hit",
        levelId: level.id,
        opKind: "W",
        address,
        tag: decoded.tag,
        index: decoded.index,
        offset: decoded.offset
      });

      const levelBaseAddress = blockBaseAddress(address, decoded.offset);
      const mergedFromTransfer = mergeBlockTransfer(
        hitLine.dataBytes,
        levelBaseAddress,
        incomingBlock
      );
      const mergedDataBytes = withOffsetWrite(
        mergedFromTransfer,
        decoded.offset,
        value
      );

      if (level.config.writeHitPolicy === "WRITE_BACK") {
        setLine(hitLine, {
          tag: decoded.tag,
          dataBytes: mergedDataBytes,
          dirty: true,
          tick: mutable.tick,
          setInsertedAt: false
        });
        return anyHit;
      }

      setLine(hitLine, {
        tag: decoded.tag,
        dataBytes: mergedDataBytes,
        dirty: false,
        tick: mutable.tick,
        setInsertedAt: false
      });
      continue;
    }

    appendEvent(mutable, {
      stage: "miss",
      levelId: level.id,
      opKind: "W",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset
    });
    mutable.nextState.stats.perLevel[level.id].misses += 1;

    if (level.config.writeMissPolicy === "WRITE_NO_ALLOCATE") {
      continue;
    }

    const victimWay = chooseVictimWay(
      set.ways.map((way, wayIndex) => ({
        way: wayIndex,
        valid: way.valid,
        lastUsedAt: way.lastUsedAt,
        insertedAt: way.insertedAt
      })),
      level.config.replacementPolicy
    );
    const victim = set.ways[victimWay];

    if (victim.valid) {
      const target = dirtyEvictionTarget(mutable.nextState, levelIndex);
      appendEvent(mutable, {
        stage: "eviction",
        levelId: level.id,
        opKind: "W",
        address,
        tag: decoded.tag,
        index: decoded.index,
        offset: decoded.offset,
        victimWay,
        dirtyEvictionTarget: victim.dirty ? target : undefined
      });
      mutable.nextState.stats.evictions += 1;
      mutable.nextState.stats.perLevel[level.id].evictions += 1;

      if (victim.dirty) {
        const evictedAddress = encodeAddress({
          tag: victim.tag,
          index: decoded.index,
          offset: 0,
          offsetBits: level.geometry.offsetBits,
          indexBits: level.geometry.indexBits
        });
        const evictedDecoded = decodeAddress({
          address: evictedAddress,
          offsetBits: level.geometry.offsetBits,
          indexBits: level.geometry.indexBits
        });

        appendEvent(mutable, {
          stage: "writeback",
          levelId: level.id,
          opKind: "W",
          address: evictedAddress,
          tag: evictedDecoded.tag,
          index: evictedDecoded.index,
          offset: evictedDecoded.offset,
          victimWay,
          dirtyEvictionTarget: target
        });
        mutable.nextState.stats.writeBacks += 1;
        forwardWrite(mutable, levelIndex + 1, evictedAddress, undefined, {
          baseAddress: evictedAddress,
          dataBytes: victim.dataBytes
        });
      }
    }

    appendEvent(mutable, {
      stage: "fill",
      levelId: level.id,
      opKind: "W",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
      victimWay
    });

    const insertedLine = set.ways[victimWay];
    const levelBaseAddress = blockBaseAddress(address, decoded.offset);

    // Check if any downstream cache level holds this block (write-allocate fill hit)
    for (
      let fillLevelIndex = levelIndex + 1;
      fillLevelIndex < mutable.nextState.levels.length;
      fillLevelIndex += 1
    ) {
      const fillLevel = mutable.nextState.levels[fillLevelIndex];
      const fillDecoded = decodeAddress({
        address,
        offsetBits: fillLevel.geometry.offsetBits,
        indexBits: fillLevel.geometry.indexBits
      });
      const fillSet = fillLevel.sets[fillDecoded.index];
      const fillHit = fillSet.ways.some(
        (way) => way.valid && way.tag === fillDecoded.tag
      );
      if (fillHit) {
        anyHit = true;
        mutable.nextState.stats.perLevel[fillLevel.id].hits += 1;
        appendEvent(mutable, {
          stage: "hit",
          levelId: fillLevel.id,
          opKind: "W",
          address,
          tag: fillDecoded.tag,
          index: fillDecoded.index,
          offset: fillDecoded.offset
        });
        break;
      }
    }

    const fetched = readBlockFromHierarchy(
      mutable.nextState,
      levelIndex + 1,
      address,
      level.config.blockSizeBytes
    );
    const mergedFromTransfer = mergeBlockTransfer(
      fetched.dataBytes,
      levelBaseAddress,
      incomingBlock
    );
    const mergedDataBytes = withOffsetWrite(
      mergedFromTransfer,
      decoded.offset,
      value
    );

    if (level.config.writeHitPolicy === "WRITE_BACK") {
      setLine(insertedLine, {
        tag: decoded.tag,
        dataBytes: mergedDataBytes,
        dirty: true,
        tick: mutable.tick,
        setInsertedAt: true
      });
      return anyHit;
    }

    setLine(insertedLine, {
      tag: decoded.tag,
      dataBytes: mergedDataBytes,
      dirty: false,
      tick: mutable.tick,
      setInsertedAt: true
    });
    continue;
  }

  const terminalLevel =
    mutable.nextState.levels[startLevelIndex - 1] ??
    mutable.nextState.levels[mutable.nextState.levels.length - 1];
  const terminalDecode = terminalLevel
    ? decodeAddress({
        address,
        offsetBits: terminalLevel.geometry.offsetBits,
        indexBits: terminalLevel.geometry.indexBits
      })
    : { tag: 0, index: 0, offset: 0 };

  if (incomingBlock) {
    for (let offset = 0; offset < incomingBlock.dataBytes.length; offset += 1) {
      const byteAddress = incomingBlock.baseAddress + offset;
      const byteDecode = terminalLevel
        ? decodeAddress({
            address: byteAddress,
            offsetBits: terminalLevel.geometry.offsetBits,
            indexBits: terminalLevel.geometry.indexBits
          })
        : terminalDecode;
      writeMemory(
        mutable,
        "W",
        byteAddress,
        incomingBlock.dataBytes[offset] ?? 0,
        byteDecode
      );
    }
    return anyHit;
  }

  writeMemory(mutable, "W", address, value ?? 0, terminalDecode);
  return anyHit;
}

function applyWrite(
  mutable: MutableStep,
  address: number,
  value: number
): void {
  if (mutable.nextState.levels.length === 0) {
    writeMemory(mutable, "W", address, value, { tag: 0, index: 0, offset: 0 });
    return;
  }

  const anyHit = forwardWrite(mutable, 0, address, value);
  mutable.nextState.stats.hits += anyHit ? 1 : 0;
  mutable.nextState.stats.misses += anyHit ? 0 : 1;
}

function applyRead(mutable: MutableStep, address: number): void {
  if (mutable.nextState.levels.length === 0) {
    writeMemory(mutable, "R", address, mutable.nextState.memory[address], {
      tag: 0,
      index: 0,
      offset: 0
    });
    mutable.nextState.stats.misses += 1;
    return;
  }

  let sourceValue = mutable.nextState.memory[address];
  let resolvedLevelIndex = mutable.nextState.levels.length;

  for (
    let levelIndex = 0;
    levelIndex < mutable.nextState.levels.length;
    levelIndex += 1
  ) {
    const level = mutable.nextState.levels[levelIndex];
    const decoded = decodeAddress({
      address,
      offsetBits: level.geometry.offsetBits,
      indexBits: level.geometry.indexBits
    });
    const set = level.sets[decoded.index];
    const comparedWays = buildComparedWays(set.ways, decoded.tag);
    const hitWay = comparedWays.find((way) => way.match)?.way;

    appendEvent(mutable, {
      stage: "decode",
      levelId: level.id,
      opKind: "R",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset
    });
    appendEvent(mutable, {
      stage: "compare",
      levelId: level.id,
      opKind: "R",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
      comparedWays
    });

    if (hitWay !== undefined) {
      sourceValue = set.ways[hitWay].dataBytes[decoded.offset] ?? 0;
      resolvedLevelIndex = levelIndex;
      mutable.nextState.stats.perLevel[level.id].hits += 1;
      appendEvent(mutable, {
        stage: "hit",
        levelId: level.id,
        opKind: "R",
        address,
        tag: decoded.tag,
        index: decoded.index,
        offset: decoded.offset
      });
      set.ways[hitWay].lastUsedAt = mutable.tick;
      mutable.nextState.stats.hits += 1;
      break;
    }

    appendEvent(mutable, {
      stage: "miss",
      levelId: level.id,
      opKind: "R",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset
    });
    mutable.nextState.stats.perLevel[level.id].misses += 1;
  }

  if (resolvedLevelIndex === mutable.nextState.levels.length) {
    mutable.nextState.stats.misses += 1;
  }

  if (resolvedLevelIndex === mutable.nextState.levels.length) {
    const lastLevel =
      mutable.nextState.levels[mutable.nextState.levels.length - 1];
    const lastDecoded = decodeAddress({
      address,
      offsetBits: lastLevel.geometry.offsetBits,
      indexBits: lastLevel.geometry.indexBits
    });
    writeMemory(mutable, "R", address, sourceValue, lastDecoded);
  }

  for (
    let levelIndex = resolvedLevelIndex - 1;
    levelIndex >= 0;
    levelIndex -= 1
  ) {
    const blockTransfer = readBlockFromHierarchy(
      mutable.nextState,
      levelIndex + 1,
      address,
      mutable.nextState.levels[levelIndex].config.blockSizeBytes
    );
    fillReadMissAtLevel(mutable, levelIndex, address, blockTransfer);
  }
}

export function simulateStep(state: SimState, op: WorkloadOp): SimStepResult {
  const diagnostic = runtimeDiagnostic(op);
  if (diagnostic) {
    return {
      state,
      events: [],
      diagnostic
    };
  }

  const nextState = cloneState(state);
  const mutable: MutableStep = {
    nextState,
    events: [],
    tick: state.clock + 1
  };

  nextState.clock = mutable.tick;

  if (op.kind === "R") {
    nextState.stats.reads += 1;
    applyRead(mutable, op.address);
  } else {
    nextState.stats.writes += 1;
    applyWrite(mutable, op.address, op.value);
  }

  nextState.events = [...state.events, ...mutable.events];

  return {
    state: nextState,
    events: mutable.events
  };
}
