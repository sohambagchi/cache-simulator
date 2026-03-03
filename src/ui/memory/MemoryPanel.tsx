import type { SimEvent } from "../../engine/initialState";

type MemoryPanelProps = {
  memory: number[];
  events: SimEvent[];
};

export function MemoryPanel({ memory, events }: MemoryPanelProps) {
  const touchedAddresses = Array.from(new Set(events.map((event) => event.address))).sort((a, b) => a - b);

  return (
    <ul className="memory-list">
      {touchedAddresses.length === 0 ? (
        <li>No memory activity yet</li>
      ) : (
        touchedAddresses.map((address) => <li key={address}>[{address}] = {memory[address]}</li>)
      )}
    </ul>
  );
}
