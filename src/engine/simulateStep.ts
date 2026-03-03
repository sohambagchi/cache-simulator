import { V1_LIMITS } from "../domain/constants";
import type { WorkloadOp } from "../parser/parseWorkload";
import { decodeAddress, encodeAddress } from "./addressing";
import { dirtyEvictionTarget } from "./cascade";
import type { CacheLineState, ComparedWay, SimEvent, SimState, SimStepResult } from "./initialState";
import { chooseVictimWay } from "./replacement";

type MutableStep = {
  nextState: SimState;
  events: SimEvent[];
  tick: number;
};

function cloneState(state: SimState): SimState {
  return {
    ...state,
    levels: state.levels.map((level) => ({
      ...level,
      sets: level.sets.map((set) => ({
        ways: set.ways.map((way) => ({ ...way })),
      })),
    })),
    memory: [...state.memory],
    diagnostics: [...state.diagnostics],
    events: [],
    stats: {
      ...state.stats,
      perLevel: {
        L1: { ...state.stats.perLevel.L1 },
        L2: { ...state.stats.perLevel.L2 },
        L3: { ...state.stats.perLevel.L3 },
      },
    },
  };
}

function runtimeDiagnostic(op: WorkloadOp): string | null {
  if (op.address < V1_LIMITS.minAddress || op.address > V1_LIMITS.maxAddress) {
    return `Runtime: address out of range (expected ${V1_LIMITS.minAddress}..${V1_LIMITS.maxAddress})`;
  }

  if (op.kind === "W" && (op.value < V1_LIMITS.minValue || op.value > V1_LIMITS.maxValue)) {
    return `Runtime: value out of range (expected ${V1_LIMITS.minValue}..${V1_LIMITS.maxValue})`;
  }

  return null;
}

function appendEvent(
  mutable: MutableStep,
  event: Omit<SimEvent, "comparedWays"> & { comparedWays?: ComparedWay[] },
): void {
  mutable.events.push({
    ...event,
    comparedWays: event.comparedWays ?? [],
  });
}

function buildComparedWays(ways: CacheLineState[], tag: number): ComparedWay[] {
  return ways.map((way, wayIndex) => ({
    way: wayIndex,
    valid: way.valid,
    tag: way.tag,
    match: way.valid && way.tag === tag,
  }));
}

function writeMemory(
  mutable: MutableStep,
  opKind: "R" | "W",
  address: number,
  value: number,
  source: { tag: number; index: number; offset: number },
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
    offset: source.offset,
  });
}

function setLine(
  line: CacheLineState,
  values: {
    tag: number;
    value: number;
    dirty: boolean;
    tick: number;
    setInsertedAt: boolean;
  },
): void {
  line.valid = true;
  line.tag = values.tag;
  line.data = values.value;
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
  value: number,
): void {
  const level = mutable.nextState.levels[levelIndex];
  const decoded = decodeAddress({
    address,
    offsetBits: level.geometry.offsetBits,
    indexBits: level.geometry.indexBits,
  });
  const set = level.sets[decoded.index];
  const victimWay = chooseVictimWay(
    set.ways.map((way, wayIndex) => ({
      way: wayIndex,
      valid: way.valid,
      lastUsedAt: way.lastUsedAt,
      insertedAt: way.insertedAt,
    })),
    level.config.replacementPolicy,
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
      dirtyEvictionTarget: victim.dirty ? target : undefined,
    });
    mutable.nextState.stats.evictions += 1;
    mutable.nextState.stats.perLevel[level.id].evictions += 1;

    if (victim.dirty) {
      const evictedAddress = encodeAddress({
        tag: victim.tag,
        index: decoded.index,
        offset: 0,
        offsetBits: level.geometry.offsetBits,
        indexBits: level.geometry.indexBits,
      });
      const evictedDecoded = decodeAddress({
        address: evictedAddress,
        offsetBits: level.geometry.offsetBits,
        indexBits: level.geometry.indexBits,
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
        dirtyEvictionTarget: target,
      });
      mutable.nextState.stats.writeBacks += 1;
      forwardWrite(mutable, levelIndex + 1, evictedAddress, victim.data, "W");
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
    victimWay,
  });

  setLine(set.ways[victimWay], {
    tag: decoded.tag,
    value,
    dirty: false,
    tick: mutable.tick,
    setInsertedAt: true,
  });
}

function forwardWrite(
  mutable: MutableStep,
  startLevelIndex: number,
  address: number,
  value: number,
  opKind: "W",
): void {
  for (let levelIndex = startLevelIndex; levelIndex < mutable.nextState.levels.length; levelIndex += 1) {
    const level = mutable.nextState.levels[levelIndex];
    const decoded = decodeAddress({
      address,
      offsetBits: level.geometry.offsetBits,
      indexBits: level.geometry.indexBits,
    });
    const set = level.sets[decoded.index];
    const comparedWays = buildComparedWays(set.ways, decoded.tag);
    const hitWay = comparedWays.find((way) => way.match)?.way;

    appendEvent(mutable, {
      stage: "decode",
      levelId: level.id,
      opKind,
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
    });
    appendEvent(mutable, {
      stage: "compare",
      levelId: level.id,
      opKind,
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
      comparedWays,
    });

    if (hitWay !== undefined) {
      const hitLine = set.ways[hitWay];
      mutable.nextState.stats.perLevel[level.id].hits += 1;
      appendEvent(mutable, {
        stage: "hit",
        levelId: level.id,
        opKind,
        address,
        tag: decoded.tag,
        index: decoded.index,
        offset: decoded.offset,
      });

      if (level.config.writeHitPolicy === "WRITE_BACK") {
        setLine(hitLine, {
          tag: decoded.tag,
          value,
          dirty: true,
          tick: mutable.tick,
          setInsertedAt: false,
        });
        return;
      }

      setLine(hitLine, {
        tag: decoded.tag,
        value,
        dirty: false,
        tick: mutable.tick,
        setInsertedAt: false,
      });
      continue;
    }

    appendEvent(mutable, {
      stage: "miss",
      levelId: level.id,
      opKind,
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
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
        insertedAt: way.insertedAt,
      })),
      level.config.replacementPolicy,
    );
    const victim = set.ways[victimWay];

    if (victim.valid) {
      const target = dirtyEvictionTarget(mutable.nextState, levelIndex);
      appendEvent(mutable, {
        stage: "eviction",
        levelId: level.id,
        opKind,
        address,
        tag: decoded.tag,
        index: decoded.index,
        offset: decoded.offset,
        victimWay,
        dirtyEvictionTarget: victim.dirty ? target : undefined,
      });
      mutable.nextState.stats.evictions += 1;
      mutable.nextState.stats.perLevel[level.id].evictions += 1;

      if (victim.dirty) {
        const evictedAddress = encodeAddress({
          tag: victim.tag,
          index: decoded.index,
          offset: 0,
          offsetBits: level.geometry.offsetBits,
          indexBits: level.geometry.indexBits,
        });
        const evictedDecoded = decodeAddress({
          address: evictedAddress,
          offsetBits: level.geometry.offsetBits,
          indexBits: level.geometry.indexBits,
        });

        appendEvent(mutable, {
          stage: "writeback",
          levelId: level.id,
          opKind,
          address: evictedAddress,
          tag: evictedDecoded.tag,
          index: evictedDecoded.index,
          offset: evictedDecoded.offset,
          victimWay,
          dirtyEvictionTarget: target,
        });
        mutable.nextState.stats.writeBacks += 1;
        forwardWrite(mutable, levelIndex + 1, evictedAddress, victim.data, "W");
      }
    }

    appendEvent(mutable, {
      stage: "fill",
      levelId: level.id,
      opKind,
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
      victimWay,
    });

    const insertedLine = set.ways[victimWay];
    if (level.config.writeHitPolicy === "WRITE_BACK") {
      setLine(insertedLine, {
        tag: decoded.tag,
        value,
        dirty: true,
        tick: mutable.tick,
        setInsertedAt: true,
      });
      return;
    }

    setLine(insertedLine, {
      tag: decoded.tag,
      value,
      dirty: false,
      tick: mutable.tick,
      setInsertedAt: true,
    });
    continue;
  }

  const terminalLevel =
    mutable.nextState.levels[startLevelIndex - 1] ?? mutable.nextState.levels[mutable.nextState.levels.length - 1];
  const terminalDecode = terminalLevel
    ? decodeAddress({
        address,
        offsetBits: terminalLevel.geometry.offsetBits,
        indexBits: terminalLevel.geometry.indexBits,
      })
    : { tag: 0, index: 0, offset: 0 };

  writeMemory(mutable, "W", address, value, terminalDecode);
}

function applyWrite(mutable: MutableStep, address: number, value: number): void {
  if (mutable.nextState.levels.length === 0) {
    writeMemory(mutable, "W", address, value, { tag: 0, index: 0, offset: 0 });
    return;
  }

  const firstLevel = mutable.nextState.levels[0];
  const firstDecoded = decodeAddress({
    address,
    offsetBits: firstLevel.geometry.offsetBits,
    indexBits: firstLevel.geometry.indexBits,
  });
  const firstSet = firstLevel.sets[firstDecoded.index];
  const firstComparedWays = buildComparedWays(firstSet.ways, firstDecoded.tag);
  const firstHitWay = firstComparedWays.find((way) => way.match)?.way;

  mutable.nextState.stats.misses += firstHitWay === undefined ? 1 : 0;
  mutable.nextState.stats.hits += firstHitWay !== undefined ? 1 : 0;

  forwardWrite(mutable, 0, address, value, "W");
}

function applyRead(mutable: MutableStep, address: number): void {
  if (mutable.nextState.levels.length === 0) {
    writeMemory(mutable, "R", address, mutable.nextState.memory[address], {
      tag: 0,
      index: 0,
      offset: 0,
    });
    mutable.nextState.stats.misses += 1;
    return;
  }

  let sourceValue = mutable.nextState.memory[address];
  let resolvedLevelIndex = mutable.nextState.levels.length;

  for (let levelIndex = 0; levelIndex < mutable.nextState.levels.length; levelIndex += 1) {
    const level = mutable.nextState.levels[levelIndex];
    const decoded = decodeAddress({
      address,
      offsetBits: level.geometry.offsetBits,
      indexBits: level.geometry.indexBits,
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
      offset: decoded.offset,
    });
    appendEvent(mutable, {
      stage: "compare",
      levelId: level.id,
      opKind: "R",
      address,
      tag: decoded.tag,
      index: decoded.index,
      offset: decoded.offset,
      comparedWays,
    });

    if (hitWay !== undefined) {
      sourceValue = set.ways[hitWay].data;
      resolvedLevelIndex = levelIndex;
      mutable.nextState.stats.perLevel[level.id].hits += 1;
      appendEvent(mutable, {
        stage: "hit",
        levelId: level.id,
        opKind: "R",
        address,
        tag: decoded.tag,
        index: decoded.index,
        offset: decoded.offset,
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
      offset: decoded.offset,
    });
    mutable.nextState.stats.perLevel[level.id].misses += 1;

    if (levelIndex === 0) {
      mutable.nextState.stats.misses += 1;
    }
  }

  if (resolvedLevelIndex === mutable.nextState.levels.length) {
    const lastLevel = mutable.nextState.levels[mutable.nextState.levels.length - 1];
    const lastDecoded = decodeAddress({
      address,
      offsetBits: lastLevel.geometry.offsetBits,
      indexBits: lastLevel.geometry.indexBits,
    });
    writeMemory(mutable, "R", address, sourceValue, lastDecoded);
  }

  for (let levelIndex = resolvedLevelIndex - 1; levelIndex >= 0; levelIndex -= 1) {
    fillReadMissAtLevel(mutable, levelIndex, address, sourceValue);
  }
}

export function simulateStep(state: SimState, op: WorkloadOp): SimStepResult {
  const diagnostic = runtimeDiagnostic(op);
  if (diagnostic) {
    return {
      state,
      events: [],
      diagnostic,
    };
  }

  const nextState = cloneState(state);
  const mutable: MutableStep = {
    nextState,
    events: [],
    tick: state.clock + 1,
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
    events: mutable.events,
  };
}
