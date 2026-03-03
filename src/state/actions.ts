import type { CacheLevelConfig, CacheLevelId } from "../domain/types";
import type { WorkloadOp } from "../parser/parseWorkload";

export type Action =
  | { type: "LOAD_EXAMPLE_TRACE"; payload: { exampleId: string } }
  | { type: "LOAD_TRACE"; payload: { text: string } }
  | { type: "PLAY" }
  | { type: "STEP" }
  | { type: "PLAY_TICK" }
  | { type: "SUBMIT_REQUEST"; payload: { request: WorkloadOp } }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | {
      type: "UPDATE_CONFIG";
      payload: {
        levelId: CacheLevelId;
        patch: Partial<Omit<CacheLevelConfig, "id">>;
      };
    };
