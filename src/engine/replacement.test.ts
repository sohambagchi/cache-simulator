import { describe, expect, it } from "vitest";
import { chooseVictimWay } from "./replacement";

describe("chooseVictimWay", () => {
  it("prefers first invalid way before replacement policy", () => {
    expect(
      chooseVictimWay(
        [
          { way: 0, valid: true, lastUsedAt: 11, insertedAt: 4 },
          { way: 1, valid: false, lastUsedAt: 7, insertedAt: 7 },
          { way: 2, valid: false, lastUsedAt: 2, insertedAt: 2 },
        ],
        "LRU",
      ),
    ).toBe(1);
  });

  it("uses lru when all ways are valid", () => {
    expect(
      chooseVictimWay(
        [
          { way: 0, valid: true, lastUsedAt: 9, insertedAt: 1 },
          { way: 1, valid: true, lastUsedAt: 3, insertedAt: 2 },
          { way: 2, valid: true, lastUsedAt: 7, insertedAt: 3 },
        ],
        "LRU",
      ),
    ).toBe(1);
  });

  it("uses fifo when all ways are valid", () => {
    expect(
      chooseVictimWay(
        [
          { way: 0, valid: true, lastUsedAt: 8, insertedAt: 4 },
          { way: 1, valid: true, lastUsedAt: 2, insertedAt: 2 },
          { way: 2, valid: true, lastUsedAt: 1, insertedAt: 3 },
        ],
        "FIFO",
      ),
    ).toBe(1);
  });
});
