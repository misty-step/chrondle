/**
 * Tests for secure localStorage utility with validation and injection prevention
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  secureGetItem,
  secureSetItem,
  secureClearPrefix,
  createTypedStorage,
  anonymousGameStateSchema,
  themePreferencesSchema,
} from "../secureStorage";

describe("secureStorage", () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      get length() {
        return Object.keys(store).length;
      },
      key: vi.fn((index: number) => {
        const keys = Object.keys(store);
        return keys[index] || null;
      }),
    };
  })();

  beforeEach(() => {
    // Clear mock before each test
    localStorageMock.clear();
    vi.clearAllMocks();

    // Setup localStorage mock
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  describe("Key Validation", () => {
    it("should reject invalid keys", () => {
      const invalidKeys = [
        "__proto__",
        "constructor",
        "prototype",
        "key with spaces",
        "key/with/slashes",
        "key.with.dots",
        "key<with>brackets",
        "key;with;semicolons",
        "key'with'quotes",
        'key"with"quotes',
        "a".repeat(101), // Too long
        "",
        "key\nwith\nnewlines",
        "key\twith\ttabs",
      ];

      invalidKeys.forEach((key) => {
        const result = secureSetItem(key, { test: "data" });
        expect(result).toBe(false);
        expect(localStorageMock.setItem).not.toHaveBeenCalledWith(key, expect.anything());
      });
    });

    it("should accept valid keys", () => {
      const validKeys = [
        "chrondle-game-state",
        "user_preferences",
        "theme-mode",
        "session123",
        "a".repeat(100), // Max length
        "UPPERCASE",
        "lowercase",
        "MixedCase",
        "with-dashes",
        "with_underscores",
        "with123numbers",
      ];

      validKeys.forEach((key) => {
        const result = secureSetItem(key, { test: "data" });
        expect(result).toBe(true);
      });
    });
  });

  describe("JSON Injection Prevention", () => {
    it("should prevent prototype pollution attacks", () => {
      const maliciousPayloads = [
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}',
        '{"prototype": {"polluted": true}}',
      ];

      maliciousPayloads.forEach((payload) => {
        localStorageMock.setItem("test-key", payload);
        const result = secureGetItem("test-key");

        // Should either return null or safe object without prototype pollution
        if (result !== null) {
          expect(result).not.toHaveProperty("__proto__");
          expect(result).not.toHaveProperty("constructor");
          expect(result).not.toHaveProperty("prototype");
        }
      });

      // Verify prototype wasn't polluted
      interface TestObject {
        isAdmin?: boolean;
        polluted?: boolean;
      }
      const obj: TestObject = {};
      expect(obj.isAdmin).toBeUndefined();
      expect(obj.polluted).toBeUndefined();
    });

    it("should reject deeply nested objects to prevent DoS", () => {
      const createDeeplyNested = (depth: number): unknown => {
        if (depth === 0) return "value";
        return { nested: createDeeplyNested(depth - 1) };
      };

      // This should be rejected (too deep)
      const tooDeep = createDeeplyNested(10);
      const result = secureSetItem("deep-key", tooDeep);
      expect(result).toBe(false);

      // This should be accepted (within limits)
      const acceptable = createDeeplyNested(4);
      const result2 = secureSetItem("shallow-key", acceptable);
      expect(result2).toBe(true);
    });

    it("should reject functions in JSON", () => {
      const payloadWithFunction = {
        normal: "data",
        evil: "function() { alert('XSS'); }",
      };

      // Try to store function-like string
      const result = secureSetItem("func-key", payloadWithFunction);
      expect(result).toBe(true); // Should store as string

      // Manually inject actual function into localStorage
      localStorageMock.setItem("func-key", '{"data": "test", "func": function() {}}');
      const retrieved = secureGetItem("func-key");
      expect(retrieved).toBe(null); // Should reject invalid JSON
    });

    it("should reject oversized values", () => {
      const largeString = "x".repeat(200_000); // 200KB
      const result = secureSetItem("large-key", { data: largeString });
      expect(result).toBe(false);
    });

    it("should reject arrays that are too long", () => {
      const longArray = new Array(2000).fill("item");
      const result = secureSetItem("array-key", longArray);
      expect(result).toBe(false);

      const acceptableArray = new Array(500).fill("item");
      const result2 = secureSetItem("array-key", acceptableArray);
      expect(result2).toBe(true);
    });
  });

  describe("Schema Validation", () => {
    it("should validate anonymous game state schema", () => {
      const validState = {
        puzzleId: "puzzle-123",
        guesses: [1969, 1970, 1971],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      };

      const result = secureSetItem("game-state", validState, anonymousGameStateSchema);
      expect(result).toBe(true);

      const retrieved = secureGetItem("game-state", anonymousGameStateSchema);
      expect(retrieved).toEqual(validState);
    });

    it("should reject invalid game state", () => {
      const invalidStates = [
        {
          // Missing puzzleId
          guesses: [1969],
          isComplete: false,
          hasWon: false,
          timestamp: Date.now(),
        },
        {
          puzzleId: "puzzle-123",
          guesses: "not-an-array", // Wrong type
          isComplete: false,
          hasWon: false,
          timestamp: Date.now(),
        },
        {
          puzzleId: "puzzle-123",
          guesses: [1969, 1970, 1971, 1972, 1973, 1974, 1975], // Too many guesses
          isComplete: false,
          hasWon: false,
          timestamp: Date.now(),
        },
        {
          puzzleId: "",
          guesses: [],
          isComplete: "yes", // Wrong type
          hasWon: false,
          timestamp: Date.now(),
        },
        {
          puzzleId: "x".repeat(101), // Too long
          guesses: [],
          isComplete: false,
          hasWon: false,
          timestamp: Date.now(),
        },
      ];

      invalidStates.forEach((state) => {
        const result = secureSetItem("game-state", state, anonymousGameStateSchema);
        expect(result).toBe(false);
      });
    });

    it("should validate theme preferences schema", () => {
      const validTheme = {
        mode: "dark" as const,
        timestamp: Date.now(),
      };

      const result = secureSetItem("theme", validTheme, themePreferencesSchema);
      expect(result).toBe(true);

      const retrieved = secureGetItem("theme", themePreferencesSchema);
      expect(retrieved).toEqual(validTheme);
    });
  });

  describe("Typed Storage Interface", () => {
    it("should create typed storage with validation", () => {
      const gameStorage = createTypedStorage("game", anonymousGameStateSchema);

      const validState = {
        puzzleId: "puzzle-456",
        guesses: [2000, 2001],
        isComplete: true,
        hasWon: true,
        timestamp: Date.now(),
      };

      // Set valid state
      const setResult = gameStorage.set(validState);
      expect(setResult).toBe(true);

      // Get state
      const retrieved = gameStorage.get();
      expect(retrieved).toEqual(validState);

      // Check existence
      expect(gameStorage.exists()).toBe(true);

      // Remove state
      const removeResult = gameStorage.remove();
      expect(removeResult).toBe(true);
      expect(gameStorage.exists()).toBe(false);
    });

    it("should handle invalid data gracefully", () => {
      const gameStorage = createTypedStorage("game", anonymousGameStateSchema);

      // Manually inject invalid data
      localStorageMock.setItem("game", '{"invalid": "data"}');

      // Should return null for invalid data
      const retrieved = gameStorage.get();
      expect(retrieved).toBe(null);
    });
  });

  describe("Secure Clear Prefix", () => {
    it("should clear items with matching prefix", () => {
      localStorageMock.setItem("chrondle-game-1", "data1");
      localStorageMock.setItem("chrondle-game-2", "data2");
      localStorageMock.setItem("chrondle-theme", "theme");
      localStorageMock.setItem("other-key", "other");

      const result = secureClearPrefix("chrondle-game");
      expect(result).toBe(true);

      expect(localStorageMock.getItem("chrondle-game-1")).toBe(null);
      expect(localStorageMock.getItem("chrondle-game-2")).toBe(null);
      expect(localStorageMock.getItem("chrondle-theme")).toBe("theme");
      expect(localStorageMock.getItem("other-key")).toBe("other");
    });

    it("should reject invalid prefixes", () => {
      const result = secureClearPrefix("invalid prefix with spaces");
      expect(result).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle localStorage quota exceeded", () => {
      // Mock quota exceeded error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("QuotaExceededError");
      });

      const result = secureSetItem("key", { data: "value" });
      expect(result).toBe(false);
    });

    it("should handle corrupted JSON gracefully", () => {
      localStorageMock.setItem("corrupt-key", "not-valid-json{");
      const result = secureGetItem("corrupt-key");
      expect(result).toBe(null);
    });

    it("should handle localStorage being unavailable", () => {
      // Temporarily make localStorage unavailable
      const originalLocalStorage = window.localStorage;
      Object.defineProperty(window, "localStorage", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = secureSetItem("key", { data: "value" });
      expect(result).toBe(false);

      const retrieved = secureGetItem("key");
      expect(retrieved).toBe(null);

      // Restore localStorage mock
      Object.defineProperty(window, "localStorage", {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("XSS Prevention", () => {
    it("should safely handle HTML-like content", () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror="alert(1)">',
        "javascript:alert(1)",
        '<svg onload="alert(1)">',
      ];

      xssPayloads.forEach((payload) => {
        const result = secureSetItem("xss-key", { content: payload });
        expect(result).toBe(true);

        const retrieved = secureGetItem<{ content: string }>("xss-key");
        expect(retrieved).not.toBe(null);
        expect(retrieved?.content).toBe(payload); // Should be stored as string, not executed
      });
    });

    it("should handle special characters safely", () => {
      const specialChars = {
        quotes: "\"'`",
        brackets: "{}[]()<>",
        escapes: "\\n\\r\\t\\0",
        unicode: "🎮 ñ 中文 العربية",
      };

      const result = secureSetItem("special-key", specialChars);
      expect(result).toBe(true);

      const retrieved = secureGetItem("special-key");
      expect(retrieved).toEqual(specialChars);
    });
  });

  describe("Data Integrity", () => {
    it("should preserve data types correctly", () => {
      const testData = {
        string: "text",
        number: 123.456,
        integer: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: {
          deep: {
            value: "test",
          },
        },
      };

      const result = secureSetItem("types-key", testData);
      expect(result).toBe(true);

      const retrieved = secureGetItem<typeof testData>("types-key");
      expect(retrieved).toEqual(testData);
      if (retrieved) {
        expect(typeof retrieved.number).toBe("number");
        expect(typeof retrieved.boolean).toBe("boolean");
        expect(Array.isArray(retrieved.array)).toBe(true);
      }
    });

    it("should handle edge case numbers", () => {
      const numbers = {
        zero: 0,
        negative: -1,
        large: Number.MAX_SAFE_INTEGER,
        small: Number.MIN_SAFE_INTEGER,
        decimal: 0.123456789,
      };

      const result = secureSetItem("numbers-key", numbers);
      expect(result).toBe(true);

      const retrieved = secureGetItem("numbers-key");
      expect(retrieved).toEqual(numbers);
    });
  });
});
