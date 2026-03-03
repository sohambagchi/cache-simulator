export const TOTAL_SIZE_OPTIONS = Array.from(
  { length: 24 },
  (_, index) => 2 ** (index + 2)
);
export const BLOCK_SIZE_OPTIONS = Array.from(
  { length: 4 },
  (_, index) => 2 ** (index + 2)
);
export const GEOMETRY_SIZE_OPTIONS = TOTAL_SIZE_OPTIONS;
export const ASSOCIATIVITY_OPTIONS = Array.from(
  { length: 11 },
  (_, index) => 2 ** index
);

export function toSliderIndex(value: number, options: number[]): number {
  const index = options.indexOf(value);
  return index >= 0 ? index : 0;
}

export function fromSliderIndex(index: number, options: number[]): number {
  const bounded = Math.min(options.length - 1, Math.max(0, index));
  return options[bounded];
}

export function formatBytesLabel(value: number): string {
  if (value >= 1024 * 1024) return `${value / (1024 * 1024)} MB`;
  if (value >= 1024) return `${value / 1024} KB`;
  return `${value} B`;
}

export function formatWaysLabel(value: number): string {
  return `${value}-way`;
}
