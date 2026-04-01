import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimEvent } from "../../engine/initialState";
import type { CacheLevelId } from "../../domain/types";
import { buildHeatLookup, textColorFor } from "./heatScale";
import { computePerAddressStats, computeTouchCounts } from "./memoryStats";

type MemoryLevelInfo = { id: CacheLevelId; blockSizeBytes: number };

type MemoryPanelProps = {
  memory: number[];
  events: SimEvent[];
  levels: MemoryLevelInfo[];
};

/** Round `n` down to the nearest positive multiple of 4. */
function floorToMultipleOf4(n: number): number {
  const floored = Math.floor(n / 4) * 4;
  return Math.max(4, floored);
}

/** Minimum cell width in pixels. */
const MIN_CELL_PX = 32;

export function MemoryPanel({ memory, events, levels }: MemoryPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(32);

  // ── Responsive column count ──────────────────────────────────────
  const recalcColumns = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // Account for 1px gap between cells
    const available = el.clientWidth;
    const raw = Math.floor(available / MIN_CELL_PX);
    setColumns(floorToMultipleOf4(raw));
  }, []);

  useEffect(() => {
    recalcColumns();
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => recalcColumns());
    observer.observe(el);
    return () => observer.disconnect();
  }, [recalcColumns]);

  // ── Derived data ─────────────────────────────────────────────────
  const addressStats = useMemo(
    () => computePerAddressStats(events, memory.length),
    [events, memory.length]
  );

  const touchCounts = useMemo(
    () => computeTouchCounts(addressStats),
    [addressStats]
  );

  const heatLookup = useMemo(() => buildHeatLookup(touchCounts), [touchCounts]);

  // ── Tooltip builder ──────────────────────────────────────────────
  const buildTooltip = useCallback(
    (address: number) => {
      const stats = addressStats[address];
      const lines: string[] = [`Addr: ${address}`];

      if (levels.length > 0) {
        const blockParts = levels.map(
          (lvl) => `${lvl.id}: ${Math.floor(address / lvl.blockSizeBytes)}`
        );
        lines.push(`Block ${blockParts.join(" | ")}`);
      }

      lines.push(`Reads: ${stats.reads}`);
      lines.push(`Writes: ${stats.writes}`);
      return lines.join("\n");
    },
    [addressStats, levels]
  );

  return (
    <div
      ref={containerRef}
      className="memory-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {memory.map((value, address) => {
        const total = touchCounts[address];
        const bg = heatLookup.colorOf(total);
        const fg = textColorFor(total, heatLookup);

        const col = address % columns; // 0-based column index
        const row = Math.floor(address / columns); // 0-based row index
        const isRightEdge = col >= columns - 2; // last two columns → tooltip grows left
        const isLeftEdge = col <= 1; // first two columns → tooltip grows right
        const isTopEdge = row <= 1; // first two rows → tooltip flips below

        const edgeClass = [
          isRightEdge && "tooltip-anchor-right",
          isLeftEdge && "tooltip-anchor-left",
          isTopEdge && "tooltip-below"
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span
            key={address}
            className={`memory-cell${edgeClass ? ` ${edgeClass}` : ""}`}
            style={{ backgroundColor: bg, color: fg }}
            data-tooltip={buildTooltip(address)}
            aria-label={buildTooltip(address)}
          >
            {value}
          </span>
        );
      })}
    </div>
  );
}
