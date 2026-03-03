import { describe, expect, it } from "vitest";
import { decodeAddress } from "./addressing";

describe("decodeAddress", () => {
  it("splits tag index and offset using bit widths", () => {
    expect(decodeAddress({ address: 0b110101, offsetBits: 2, indexBits: 2 })).toEqual({
      tag: 0b11,
      index: 0b01,
      offset: 0b01,
    });
  });

  it("supports zero index bits", () => {
    expect(decodeAddress({ address: 0b1011, offsetBits: 1, indexBits: 0 })).toEqual({
      tag: 0b101,
      index: 0,
      offset: 0b1,
    });
  });
});
