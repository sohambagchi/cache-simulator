export function parseNumericToken(raw: string): number | null {
  const token = raw.trim();

  if (/^[+-]?0x[0-9a-f]+$/i.test(token)) {
    return Number.parseInt(token, 16);
  }

  if (/^[+-]?\d+$/.test(token)) {
    return Number.parseInt(token, 10);
  }

  return null;
}
