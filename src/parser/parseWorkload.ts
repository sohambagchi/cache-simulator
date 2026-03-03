import { V1_LIMITS } from "../domain/constants";
import { parseNumericToken } from "./tokenizeNumber";

type ReadOp = {
  kind: "R";
  address: number;
};

type WriteOp = {
  kind: "W";
  address: number;
  value: number;
};

export type WorkloadOp = ReadOp | WriteOp;

export type WorkloadParseError = {
  line: number;
  message: string;
};

export type WorkloadParseResult = {
  ops: WorkloadOp[];
  errors: WorkloadParseError[];
};

export function parseWorkload(input: string): WorkloadParseResult {
  const ops: WorkloadOp[] = [];
  const errors: WorkloadParseError[] = [];
  const lines = input.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const trimmed = lines[index].trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const tokens = trimmed.split(/\s+/);
    const opToken = tokens[0]?.toUpperCase();

    if (opToken === "R") {
      if (tokens.length !== 2) {
        errors.push({
          line: lineNumber,
          message: `Line ${lineNumber}: expected format R <address>`,
        });
        continue;
      }

      const address = parseNumericToken(tokens[1]);
      if (address === null) {
        errors.push({
          line: lineNumber,
          message: `Line ${lineNumber}: invalid address token`,
        });
        continue;
      }

      if (address < V1_LIMITS.minAddress || address > V1_LIMITS.maxAddress) {
        errors.push({
          line: lineNumber,
          message: `Line ${lineNumber}: address out of range (expected 0..1023)`,
        });
        continue;
      }

      ops.push({ kind: "R", address });
      continue;
    }

    if (opToken === "W") {
      if (tokens.length !== 3) {
        errors.push({
          line: lineNumber,
          message: `Line ${lineNumber}: expected format W <address> <value>`,
        });
        continue;
      }

      const address = parseNumericToken(tokens[1]);
      if (address === null) {
        errors.push({
          line: lineNumber,
          message: `Line ${lineNumber}: invalid address token`,
        });
        continue;
      }

      if (address < V1_LIMITS.minAddress || address > V1_LIMITS.maxAddress) {
        errors.push({
          line: lineNumber,
          message: `Line ${lineNumber}: address out of range (expected 0..1023)`,
        });
        continue;
      }

      const value = parseNumericToken(tokens[2]);
      if (value === null) {
        errors.push({
          line: lineNumber,
          message: `Line ${lineNumber}: invalid value token`,
        });
        continue;
      }

      if (value < V1_LIMITS.minValue || value > V1_LIMITS.maxValue) {
        errors.push({
          line: lineNumber,
          message: `Line ${lineNumber}: value out of range (expected 0..255)`,
        });
        continue;
      }

      ops.push({ kind: "W", address, value });
      continue;
    }

    errors.push({
      line: lineNumber,
      message: `Line ${lineNumber}: unsupported operation '${tokens[0]}'`,
    });
  }

  return { ops, errors };
}
