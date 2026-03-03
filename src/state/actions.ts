import type { CacheLevelConfig, CacheLevelId } from "../domain/types";

export type Action =
  | { type: "LOAD_EXAMPLE_TRACE"; payload: { exampleId: string } }
  | { type: "LOAD_TRACE"; payload: { text: string } }
  | { type: "STEP" }
  | { type: "PLAY_TICK" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | {
      type: "UPDATE_CONFIG";
      payload: {
        levelId: CacheLevelId;
        patch: Partial<Omit<CacheLevelConfig, "id">>;
      };
    };
