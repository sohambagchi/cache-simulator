import type { SimEvent } from "../../engine/initialState";

type TimelineDrawerProps = {
  events: SimEvent[];
  isOpen: boolean;
  onClose: () => void;
};

export function TimelineDrawer({
  events,
  isOpen,
  onClose
}: TimelineDrawerProps) {
  if (!isOpen) return null;

  const latestOperationId = events[events.length - 1]?.operationId;
  const latestOperationEvents = events.filter(
    (event) => event.operationId === latestOperationId
  );
  const latestEvent = latestOperationEvents[latestOperationEvents.length - 1];
  const latestDecode =
    latestOperationEvents.find((event) => event.stage === "decode") ??
    latestEvent;
  const latestCompare = latestOperationEvents.find(
    (event) => event.stage === "compare"
  );
  const matchedWays =
    latestCompare?.comparedWays
      .filter((way) => way.match)
      .map((way) => way.way) ?? [];
  const victimCueEvent = [...latestOperationEvents]
    .reverse()
    .find((event) => event.victimWay !== undefined);

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
            <p>No events yet</p>
          ) : (
            <>
              <section aria-label="Latest decode details">
                <p>
                  Tag {latestDecode.tag} Index {latestDecode.index} Offset{" "}
                  {latestDecode.offset}
                </p>
                <p>
                  Matched ways:{" "}
                  {matchedWays.length > 0 ? matchedWays.join(", ") : "none"}
                </p>
                <p>
                  Victim cue:{" "}
                  {victimCueEvent?.victimWay !== undefined
                    ? `way ${victimCueEvent.victimWay}`
                    : "none"}
                </p>
              </section>
              <ol className="timeline-list">
                {events.map((event, index) => (
                  <li key={`${event.levelId}-${event.stage}-${index}`}>
                    {event.stage} {event.levelId} {event.opKind} @{" "}
                    {event.address}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
