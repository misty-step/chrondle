/**
 * Order-preserving byte encoding of Convex values, rendered as lowercase hex.
 *
 * Two encoded keys compare (as plain strings) exactly like `compareValues`
 * from `convex/values` compares the tuples they came from. Index entries are
 * stored as these strings, so an SQLite `ORDER BY key` is Convex index order
 * and an index range is a half-open string interval.
 *
 * Type tags follow Convex's total order:
 *   undefined < null < bigint < number < boolean < string < bytes < array < object
 * Every encoding is self-delimiting and starts with a tag in 0x01..0x0a, so
 * appending 0xff to any prefix yields a bound above every key with that prefix.
 */
import type { Value } from "convex/values";

const TAG = {
  undefined: 0x01,
  null: 0x02,
  bigint: 0x03,
  number: 0x04,
  boolean: 0x05,
  string: 0x06,
  bytes: 0x07,
  array: 0x08,
  object: 0x0a,
} as const;

const END = 0x00;
const ELEMENT = 0x01;
export const KEY_MAX_SUFFIX = "ff";

const textEncoder = new TextEncoder();
const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

function pushEscaped(out: number[], bytes: Uint8Array) {
  for (const byte of bytes) {
    if (byte === 0x00) {
      out.push(0x00, 0xff);
    } else {
      out.push(byte);
    }
  }
  out.push(0x00, 0x01);
}

function encodeInto(out: number[], value: Value | undefined): void {
  if (value === undefined) {
    out.push(TAG.undefined);
    return;
  }
  if (value === null) {
    out.push(TAG.null);
    return;
  }
  if (typeof value === "bigint") {
    out.push(TAG.bigint);
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, BigInt.asUintN(64, value) ^ 0x8000000000000000n);
    out.push(...new Uint8Array(view.buffer));
    return;
  }
  if (typeof value === "number") {
    out.push(TAG.number);
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    const bytes = new Uint8Array(view.buffer);
    if (bytes[0] & 0x80) {
      for (let i = 0; i < 8; i++) bytes[i] = ~bytes[i] & 0xff;
    } else {
      bytes[0] |= 0x80;
    }
    out.push(...bytes);
    return;
  }
  if (typeof value === "boolean") {
    out.push(TAG.boolean, value ? 0x01 : 0x00);
    return;
  }
  if (typeof value === "string") {
    out.push(TAG.string);
    pushEscaped(out, textEncoder.encode(value));
    return;
  }
  if (value instanceof ArrayBuffer) {
    out.push(TAG.bytes);
    pushEscaped(out, new Uint8Array(value));
    return;
  }
  if (Array.isArray(value)) {
    out.push(TAG.array);
    for (const element of value) {
      out.push(ELEMENT);
      encodeInto(out, element);
    }
    out.push(END);
    return;
  }
  if (typeof value === "object") {
    out.push(TAG.object);
    const record = value as Record<string, Value>;
    for (const key of Object.keys(record).sort()) {
      if (record[key] === undefined) continue;
      out.push(ELEMENT);
      encodeInto(out, key);
      encodeInto(out, record[key]);
    }
    out.push(END);
    return;
  }
  throw new Error(`Cannot encode ${typeof value} as an index key`);
}

/** Encode a tuple of values (one per index field) as a hex key. */
export function encodeKey(values: ReadonlyArray<Value | undefined>): string {
  const bytes: number[] = [];
  for (const value of values) encodeInto(bytes, value);
  let hex = "";
  for (const byte of bytes) hex += HEX[byte];
  return hex;
}

/** Read a dotted field path the way Convex indexes and filters do. */
export function fieldValue(document: Record<string, unknown>, fieldPath: string): Value | undefined {
  let current: unknown = document;
  for (const part of fieldPath.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current) ||
      current instanceof ArrayBuffer
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current as Value | undefined;
}
