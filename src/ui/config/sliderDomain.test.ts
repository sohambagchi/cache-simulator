import { describe, expect, it } from "vitest";
import {
  GEOMETRY_SIZE_OPTIONS,
  toSliderIndex,
  fromSliderIndex,
  formatBytesLabel,
  formatWaysLabel
} from "./sliderDomain";

describe("sliderDomain", () => {
  it("provides powers-of-two size options from 4B to 32MB", () => {
    expect(GEOMETRY_SIZE_OPTIONS[0]).toBe(4);
    expect(GEOMETRY_SIZE_OPTIONS.at(-1)).toBe(33_554_432);
    expect(GEOMETRY_SIZE_OPTIONS).toHaveLength(24);
  });

  it("maps option values to/from slider indices", () => {
    expect(toSliderIndex(4, GEOMETRY_SIZE_OPTIONS)).toBe(0);
    expect(toSliderIndex(4096, GEOMETRY_SIZE_OPTIONS)).toBe(10);
    expect(fromSliderIndex(10, GEOMETRY_SIZE_OPTIONS)).toBe(4096);
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
