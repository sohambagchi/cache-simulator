import { describe, expect, it } from "vitest";
import { V1_LIMITS } from "./constants";

describe("V1_LIMITS", () => {
  it("defines exact finite memory and value bounds", () => {
    expect(V1_LIMITS.memoryWords).toBe(1024);
    expect(V1_LIMITS.minAddress).toBe(0);
    expect(V1_LIMITS.maxAddress).toBe(1023);
    expect(V1_LIMITS.minValue).toBe(0);
    expect(V1_LIMITS.maxValue).toBe(255);
  });
});
