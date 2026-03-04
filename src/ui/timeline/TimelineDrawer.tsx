import type { SimEvent, SimEventStage } from "../../engine/initialState";

type TimelineDrawerProps = {
  events: SimEvent[];
  isOpen: boolean;
  onClose: () => void;
};

const STAGE_LABELS: Record<SimEventStage, string> = {
  decode: "DECODE",
  compare: "COMPARE",
  hit: "HIT",
  miss: "MISS",
  fill: "FILL",
  eviction: "EVICT",
  writeback: "WRITEBACK",
  memory: "MEMORY"
};

const STAGE_VARIANT: Record<SimEventStage, string> = {
  decode: "neutral",
  compare: "neutral",
  hit: "hit",
  miss: "miss",
  fill: "info",
  eviction: "warn",
  writeback: "warn",
  memory: "info"
};

function hex(n: number) {
  return `0x${n.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function TimelineDrawer({
  events,
  isOpen,
  onClose
}: TimelineDrawerProps) {
  if (!isOpen) return null;

  // Group events by operationId
  const opGroups: { opId: number; events: SimEvent[] }[] = [];
  for (const event of events) {
    const last = opGroups[opGroups.length - 1];
    if (last && last.opId === event.operationId) {
      last.events.push(event);
    } else {
      opGroups.push({ opId: event.operationId, events: [event] });
    }
  }

  return (
    <>
      <div
        className="timeline-drawer__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="timeline-drawer"
        aria-label="Event timeline"
        role="complementary"
      >
        <div className="timeline-drawer__header">
          <h2>Timeline</h2>
          <button
            type="button"
            className="timeline-drawer__close"
            onClick={onClose}
            aria-label="Close timeline"
          >
            {"\u2715"}
          </button>
        </div>
        <div className="timeline-drawer__body">
          {events.length === 0 ? (
            <p className="timeline-drawer__empty">
              No events yet. Run the simulation to see events here.
            </p>
          ) : (
            <ol className="timeline-op-list">
              {opGroups.map(({ opId, events: opEvents }) => {
                const decodeEvent =
                  opEvents.find((e) => e.stage === "decode") ?? opEvents[0];
                const opKind = decodeEvent.opKind;
                const addr = decodeEvent.address;
                const isLatest = opId === opGroups[opGroups.length - 1].opId;

                return (
                  <li
                    key={opId}
                    className={`timeline-op${isLatest ? " timeline-op--latest" : ""}`}
                  >
                    {/* Operation header */}
                    <div className="timeline-op__header">
                      <span className="timeline-op__index">#{opId}</span>
                      <span
                        className={`timeline-op__kind timeline-op__kind--${opKind === "R" ? "read" : "write"}`}
                      >
                        {opKind === "R" ? "READ" : "WRITE"}
                      </span>
                      <span className="timeline-op__addr">{hex(addr)}</span>
                      {decodeEvent && (
                        <span className="timeline-op__decode">
                          <span className="timeline-op__field">
                            <span className="timeline-op__field-label">
                              tag
                            </span>
                            <span className="timeline-op__field-value">
                              {decodeEvent.tag}
                            </span>
                          </span>
                          <span className="timeline-op__field">
                            <span className="timeline-op__field-label">
                              idx
                            </span>
                            <span className="timeline-op__field-value">
                              {decodeEvent.index}
                            </span>
                          </span>
                          <span className="timeline-op__field">
                            <span className="timeline-op__field-label">
                              off
                            </span>
                            <span className="timeline-op__field-value">
                              {decodeEvent.offset}
                            </span>
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Event steps */}
                    <ol className="timeline-step-list">
                      {opEvents.map((event, i) => {
                        const variant = STAGE_VARIANT[event.stage];
                        return (
                          <li
                            key={`${event.levelId}-${event.stage}-${i}`}
                            className={`timeline-step timeline-step--${variant}`}
                          >
                            <span className="timeline-step__stage">
                              {STAGE_LABELS[event.stage]}
                            </span>
                            <span className="timeline-step__level">
                              {event.levelId}
                            </span>
                            {event.stage === "compare" &&
                              event.comparedWays.length > 0 && (
                                <span className="timeline-step__detail">
                                  {event.comparedWays.map((w) => (
                                    <span
                                      key={w.way}
                                      className={`timeline-step__way${w.match ? " timeline-step__way--match" : ""}`}
                                    >
                                      W{w.way}
                                    </span>
                                  ))}
                                </span>
                              )}
                            {event.victimWay !== undefined && (
                              <span className="timeline-step__detail timeline-step__detail--victim">
                                victim W{event.victimWay}
                              </span>
                            )}
                            {event.dirtyEvictionTarget && (
                              <span className="timeline-step__detail">
                                → {event.dirtyEvictionTarget}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}
