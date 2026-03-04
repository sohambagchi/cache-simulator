import { useMemo } from "react";
import type { CacheLevelId } from "../../domain/types";
import type { SimEvent } from "../../engine/initialState";

type BlockDiagramProps = {
  enabledLevels: CacheLevelId[];
  /** The single event currently being narrated. Null = idle/reset state. */
  activeEvent: SimEvent | null;
};

type NodeState = "hit" | "miss" | "active" | "idle";

const NODE_COLORS: Record<NodeState, string> = {
  hit: "#4f8f64",
  miss: "#b05050",
  active: "#557e9f",
  idle: "var(--border-muted)"
};

/**
 * Given a single SimEvent, derive which node is the subject and what state it's in.
 */
function deriveNodeStates(
  event: SimEvent | null,
  enabledLevels: CacheLevelId[]
): Map<string, NodeState> {
  const states = new Map<string, NodeState>();
  states.set("CPU", "idle");
  for (const level of enabledLevels) {
    states.set(level, "idle");
  }
  states.set("MEMORY", "idle");

  if (!event) return states;

  const nodeId = event.levelId === "MEMORY" ? "MEMORY" : event.levelId;

  switch (event.stage) {
    case "decode":
    case "compare":
      states.set("CPU", "active");
      states.set(nodeId, "active");
      break;
    case "hit":
      states.set("CPU", "active");
      states.set(nodeId, "hit");
      break;
    case "miss":
      states.set(nodeId, "miss");
      break;
    case "fill":
      states.set(nodeId, "active");
      break;
    case "eviction":
      states.set(nodeId, "miss");
      break;
    case "writeback":
      states.set(nodeId, "active");
      break;
    case "memory":
      states.set("CPU", "active");
      states.set("MEMORY", event.opKind === "R" ? "active" : "miss");
      break;
  }

  return states;
}

type EdgeDef = { from: string; to: string; dir: "forward" | "return" };

/**
 * Given a single SimEvent, derive which edge (if any) should be animated.
 */
function deriveActiveEdge(
  event: SimEvent | null,
  enabledLevels: CacheLevelId[]
): EdgeDef | null {
  if (!event) return null;

  const nodeOrder = ["CPU", ...enabledLevels, "MEMORY"];
  const nodeId = event.levelId === "MEMORY" ? "MEMORY" : event.levelId;
  const nodeIdx = nodeOrder.indexOf(nodeId);

  switch (event.stage) {
    // Request moving forward from previous node toward this level
    case "decode":
    case "compare":
    case "miss":
      if (nodeIdx > 0) {
        return { from: nodeOrder[nodeIdx - 1], to: nodeId, dir: "forward" };
      }
      break;
    // Data returning from this level back toward CPU
    case "hit":
      if (nodeIdx > 0) {
        return { from: nodeId, to: nodeOrder[nodeIdx - 1], dir: "return" };
      }
      break;
    // Fill: data moving from lower level up into this level
    case "fill":
      if (nodeIdx > 0) {
        return {
          from: nodeOrder[nodeIdx + 1] ?? "MEMORY",
          to: nodeId,
          dir: "return"
        };
      }
      break;
    // Writeback / eviction: dirty data going down to next level
    case "writeback":
    case "eviction":
      if (nodeIdx < nodeOrder.length - 1) {
        return { from: nodeId, to: nodeOrder[nodeIdx + 1], dir: "forward" };
      }
      break;
    // Memory access
    case "memory":
      if (event.opKind === "R") {
        // Fetch: memory → last cache level
        const lastCache = nodeOrder[nodeOrder.length - 2];
        if (lastCache) {
          return { from: "MEMORY", to: lastCache, dir: "return" };
        }
      } else {
        // Write: last cache level → memory
        const lastCache = nodeOrder[nodeOrder.length - 2];
        if (lastCache) {
          return { from: lastCache, to: "MEMORY", dir: "forward" };
        }
      }
      break;
  }

  return null;
}

export function BlockDiagram({
  enabledLevels,
  activeEvent
}: BlockDiagramProps) {
  const allNodes = useMemo(() => {
    const items = [
      { id: "CPU", label: "CPU" },
      ...enabledLevels.map((id) => ({ id, label: id })),
      { id: "MEMORY", label: "Mem" }
    ];
    return items;
  }, [enabledLevels]);

  const nodeWidth = 64;
  const nodeHeight = 44;
  const gap = 48;
  const nodeCount = allNodes.length;
  const svgPad = 16;
  const labelAreaH = 16; // space below nodes for HIT/MISS label
  const svgWidth = nodeCount * nodeWidth + (nodeCount - 1) * gap + svgPad * 2;
  const svgHeight = nodeHeight + labelAreaH + svgPad * 2;

  const positionedNodes = useMemo(
    () =>
      allNodes.map((node, i) => ({
        ...node,
        x: svgPad + i * (nodeWidth + gap),
        y: svgPad
      })),
    [allNodes]
  );

  const nodeMap = useMemo(() => {
    const m = new Map<string, (typeof positionedNodes)[0]>();
    for (const n of positionedNodes) m.set(n.id, n);
    return m;
  }, [positionedNodes]);

  const nodeStates = useMemo(
    () => deriveNodeStates(activeEvent, enabledLevels),
    [activeEvent, enabledLevels]
  );

  const activeEdge = useMemo(
    () => deriveActiveEdge(activeEvent, enabledLevels),
    [activeEvent, enabledLevels]
  );

  // Use a key tied to the event so SVG animations restart on each new event
  const animKey = activeEvent
    ? `${activeEvent.operationId}-${activeEvent.stage}-${activeEvent.levelId}`
    : "idle";

  return (
    <div
      className="block-diagram"
      role="img"
      aria-label="Cache hierarchy block diagram"
    >
      <svg
        key={animKey}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width={svgWidth}
        height={svgHeight}
      >
        {/* Edges */}
        {positionedNodes.map((node, i) => {
          if (i === 0) return null;
          const prev = positionedNodes[i - 1];
          const x1 = prev.x + nodeWidth;
          const x2 = node.x;
          const cy = prev.y + nodeHeight / 2;

          const isForward =
            activeEdge?.from === prev.id &&
            activeEdge?.to === node.id &&
            activeEdge?.dir === "forward";
          const isReturn =
            activeEdge?.from === node.id &&
            activeEdge?.to === prev.id &&
            activeEdge?.dir === "return";
          const isActive = isForward || isReturn;

          const dotColor = isReturn ? "#4f8f64" : "#557e9f";
          const arrowColor = dotColor;

          return (
            <g key={`edge-${prev.id}-${node.id}`}>
              {/* Track line */}
              <line
                x1={x1}
                y1={cy}
                x2={x2}
                y2={cy}
                stroke={
                  isActive ? "var(--border-muted)" : "var(--border-subtle)"
                }
                strokeWidth={isActive ? 2 : 1.5}
                strokeDasharray={isActive ? "none" : "4 3"}
              />
              {/* Arrow tip */}
              {isForward && (
                <polygon
                  points={`${x2 - 7},${cy - 4} ${x2},${cy} ${x2 - 7},${cy + 4}`}
                  fill={arrowColor}
                />
              )}
              {isReturn && (
                <polygon
                  points={`${x1 + 7},${cy - 4} ${x1},${cy} ${x1 + 7},${cy + 4}`}
                  fill={arrowColor}
                />
              )}
              {/* Traveling dot */}
              {isForward && (
                <circle r={4} fill={dotColor} opacity={0.9}>
                  <animate
                    attributeName="cx"
                    from={x1}
                    to={x2 - 8}
                    dur="0.5s"
                    fill="freeze"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    from="0 0"
                    to="0 0"
                    dur="0.5s"
                    fill="freeze"
                  />
                  <set attributeName="cy" to={cy} />
                </circle>
              )}
              {isReturn && (
                <circle r={4} fill={dotColor} opacity={0.9}>
                  <animate
                    attributeName="cx"
                    from={x2}
                    to={x1 + 8}
                    dur="0.5s"
                    fill="freeze"
                  />
                  <set attributeName="cy" to={cy} />
                </circle>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {positionedNodes.map((node) => {
          const state = nodeStates.get(node.id) ?? "idle";
          const color = NODE_COLORS[state];
          const isFilled = state === "hit" || state === "miss";
          const isActive = state === "active";

          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={nodeWidth}
                height={nodeHeight}
                rx={8}
                fill={isFilled ? color : "var(--surface-card)"}
                stroke={color}
                strokeWidth={isFilled || isActive ? 2.5 : 1.5}
              />
              <text
                x={node.x + nodeWidth / 2}
                y={node.y + nodeHeight / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isFilled ? "#fff" : "var(--text-strong)"}
                fontSize={12}
                fontWeight={700}
                fontFamily="inherit"
              >
                {node.label}
              </text>
              {/* HIT / MISS badge below node */}
              {(state === "hit" || state === "miss") && (
                <text
                  x={node.x + nodeWidth / 2}
                  y={node.y + nodeHeight + 12}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill={color}
                  fontFamily="inherit"
                  letterSpacing="0.05em"
                >
                  {state.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
