import { describe, it, expect } from "vitest";
import { hashIdentifier, redactLargeArray } from "../hash";

describe("hashIdentifier", () => {
  it("generates deterministic 8-char hex hash", () => {
    const hash1 = hashIdentifier("user_123");
    const hash2 = hashIdentifier("user_123");

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{8}$/);
  });

  it("generates different hashes for different inputs", () => {
    const hash1 = hashIdentifier("user_123");
    const hash2 = hashIdentifier("user_456");

    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", () => {
    const hash = hashIdentifier("");
    expect(hash).toBe("anonymous");
  });

  it("handles Clerk user IDs consistently", () => {
    const clerkId = "user_2abc123def456";
    const hash1 = hashIdentifier(clerkId);
    const hash2 = hashIdentifier(clerkId);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("redactLargeArray", () => {
  it("returns original array if within size limit", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = redactLargeArray(arr, 10);

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("redacts array if exceeds size limit", () => {
    const arr = Array.from({ length: 15 }, (_, i) => i);
    const result = redactLargeArray(arr, 10);

    expect(result).toBe("[redacted: 15 items]");
  });

  it("uses default max size of 10", () => {
    const arr = Array.from({ length: 11 }, (_, i) => i);
    const result = redactLargeArray(arr);

    expect(result).toBe("[redacted: 11 items]");
  });

  it("returns array when exactly at max size", () => {
    const arr = Array.from({ length: 10 }, (_, i) => i);
    const result = redactLargeArray(arr, 10);

    expect(result).toEqual(arr);
  });
});
