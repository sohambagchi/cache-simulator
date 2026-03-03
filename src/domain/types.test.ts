import { describe, expectTypeOf, it } from "vitest";
import type { CacheLevelConfig } from "./types";

describe("CacheLevelConfig", () => {
  it("keeps write-hit and write-miss as separate unions", () => {
    expectTypeOf<CacheLevelConfig>().toMatchTypeOf<{
      writeHitPolicy: "WRITE_THROUGH" | "WRITE_BACK";
      writeMissPolicy: "WRITE_ALLOCATE" | "WRITE_NO_ALLOCATE";
    }>();
  });
});
