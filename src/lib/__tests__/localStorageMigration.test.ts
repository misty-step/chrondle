import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  detectLegacyLocalStorage,
  migrateLegacyLocalStorage,
  runMigrationOnInit,
  clearAllChronldeLocalStorage,
} from "../localStorageMigration";
import { localStorageMock } from "@/test/setup";

// Mock sessionStorage similarly to localStorage from setup
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] !== undefined ? keys[index] : null;
    },
  };
})();

// Setup sessionStorage mock
Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});

// Mock logger to avoid console output in tests
vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("LocalStorage Migration", () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorageMock.clear();
    sessionStorageMock.clear();
    // Ensure localStorage is properly mocked for direct access
    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("detectLegacyLocalStorage", () => {
    it("returns false when no legacy data exists", () => {
      localStorageMock.setItem("chrondle-anonymous-id", "test-id");
      expect(detectLegacyLocalStorage()).toBe(false);
    });

    it("detects old progress keys", () => {
      localStorageMock.setItem("chrondle-progress-2024-01-01", "{}");
      expect(detectLegacyLocalStorage()).toBe(true);
    });

    it("detects old game keys", () => {
      localStorageMock.setItem("chrondle-game-state", "{}");
      expect(detectLegacyLocalStorage()).toBe(true);
    });

    it("detects old settings keys", () => {
      localStorageMock.setItem("chrondle-settings", "{}");
      expect(detectLegacyLocalStorage()).toBe(true);
    });

    it("detects old session keys", () => {
      localStorageMock.setItem("chrondle-session", "{}");
      expect(detectLegacyLocalStorage()).toBe(true);
    });

    it("detects old debug keys", () => {
      localStorageMock.setItem("chrondle-debug", "true");
      expect(detectLegacyLocalStorage()).toBe(true);
    });
  });

  describe("migrateLegacyLocalStorage", () => {
    it("returns success with no legacy data", () => {
      const result = migrateLegacyLocalStorage();
      expect(result.success).toBe(true);
      expect(result.hasLegacyData).toBe(false);
      expect(result.migratedKeys).toHaveLength(0);
    });

    it("preserves anonymous-id during migration", () => {
      const anonymousId = "anon_123456";
      localStorageMock.setItem("chrondle-anonymous-id", anonymousId);
      localStorageMock.setItem("chrondle-progress-2024-01-01", "{}");
      localStorageMock.setItem("chrondle-settings", "{}");

      const result = migrateLegacyLocalStorage();

      expect(result.success).toBe(true);
      expect(result.migratedKeys).toContain("chrondle-progress-2024-01-01");
      expect(result.migratedKeys).toContain("chrondle-settings");
      expect(localStorageMock.getItem("chrondle-anonymous-id")).toBe(anonymousId);
    });

    it("removes old progress keys", () => {
      localStorageMock.setItem(
        "chrondle-progress-2024-01-01",
        JSON.stringify({
          guesses: [1969, -776, 476],
          isGameOver: true,
        }),
      );
      localStorageMock.setItem("chrondle-progress-2024-01-02", "{}");

      const result = migrateLegacyLocalStorage();

      expect(result.success).toBe(true);
      expect(result.migratedKeys).toContain("chrondle-progress-2024-01-01");
      expect(result.migratedKeys).toContain("chrondle-progress-2024-01-02");
      expect(localStorageMock.getItem("chrondle-progress-2024-01-01")).toBeNull();
      expect(localStorageMock.getItem("chrondle-progress-2024-01-02")).toBeNull();
    });

    it("handles negative years (BC years) in old data", () => {
      const oldData = {
        guesses: [-776, -500, -100, 100, 476, 1969],
        isGameOver: false,
        puzzleYear: -776,
      };
      localStorageMock.setItem("chrondle-progress-2024-01-01", JSON.stringify(oldData));

      const result = migrateLegacyLocalStorage();

      expect(result.success).toBe(true);
      expect(result.migratedKeys).toContain("chrondle-progress-2024-01-01");
      expect(localStorageMock.getItem("chrondle-progress-2024-01-01")).toBeNull();
    });

    it("removes all legacy keys", () => {
      // Set up various legacy keys
      const legacyKeys = [
        "chrondle-settings",
        "chrondle-theme",
        "chrondle-stats",
        "chrondle-achievements",
        "chrondle-session",
        "chrondle-debug",
        "chrondle-lastPlayedDate",
        "chrondle-streak",
        "chrondle-game-123",
        "chrondle-state-456",
        "chrondle-puzzle-789",
      ];

      legacyKeys.forEach((key) => {
        localStorageMock.setItem(key, "test-value");
      });

      const result = migrateLegacyLocalStorage();

      expect(result.success).toBe(true);
      expect(result.hasLegacyData).toBe(true);
      expect(result.migratedKeys).toHaveLength(legacyKeys.length);

      // Verify all keys were removed
      legacyKeys.forEach((key) => {
        expect(localStorageMock.getItem(key)).toBeNull();
      });
    });

    it("handles malformed JSON gracefully", () => {
      localStorageMock.setItem("chrondle-progress-2024-01-01", "invalid json");
      localStorageMock.setItem("chrondle-settings", "{valid: json}");

      const result = migrateLegacyLocalStorage();

      expect(result.success).toBe(true);
      expect(result.migratedKeys).toContain("chrondle-progress-2024-01-01");
      expect(result.migratedKeys).toContain("chrondle-settings");
    });
  });

  describe("runMigrationOnInit", () => {
    it("runs migration only once per session", () => {
      localStorageMock.setItem("chrondle-progress-2024-01-01", "{}");

      // First run
      runMigrationOnInit();
      expect(localStorageMock.getItem("chrondle-progress-2024-01-01")).toBeNull();
      expect(sessionStorageMock.getItem("chrondle-migration-v2-complete")).toBe("true");

      // Add another legacy key
      localStorageMock.setItem("chrondle-progress-2024-01-02", "{}");

      // Second run - should skip
      runMigrationOnInit();
      expect(localStorageMock.getItem("chrondle-progress-2024-01-02")).toBe("{}");
    });

    it("handles sessionStorage errors gracefully", () => {
      localStorageMock.setItem("chrondle-progress-2024-01-01", "{}");

      // Mock sessionStorage.setItem to throw
      const originalSetItem = sessionStorageMock.setItem;
      sessionStorageMock.setItem = vi.fn().mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      // Should not throw
      expect(() => runMigrationOnInit()).not.toThrow();

      // Migration should still have run
      expect(localStorageMock.getItem("chrondle-progress-2024-01-01")).toBeNull();

      // Restore
      sessionStorageMock.setItem = originalSetItem;
    });
  });

  describe("clearAllChronldeLocalStorage", () => {
    it("clears all Chrondle keys except anonymous-id", () => {
      const anonymousId = "anon_test_123";

      // Set various Chrondle keys
      localStorageMock.setItem("chrondle-anonymous-id", anonymousId);
      localStorageMock.setItem("chrondle-progress-2024-01-01", "{}");
      localStorageMock.setItem("chrondle-settings", "{}");
      localStorageMock.setItem("chrondle-theme", "dark");
      localStorageMock.setItem("non-chrondle-key", "should-remain");

      clearAllChronldeLocalStorage();

      // Anonymous ID should remain
      expect(localStorageMock.getItem("chrondle-anonymous-id")).toBe(anonymousId);

      // Non-Chrondle keys should remain
      expect(localStorageMock.getItem("non-chrondle-key")).toBe("should-remain");

      // All other Chrondle keys should be removed
      expect(localStorageMock.getItem("chrondle-progress-2024-01-01")).toBeNull();
      expect(localStorageMock.getItem("chrondle-settings")).toBeNull();
      expect(localStorageMock.getItem("chrondle-theme")).toBeNull();
    });
  });
});
