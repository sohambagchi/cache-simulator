# Workload Parser Syntax

A workload is plain text, one instruction per line.

## Instructions

| Syntax                | Description                |
| --------------------- | -------------------------- |
| `R <address>`         | Read from `address`        |
| `W <address> <value>` | Write `value` to `address` |

## Rules

- **Blank lines** — ignored
- **Comments** — lines starting with `#` are ignored; inline comments are **not** supported
- **Tokens** are whitespace-separated
- **Numbers** accept decimal (`42`) or hex (`0x2A`); negative values are not valid for address or value

## Limits

| Field     | Min | Max    |
| --------- | --- | ------ |
| `address` | `0` | `1023` |
| `value`   | `0` | `255`  |

## Example

```
# Compulsory miss, loads block
R 0

# Spatial locality — likely hits if same block
R 1
R 2

# Write then read back
W 0x10 99
R 0x10
```
