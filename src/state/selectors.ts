import type { AppState } from "./reducer";

export function selectCanRunSimulation(state: AppState): boolean {
  return state.parseResult.errors.length === 0;
}

export function selectPreviewOperations(state: AppState) {
  return state.parseResult.ops;
}

export function selectParseDiagnostics(state: AppState) {
  return state.parseResult.errors;
}
