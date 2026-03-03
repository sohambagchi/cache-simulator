import { describe, expect, it } from "vitest";
import { V1_LIMITS } from "../domain/constants";
import { parseWorkload } from "./parseWorkload";

describe("parseWorkload", () => {
  it("parses read and write with decimal and hex", () => {
    const result = parseWorkload("r 26\nW 0x1a 255");

    expect(result.errors).toEqual([]);
    expect(result.ops).toEqual([
      { kind: "R", address: 26 },
      { kind: "W", address: 26, value: 255 },
    ]);
  });

  it("ignores comments and blank lines", () => {
    const result = parseWorkload("# warmup\n\nR 4\n   \n# cooldown");

    expect(result.errors).toEqual([]);
    expect(result.ops).toEqual([{ kind: "R", address: 4 }]);
  });

  it("returns line-specific errors with line prefix", () => {
    const result = parseWorkload("W 12\nQ 3\nR nope");

    expect(result.ops).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({ line: 1, message: expect.stringMatching(/^Line 1:/) }),
      expect.objectContaining({ line: 2, message: expect.stringMatching(/^Line 2:/) }),
      expect.objectContaining({ line: 3, message: expect.stringMatching(/^Line 3:/) }),
    ]);
  });

  it("accepts lower and upper bounds for address and value", () => {
    const result = parseWorkload("R 0\nR 1023\nW 0 0\nW 1023 255");

    expect(result.errors).toEqual([]);
    expect(result.ops).toEqual([
      { kind: "R", address: 0 },
      { kind: "R", address: 1023 },
      { kind: "W", address: 0, value: 0 },
      { kind: "W", address: 1023, value: 255 },
    ]);
  });

  it("emits explicit out-of-range diagnostics for address and value", () => {
    const result = parseWorkload("R -1\nR 1024\nW 4 256\nW 4 -1");
    const expectedAddressRange = `${V1_LIMITS.minAddress}..${V1_LIMITS.maxAddress}`;
    const expectedValueRange = `${V1_LIMITS.minValue}..${V1_LIMITS.maxValue}`;

    expect(result.ops).toEqual([]);
    expect(result.errors).toEqual([
      {
        line: 1,
        message: `Line 1: address out of range (expected ${expectedAddressRange})`,
      },
      {
        line: 2,
        message: `Line 2: address out of range (expected ${expectedAddressRange})`,
      },
      {
        line: 3,
        message: `Line 3: value out of range (expected ${expectedValueRange})`,
      },
      {
        line: 4,
        message: `Line 4: value out of range (expected ${expectedValueRange})`,
      },
    ]);
  });
});
