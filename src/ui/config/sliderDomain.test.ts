import { describe, expect, it } from "vitest";
import {
  TOTAL_SIZE_OPTIONS,
  BLOCK_SIZE_OPTIONS,
  toSliderIndex,
  fromSliderIndex,
  formatBytesLabel,
  formatWaysLabel
} from "./sliderDomain";

describe("sliderDomain", () => {
  it("provides powers-of-two block size options from 4B to 32B", () => {
    expect(BLOCK_SIZE_OPTIONS[0]).toBe(4);
    expect(BLOCK_SIZE_OPTIONS.at(-1)).toBe(32);
    expect(BLOCK_SIZE_OPTIONS).toHaveLength(4);
  });

  it("provides powers-of-two total size options from 4B to 33MB", () => {
    expect(TOTAL_SIZE_OPTIONS[0]).toBe(4);
    expect(TOTAL_SIZE_OPTIONS.at(-1)).toBe(33_554_432);
    expect(TOTAL_SIZE_OPTIONS).toHaveLength(24);
  });

  it("maps option values to/from slider indices", () => {
    expect(toSliderIndex(4, BLOCK_SIZE_OPTIONS)).toBe(0);
    expect(toSliderIndex(32, BLOCK_SIZE_OPTIONS)).toBe(3);
    expect(fromSliderIndex(3, BLOCK_SIZE_OPTIONS)).toBe(32);
  });

  it("formats bytes and associativity labels for inline display", () => {
    expect(formatBytesLabel(4)).toBe("4 B");
    expect(formatBytesLabel(32)).toBe("32 B");
    expect(formatBytesLabel(4096)).toBe("4 KB");
    expect(formatBytesLabel(1_048_576)).toBe("1 MB");
    expect(formatWaysLabel(1)).toBe("1-way");
    expect(formatWaysLabel(8)).toBe("8-way");
  });
});
