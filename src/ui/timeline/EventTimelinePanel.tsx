import type { SimEvent } from "../../engine/initialState";

type EventTimelinePanelProps = {
  events: SimEvent[];
};

export function EventTimelinePanel({ events }: EventTimelinePanelProps) {
  if (events.length === 0) {
    return <p>No events yet</p>;
  }

  return (
    <ol className="timeline-list">
      {events.map((event, index) => (
        <li key={`${event.levelId}-${event.stage}-${index}`}>
          {event.stage} {event.levelId} {event.opKind} @ {event.address}
        </li>
      ))}
    </ol>
  );
}
