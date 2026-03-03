import type { CacheLevelConfig } from "../domain/types";
import { createInitialState, type SimState } from "../engine/initialState";
import { simulateStep } from "../engine/simulateStep";
import {
  parseWorkload,
  type WorkloadOp,
  type WorkloadParseResult
} from "../parser/parseWorkload";
import { validateConfig } from "../validation/validateConfig";
import { BUILTIN_WORKLOAD_EXAMPLES } from "../workloads/examples";
import type { Action } from "./actions";

const PARSE_BLOCKING_MESSAGE = "Fix parse errors before running simulation.";
const CONFIG_BLOCKING_MESSAGE = "Fix configuration errors to simulate.";

const DEFAULT_CONFIG_LEVELS: CacheLevelConfig[] = [
  {
    id: "L1",
    enabled: true,
    totalSizeBytes: 256,
    blockSizeBytes: 16,
    associativity: 2,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE"
  },
  {
    id: "L2",
    enabled: true,
    totalSizeBytes: 512,
    blockSizeBytes: 16,
    associativity: 2,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE"
  },
  {
    id: "L3",
    enabled: false,
    totalSizeBytes: 1024,
    blockSizeBytes: 16,
    associativity: 4,
    replacementPolicy: "LRU",
    writeHitPolicy: "WRITE_BACK",
    writeMissPolicy: "WRITE_ALLOCATE"
  }
];

type ValidationResult = ReturnType<typeof validateConfig>;

export type AppState = {
  configLevels: CacheLevelConfig[];
  validation: ValidationResult;
  workloadText: string;
  parseResult: WorkloadParseResult;
  simState: SimState;
  nextOpIndex: number;
  isPlaying: boolean;
  statusMessage: string | null;
};

function createSimulationState(
  configLevels: CacheLevelConfig[],
  fallbackState?: SimState
): SimState {
  try {
    return createInitialState(configLevels);
  } catch (error) {
    if (fallbackState) {
      return fallbackState;
    }

    throw error;
  }
}

function resetForTrace(
  state: AppState,
  workloadText: string,
  parseResult: WorkloadParseResult
): AppState {
  return {
    ...state,
    workloadText,
    parseResult,
    simState: createSimulationState(state.configLevels, state.simState),
    nextOpIndex: 0,
    isPlaying: false,
    statusMessage: null
  };
}

function runOneOperation(state: AppState): AppState {
  const blockingMessage = getRunBlockingMessage(state);
  if (blockingMessage) {
    return {
      ...state,
      statusMessage: blockingMessage
    };
  }

  const operation = state.parseResult.ops[state.nextOpIndex];
  if (!operation) {
    return {
      ...state,
      statusMessage: null
    };
  }

  return runOperation(state, operation, true);
}

function runOperation(
  state: AppState,
  operation: WorkloadOp,
  incrementOpIndex: boolean
): AppState {
  const result = simulateStep(state.simState, operation);
  if (result.diagnostic) {
    return {
      ...state,
      statusMessage: result.diagnostic
    };
  }

  return {
    ...state,
    simState: result.state,
    nextOpIndex: incrementOpIndex ? state.nextOpIndex + 1 : state.nextOpIndex,
    statusMessage: null
  };
}

function getEnabledLevelCount(configLevels: CacheLevelConfig[]): number {
  return configLevels.filter((level) => level.enabled).length;
}

function getRunBlockingMessage(state: AppState): string | null {
  if (state.parseResult.errors.length > 0) {
    return PARSE_BLOCKING_MESSAGE;
  }

  if (state.validation.errors.length > 0) {
    return CONFIG_BLOCKING_MESSAGE;
  }

  return null;
}

const initialWorkloadText = BUILTIN_WORKLOAD_EXAMPLES[0]?.text ?? "";
const initialParseResult = parseWorkload(initialWorkloadText);

export const initialAppState: AppState = {
  configLevels: DEFAULT_CONFIG_LEVELS,
  validation: validateConfig(DEFAULT_CONFIG_LEVELS),
  workloadText: initialWorkloadText,
  parseResult: initialParseResult,
  simState: createSimulationState(DEFAULT_CONFIG_LEVELS),
  nextOpIndex: 0,
  isPlaying: false,
  statusMessage: null
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_EXAMPLE_TRACE": {
      const example = BUILTIN_WORKLOAD_EXAMPLES.find(
        (entry) => entry.id === action.payload.exampleId
      );

      if (!example) {
        return state;
      }

      return resetForTrace(state, example.text, parseWorkload(example.text));
    }
    case "LOAD_TRACE": {
      const parseResult = parseWorkload(action.payload.text);
      return resetForTrace(state, action.payload.text, parseResult);
    }
    case "PLAY": {
      const blockingMessage = getRunBlockingMessage(state);
      if (blockingMessage) {
        return {
          ...state,
          isPlaying: false,
          statusMessage: blockingMessage
        };
      }

      return {
        ...state,
        isPlaying: true,
        statusMessage: null
      };
    }
    case "STEP":
      return runOneOperation(state);
    case "PLAY_TICK":
      return runOneOperation(state);
    case "SUBMIT_REQUEST": {
      if (state.validation.errors.length > 0) {
        return {
          ...state,
          statusMessage: CONFIG_BLOCKING_MESSAGE
        };
      }

      return runOperation(state, action.payload.request, false);
    }
    case "PAUSE":
      return {
        ...state,
        isPlaying: false
      };
    case "RESET":
      return {
        ...state,
        simState: createSimulationState(state.configLevels, state.simState),
        nextOpIndex: 0,
        isPlaying: false,
        statusMessage: null
      };
    case "UPDATE_CONFIG": {
      const enabledCount = getEnabledLevelCount(state.configLevels);
      const updatedLevels = state.configLevels.map((level) => {
        if (level.id !== action.payload.levelId) {
          return level;
        }

        const requestedEnabled = action.payload.patch.enabled;
        const shouldKeepEnabled =
          requestedEnabled === false && level.enabled && enabledCount === 1;

        return {
          ...level,
          ...action.payload.patch,
          enabled: shouldKeepEnabled
            ? true
            : (requestedEnabled ?? level.enabled),
          id: level.id
        };
      });
      const configLevels = updatedLevels;

      return {
        ...state,
        configLevels,
        validation: validateConfig(configLevels),
        simState: createSimulationState(configLevels, state.simState),
        nextOpIndex: 0,
        isPlaying: false,
        statusMessage: null
      };
    }
    default:
      return state;
  }
}

export { PARSE_BLOCKING_MESSAGE };
