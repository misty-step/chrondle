import { compareValues, type Value } from "convex/values";
import { describe, expect, it } from "vitest";
import { decodeDocumentId, encodeDocumentId, newDocumentId } from "../src/engine/ids";
import { encodeKey } from "../src/engine/keys";

/** Deterministic PRNG so failures reproduce. */
function prng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 2 ** 32;
  };
}

const STRINGS = ["", "a", "ab", "b", "a\u0000", "a\u0000b", "\u0000", "é", "😀", "\uffff", "\ud7ff", "Z", "zz", "aé"];
const NUMBERS = [0, -0, 1, -1, 0.5, -0.5, 5e-324, -5e-324, Number.MAX_VALUE, -Number.MAX_VALUE, Infinity, -Infinity, NaN, 1969, 2.5e10];
const BIGINTS = [0n, 1n, -1n, 255n, 256n, -256n, 2n ** 63n - 1n, -(2n ** 63n)];

function randomValue(random: () => number, depth = 0): Value | undefined {
  const choose = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  switch (Math.floor(random() * (depth > 1 ? 7 : 9))) {
    case 0:
      return depth === 0 ? undefined : null;
    case 1:
      return null;
    case 2:
      return choose(BIGINTS);
    case 3:
      return random() < 0.7 ? choose(NUMBERS) : (random() - 0.5) * 10 ** Math.floor(random() * 12);
    case 4:
      return random() < 0.5;
    case 5:
      return random() < 0.6 ? choose(STRINGS) : choose(STRINGS) + choose(STRINGS);
    case 6:
      return new Uint8Array(Array.from({ length: Math.floor(random() * 4) }, () => choose([0, 1, 127, 255]))).buffer;
    case 7:
      return Array.from({ length: Math.floor(random() * 3) }, () => randomValue(random, depth + 1) ?? null);
    default: {
      const object: Record<string, Value> = {};
      for (const key of ["a", "b", "c"].filter(() => random() < 0.5)) object[key] = randomValue(random, depth + 1) ?? null;
      return object;
    }
  }
}

const sign = (n: number) => (n < 0 ? -1 : n > 0 ? 1 : 0);
const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

describe("index key encoding", () => {
  it("orders single values exactly like Convex's compareValues", () => {
    const random = prng(7);
    const values = Array.from({ length: 1500 }, () => randomValue(random));
    for (let i = 0; i < 20_000; i++) {
      const a = values[Math.floor(random() * values.length)];
      const b = values[Math.floor(random() * values.length)];
      const expected = sign(compareValues(a, b));
      if (sign(compareKeys(encodeKey([a]), encodeKey([b]))) !== expected) {
        throw new Error(`Order mismatch for ${String(a)} vs ${String(b)}: compareValues says ${expected}`);
      }
    }
  });

  it("orders multi-field index keys lexicographically by field", () => {
    const random = prng(11);
    for (let i = 0; i < 5_000; i++) {
      const a = [randomValue(random), randomValue(random), randomValue(random)];
      const b = random() < 0.5 ? [a[0], randomValue(random), randomValue(random)] : [randomValue(random), randomValue(random), randomValue(random)];
      const firstDifference = a.map((value, index) => compareValues(value, b[index])).find((result) => result !== 0) ?? 0;
      expect(sign(compareKeys(encodeKey(a), encodeKey(b)))).toBe(sign(firstDifference));
    }
  });

  it("compares strings by UTF-8 bytes, as Convex does, not UTF-16 units", () => {
    expect(compareValues("\uffff", "😀")).toBeLessThan(0);
    expect(encodeKey(["\uffff"]) < encodeKey(["😀"])).toBe(true);
  });
});

describe("Convex document IDs (v6)", () => {
  it("decodes an ID minted by Convex production", () => {
    // `_id` of the public daily puzzle served anonymously by fleet-goldfish-183 (`puzzles` table).
    expect(decodeDocumentId("jd720y3exm9fcndvj8xh0j5fe58g91mj")?.tableNumber).toBe(10003);
  });

  it("mints IDs with the same shape Convex gives that table", () => {
    expect(newDocumentId(10003)).toMatch(/^jd7[0-9a-hjkmnp-tv-z]{29}$/);
  });

  it("round-trips table numbers and internal ids", () => {
    for (const tableNumber of [1, 9, 127, 128, 10001, 10003, 16_383, 16_384, 2 ** 21, 2 ** 28]) {
      const internalId = crypto.getRandomValues(new Uint8Array(16));
      const decoded = decodeDocumentId(encodeDocumentId(tableNumber, internalId));
      expect(decoded?.tableNumber).toBe(tableNumber);
      expect([...decoded!.internalId]).toEqual([...internalId]);
    }
  });

  it("rejects corrupted, truncated and non-canonical IDs", () => {
    const id = "jd720y3exm9fcndvj8xh0j5fe58g91mj";
    for (let position = 0; position < id.length; position++) {
      const replacement = id[position] === "0" ? "1" : "0";
      expect(decodeDocumentId(id.slice(0, position) + replacement + id.slice(position + 1))).toBeNull();
    }
    expect(decodeDocumentId(id.slice(0, -1))).toBeNull();
    expect(decodeDocumentId(id.toUpperCase())).toBeNull();
    expect(decodeDocumentId("")).toBeNull();
  });
});
