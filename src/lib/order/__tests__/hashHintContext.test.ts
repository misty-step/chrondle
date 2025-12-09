import { describe, it, expect } from "vitest";
import { hashHintContext } from "../hashHintContext";

describe("hashHintContext", () => {
  describe("basic hashing", () => {
    it("returns consistent hash for same input", () => {
      const hash1 = hashHintContext(["test", 123]);
      const hash2 = hashHintContext(["test", 123]);
      expect(hash1).toBe(hash2);
    });

    it("returns different hash for different input", () => {
      const hash1 = hashHintContext(["test", 123]);
      const hash2 = hashHintContext(["test", 124]);
      expect(hash1).not.toBe(hash2);
    });

    it("returns a number", () => {
      const result = hashHintContext(["test"]);
      expect(typeof result).toBe("number");
    });

    it("returns non-negative number (unsigned)", () => {
      const result = hashHintContext(["test"]);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("input types", () => {
    it("handles string inputs", () => {
      const result = hashHintContext(["hello", "world"]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("handles number inputs", () => {
      const result = hashHintContext([1, 2, 3]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("handles mixed string and number inputs", () => {
      const result = hashHintContext(["event", 1969, "hint"]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("handles empty string", () => {
      const result = hashHintContext([""]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("handles zero", () => {
      const result = hashHintContext([0]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("handles negative numbers", () => {
      const result = hashHintContext([-500, -100]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty array", () => {
      const result = hashHintContext([]);
      expect(typeof result).toBe("number");
      // FNV-1a initial hash value
      expect(result).toBe(0x811c9dc5);
    });

    it("handles single element", () => {
      const result = hashHintContext(["single"]);
      expect(typeof result).toBe("number");
      expect(result).not.toBe(0);
    });

    it("handles many elements", () => {
      const parts = Array.from({ length: 100 }, (_, i) => `part${i}`);
      const result = hashHintContext(parts);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("handles very long strings", () => {
      const longString = "a".repeat(10000);
      const result = hashHintContext([longString]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("handles special characters", () => {
      const result = hashHintContext(["!@#$%^&*()", "你好世界", "🎉"]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("order matters", () => {
      const hash1 = hashHintContext(["a", "b"]);
      const hash2 = hashHintContext(["b", "a"]);
      expect(hash1).not.toBe(hash2);
    });

    it("handles floating point numbers (converted to string)", () => {
      const result = hashHintContext([3.14159]);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("collision resistance", () => {
    it("produces unique hashes for sequential years", () => {
      const hashes = new Set<number>();
      for (let year = 1900; year <= 2000; year++) {
        hashes.add(hashHintContext([year]));
      }
      // All 101 years should have unique hashes
      expect(hashes.size).toBe(101);
    });

    it("produces unique hashes for similar strings", () => {
      const hashes = new Set<number>();
      const inputs = ["event1", "event2", "event3", "Event1", "EVENT1"];
      for (const input of inputs) {
        hashes.add(hashHintContext([input]));
      }
      expect(hashes.size).toBe(inputs.length);
    });
  });

  describe("determinism", () => {
    it("produces same hash across multiple calls", () => {
      const parts = ["puzzle", 42, "hint", 3];
      const results: number[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(hashHintContext(parts));
      }
      expect(new Set(results).size).toBe(1);
    });
  });
});
