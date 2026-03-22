/**
 * Dynamically determined colour scale for memory heat-map.
 *
 * The spectrum runs from a pale "cold" colour (0 touches) to a saturated
 * "hot" colour (maximum touches).  Intermediate touch-counts are placed at
 * evenly-spaced positions along the spectrum.
 *
 * Implementation:
 *   1. Collect the **sorted unique** touch-counts present in the data.
 *   2. Map each unique count to a position in [0, 1] (0 = coldest, 1 = hottest).
 *      – If there is only one unique value the position is 0 (all cells identical).
 *   3. Interpolate an HSL colour between `COLD_HSL` and `HOT_HSL`.
 */

// ── Colour endpoints (HSL) ─────────────────────────────────────────
// Cold = pale blue, Hot = saturated red-orange
const COLD_HSL: [number, number, number] = [210, 60, 92]; // hsl(210, 60%, 92%)
const HOT_HSL: [number, number, number] = [4, 78, 48]; // hsl(4, 78%, 48%)

/** Linearly interpolate between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Return an `hsl(…)` CSS string by interpolating between COLD and HOT. */
function hslAt(t: number): string {
  const h = lerp(COLD_HSL[0], HOT_HSL[0], t);
  const s = lerp(COLD_HSL[1], HOT_HSL[1], t);
  const l = lerp(COLD_HSL[2], HOT_HSL[2], t);
  return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

// ── Public API ──────────────────────────────────────────────────────

export type HeatLookup = {
  /** Map from touch-count → CSS colour string. */
  colorOf: (touchCount: number) => string;
  /** The sorted unique touch-count values present in the dataset. */
  uniqueCounts: number[];
};

/**
 * Build a heat lookup from an array of per-cell touch counts.
 *
 * ```ts
 * const lookup = buildHeatLookup([0, 0, 1, 2, 1]);
 * lookup.colorOf(0); // pale (cold)
 * lookup.colorOf(2); // saturated (hot)
 * ```
 */
export function buildHeatLookup(touchCounts: number[]): HeatLookup {
  const uniqueCounts = Array.from(new Set(touchCounts)).sort((a, b) => a - b);

  // Pre-compute a Map<count, colour> so `colorOf` is O(1).
  const map = new Map<number, string>();

  if (uniqueCounts.length <= 1) {
    // All cells have the same count → everything gets the cold colour.
    for (const c of uniqueCounts) {
      map.set(c, hslAt(0));
    }
  } else {
    const maxIndex = uniqueCounts.length - 1;
    for (let i = 0; i < uniqueCounts.length; i += 1) {
      map.set(uniqueCounts[i], hslAt(i / maxIndex));
    }
  }

  return {
    colorOf(touchCount: number): string {
      return map.get(touchCount) ?? hslAt(0);
    },
    uniqueCounts
  };
}

/**
 * Compute a contrasting text colour (black or white) for a given
 * background hsl position `t` on our scale.  A simpler alternative: just
 * check the lightness component.
 */
export function textColorFor(touchCount: number, lookup: HeatLookup): string {
  const idx = lookup.uniqueCounts.indexOf(touchCount);
  if (idx === -1) return "var(--text)";
  const t =
    lookup.uniqueCounts.length <= 1
      ? 0
      : idx / (lookup.uniqueCounts.length - 1);
  // When t > ~0.45 the background gets dark enough that white text reads better.
  return t > 0.45 ? "#fff" : "var(--text)";
}
