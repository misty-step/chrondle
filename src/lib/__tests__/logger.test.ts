import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BatchedLogger, debugLog, logger } from "../logger";

// =============================================================================
// BatchedLogger
// =============================================================================

describe("BatchedLogger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    vi.spyOn(console, "groupEnd").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Constructor defaults
  // ===========================================================================

  describe("constructor", () => {
    it("uses default flushDelay of 100ms", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.debug("test message");

      // Should not flush immediately
      vi.advanceTimersByTime(50);
      expect(console.groupCollapsed).not.toHaveBeenCalled();

      // Should flush after 100ms
      vi.advanceTimersByTime(51);
      expect(console.groupCollapsed).toHaveBeenCalled();
    });

    it("accepts custom flushDelay", () => {
      const batchedLogger = new BatchedLogger({ flushDelay: 200, enabled: true });

      batchedLogger.debug("test message");

      vi.advanceTimersByTime(150);
      expect(console.groupCollapsed).not.toHaveBeenCalled();

      vi.advanceTimersByTime(51);
      expect(console.groupCollapsed).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Immediate logging (disabled batching)
  // ===========================================================================

  describe("immediate logging", () => {
    it("logs warn immediately when batching disabled", () => {
      const batchedLogger = new BatchedLogger({ enabled: false });

      batchedLogger.warn("warning message");

      expect(console.warn).toHaveBeenCalledWith("[WARN]", "warning message");
    });

    it("logs error immediately when batching disabled", () => {
      const batchedLogger = new BatchedLogger({ enabled: false });

      batchedLogger.error("error message");

      expect(console.error).toHaveBeenCalledWith("[ERROR]", "error message");
    });
  });

  // ===========================================================================
  // Batched logging (enabled)
  // ===========================================================================

  describe("batched logging", () => {
    it("batches multiple messages together", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.debug("message 1");
      batchedLogger.debug("message 2");
      batchedLogger.debug("message 3");

      // Nothing logged yet
      expect(console.groupCollapsed).not.toHaveBeenCalled();

      // Flush after delay
      vi.advanceTimersByTime(100);
      expect(console.groupCollapsed).toHaveBeenCalled();
    });

    it("groups duplicate messages by count", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.warn("same message");
      batchedLogger.warn("same message");
      batchedLogger.warn("same message");

      vi.advanceTimersByTime(100);

      // Should show count in the log
      expect(console.warn).toHaveBeenCalledWith("[WARN]", "same message (×3)");
    });

    it("separates different message levels", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.warn("warning");
      batchedLogger.error("error");

      vi.advanceTimersByTime(100);

      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Message key normalization
  // ===========================================================================

  describe("message key normalization", () => {
    it("groups messages with different numbers as same key", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.warn("Request 123 failed");
      batchedLogger.warn("Request 456 failed");
      batchedLogger.warn("Request 789 failed");

      vi.advanceTimersByTime(100);

      // Should be grouped as one message with count 3
      expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("groups messages with different timestamps as same key", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.warn("Event at 2025-01-15T12:00:00");
      batchedLogger.warn("Event at 2025-01-15T13:00:00");

      vi.advanceTimersByTime(100);

      expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("groups messages with different hex IDs as same key", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.error("Failed for user a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4");
      batchedLogger.error("Failed for user ffffffffffffffffffffffffffffffff");

      vi.advanceTimersByTime(100);

      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // flush()
  // ===========================================================================

  describe("flush", () => {
    it("does nothing when queue is empty", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.flush();

      expect(console.groupCollapsed).not.toHaveBeenCalled();
    });

    it("clears the queue after flushing", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.warn("message");
      vi.advanceTimersByTime(100);

      // First flush happened
      expect(console.warn).toHaveBeenCalledTimes(1);

      // Second flush should have nothing
      batchedLogger.flush();
      expect(console.warn).toHaveBeenCalledTimes(1); // No additional calls
    });
  });

  // ===========================================================================
  // forceFlush()
  // ===========================================================================

  describe("forceFlush", () => {
    it("flushes immediately without waiting for delay", () => {
      const batchedLogger = new BatchedLogger({ enabled: true, flushDelay: 1000 });

      batchedLogger.warn("message");
      batchedLogger.forceFlush();

      expect(console.warn).toHaveBeenCalled();
    });

    it("cancels pending flush timer", () => {
      const batchedLogger = new BatchedLogger({ enabled: true, flushDelay: 1000 });

      batchedLogger.warn("message");
      batchedLogger.forceFlush();

      // Advance past the original timer
      vi.advanceTimersByTime(1000);

      // Should only have been called once (from forceFlush)
      expect(console.warn).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // clear()
  // ===========================================================================

  describe("clear", () => {
    it("removes pending messages without logging", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.warn("message");
      batchedLogger.clear();

      vi.advanceTimersByTime(100);

      expect(console.warn).not.toHaveBeenCalled();
    });

    it("cancels pending flush timer", () => {
      const batchedLogger = new BatchedLogger({ enabled: true });

      batchedLogger.warn("message");
      batchedLogger.clear();

      // Adding new message after clear
      batchedLogger.warn("new message");
      vi.advanceTimersByTime(100);

      // Only the new message should be logged
      expect(console.warn).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Log levels
  // ===========================================================================

  describe("log levels", () => {
    it("handles debug level", () => {
      const batchedLogger = new BatchedLogger({ enabled: false });

      // In test environment, debug doesn't log (isTesting check)
      batchedLogger.debug("debug message");
      // No assertion needed - just testing it doesn't throw
    });

    it("handles info level", () => {
      const batchedLogger = new BatchedLogger({ enabled: false });

      // In test environment, info doesn't log (isTesting check)
      batchedLogger.info("info message");
      // No assertion needed - just testing it doesn't throw
    });

    it("handles warn level", () => {
      const batchedLogger = new BatchedLogger({ enabled: false });

      batchedLogger.warn("warn message");

      expect(console.warn).toHaveBeenCalled();
    });

    it("handles error level", () => {
      const batchedLogger = new BatchedLogger({ enabled: false });

      batchedLogger.error("error message");

      expect(console.error).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// logger singleton
// =============================================================================

describe("logger singleton", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warn logs with [WARN] prefix", () => {
    logger.warn("test warning");

    expect(console.warn).toHaveBeenCalledWith("[WARN] test warning");
  });

  it("error logs with [ERROR] prefix", () => {
    logger.error("test error");

    expect(console.error).toHaveBeenCalledWith("[ERROR] test error");
  });

  it("passes additional arguments to console", () => {
    logger.warn("message", { detail: "value" });

    expect(console.warn).toHaveBeenCalledWith("[WARN] message", { detail: "value" });
  });

  it("error passes additional arguments", () => {
    logger.error("message", new Error("test"));

    expect(console.error).toHaveBeenCalledWith("[ERROR] message", expect.any(Error));
  });
});

// =============================================================================
// debugLog wrapper
// =============================================================================

describe("debugLog wrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    debugLog.clear();
  });

  it("exposes debug method", () => {
    expect(typeof debugLog.debug).toBe("function");
  });

  it("exposes info method", () => {
    expect(typeof debugLog.info).toBe("function");
  });

  it("exposes warn method", () => {
    expect(typeof debugLog.warn).toBe("function");
  });

  it("exposes error method", () => {
    expect(typeof debugLog.error).toBe("function");
  });

  it("exposes flush method", () => {
    expect(typeof debugLog.flush).toBe("function");
  });

  it("exposes clear method", () => {
    expect(typeof debugLog.clear).toBe("function");
  });
});
