const isDevelopment = process.env.NODE_ENV === "development";
const isTesting = process.env.NODE_ENV === "test" || !!process.env.VITEST;

/**
 * Batched message entry for grouping similar logs
 */
interface BatchedMessage {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  args: unknown[];
  count: number;
  timestamp: number;
  stackTrace?: string;
}

/**
 * BatchedLogger class that accumulates and groups similar messages
 * to prevent console flooding during development
 */
export class BatchedLogger {
  private messageQueue: Map<string, BatchedMessage> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushDelay: number;
  private readonly enabled: boolean;

  constructor(options: { flushDelay?: number; enabled?: boolean } = {}) {
    this.flushDelay = options.flushDelay ?? 100; // Default 100ms
    this.enabled = options.enabled ?? (isDevelopment && !isTesting);
  }

  /**
   * Add a message to the batch queue
   */
  private addToBatch(level: BatchedMessage["level"], message: string, args: unknown[]): void {
    if (!this.enabled) {
      // If batching is disabled, log immediately
      this.logImmediate(level, message, args);
      return;
    }

    // Create a key for grouping similar messages
    const key = this.createMessageKey(level, message);

    const existing = this.messageQueue.get(key);
    if (existing) {
      // Increment count for duplicate messages
      existing.count++;
      existing.timestamp = Date.now(); // Update to latest timestamp
    } else {
      // Add new message to queue
      this.messageQueue.set(key, {
        level,
        message,
        args,
        count: 1,
        timestamp: Date.now(),
        stackTrace: this.extractStackTrace(),
      });
    }

    // Schedule flush if not already scheduled
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushDelay);
    }
  }

  /**
   * Create a unique key for message grouping
   */
  private createMessageKey(level: string, message: string): string {
    // Remove variable parts like timestamps, IDs, numbers to group similar messages
    const normalizedMessage = message
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, "<timestamp>")
      .replace(/\b[a-f0-9]{32}\b/g, "<id>")
      .replace(/\b\d+\b/g, "<number>")
      .trim();

    return `${level}:${normalizedMessage}`;
  }

  /**
   * Extract stack trace for debugging (only first 3 lines)
   */
  private extractStackTrace(): string | undefined {
    if (!isDevelopment) return undefined;

    const stack = new Error().stack;
    if (!stack) return undefined;

    const lines = stack.split("\n").slice(3, 6); // Skip first 3 (Error + this function)
    return lines.join("\n").trim();
  }

  /**
   * Log a message immediately without batching
   */
  private logImmediate(level: BatchedMessage["level"], message: string, args: unknown[]): void {
    const prefix = `[${level.toUpperCase()}]`;

    switch (level) {
      case "debug":
        if (isDevelopment && !isTesting) {
          console.log(prefix, message, ...args);
        }
        break;
      case "info":
        if (!isTesting) {
          console.log(prefix, message, ...args);
        }
        break;
      case "warn":
        console.warn(prefix, message, ...args);
        break;
      case "error":
        console.error(prefix, message, ...args);
        break;
    }
  }

  /**
   * Flush all batched messages to console
   */
  public flush(): void {
    if (this.messageQueue.size === 0) {
      this.flushTimer = null;
      return;
    }

    // Group messages by level for organized output
    const messagesByLevel = new Map<string, BatchedMessage[]>();

    this.messageQueue.forEach((msg) => {
      const levelMessages = messagesByLevel.get(msg.level) || [];
      levelMessages.push(msg);
      messagesByLevel.set(msg.level, levelMessages);
    });

    // Output grouped messages
    messagesByLevel.forEach((messages, level) => {
      const timestamp = new Date().toISOString().slice(11, 23);
      console.groupCollapsed(
        `[${timestamp}] Batched ${level.toUpperCase()} logs (${messages.length} unique, ${messages.reduce(
          (sum, m) => sum + m.count,
          0,
        )} total)`,
      );

      messages.forEach((msg) => {
        const countLabel = msg.count > 1 ? ` (×${msg.count})` : "";
        this.logImmediate(msg.level, msg.message + countLabel, msg.args);

        // Show collapsed stack traces for repeated errors
        if (msg.stackTrace && msg.count > 3) {
          console.groupCollapsed("Stack trace");
          console.log(msg.stackTrace);
          console.groupEnd();
        }
      });

      console.groupEnd();
    });

    // Clear the queue
    this.messageQueue.clear();
    this.flushTimer = null;
  }

  /**
   * Public methods matching the logger interface
   */
  public debug(message: string, ...args: unknown[]): void {
    this.addToBatch("debug", message, args);
  }

  public info(message: string, ...args: unknown[]): void {
    this.addToBatch("info", message, args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.addToBatch("warn", message, args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.addToBatch("error", message, args);
  }

  /**
   * Force immediate flush (useful for critical messages)
   */
  public forceFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  /**
   * Clear all pending messages without logging
   */
  public clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.messageQueue.clear();
  }
}

// Create singleton instance for batched debug logging
const batchedLogger = new BatchedLogger({
  flushDelay: 100,
  enabled: process.env.NEXT_PUBLIC_DEBUG_HOOKS === "true",
});

/**
 * Export debugLog function for use in hooks and components
 * This batches and groups similar messages to prevent console flooding
 */
export const debugLog = {
  debug: (message: string, ...args: unknown[]) => batchedLogger.debug(message, ...args),
  info: (message: string, ...args: unknown[]) => batchedLogger.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => batchedLogger.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => batchedLogger.error(message, ...args),
  flush: () => batchedLogger.forceFlush(),
  clear: () => batchedLogger.clear(),
};

// Original logger for non-batched logging
export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDevelopment && !isTesting) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (!isTesting) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};
