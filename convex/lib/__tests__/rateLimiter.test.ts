import { describe, it, expect, vi } from "vitest";
import { RateLimiter } from "../rateLimiter";

describe("RateLimiter", () => {
  describe("Token bucket algorithm", () => {
    it("allows requests within burst capacity immediately", async () => {
      const limiter = new RateLimiter({ tokensPerSecond: 10, burstCapacity: 20 });
      const mockFn = vi.fn().mockResolvedValue("success");

      // Execute 20 requests (at burst capacity)
      const start = Date.now();
      const promises = Array.from({ length: 20 }, () => limiter.execute(mockFn));
      const results = await Promise.all(promises);

      const duration = Date.now() - start;

      expect(results).toEqual(Array(20).fill("success"));
      expect(mockFn).toHaveBeenCalledTimes(20);
      // Should complete quickly (within burst capacity)
      expect(duration).toBeLessThan(500);
    });

    it("queues requests exceeding burst capacity", async () => {
      const limiter = new RateLimiter({ tokensPerSecond: 10, burstCapacity: 10 });
      const mockFn = vi.fn().mockResolvedValue("success");
      const executionOrder: number[] = [];

      // Execute 15 requests (exceeds burst capacity of 10)
      const promises = Array.from({ length: 15 }, (_, i) =>
        limiter.execute(async () => {
          executionOrder.push(i);
          return mockFn();
        }),
      );

      await Promise.all(promises);

      // All requests should complete
      expect(mockFn).toHaveBeenCalledTimes(15);
      // Requests should be processed in FIFO order
      expect(executionOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    });

    it("refills tokens over time at configured rate", async () => {
      // Very low rate for testing: 2 tokens/sec, burst 2
      const limiter = new RateLimiter({ tokensPerSecond: 2, burstCapacity: 2 });
      const mockFn = vi.fn().mockResolvedValue("success");

      // Use burst capacity
      await Promise.all(Array.from({ length: 2 }, () => limiter.execute(mockFn)));
      expect(mockFn).toHaveBeenCalledTimes(2);

      mockFn.mockClear();

      // Execute 2 more - should wait for refill (~1 second for 2 tokens)
      const start = Date.now();
      await Promise.all(Array.from({ length: 2 }, () => limiter.execute(mockFn)));
      const duration = Date.now() - start;

      expect(mockFn).toHaveBeenCalledTimes(2);
      // Should take at least 800ms (allowing some timing variance)
      expect(duration).toBeGreaterThanOrEqual(800);
    });
  });

  describe("Error handling", () => {
    it("propagates errors from wrapped function", async () => {
      const limiter = new RateLimiter({ tokensPerSecond: 10, burstCapacity: 20 });
      const error = new Error("Test error");
      const mockFn = vi.fn().mockRejectedValue(error);

      await expect(limiter.execute(mockFn)).rejects.toThrow("Test error");
    });

    it("continues processing queue after error", async () => {
      const limiter = new RateLimiter({ tokensPerSecond: 10, burstCapacity: 20 });
      const successFn = vi.fn().mockResolvedValue("success");
      const errorFn = vi.fn().mockRejectedValue(new Error("Test error"));

      const promises = [
        limiter.execute(errorFn).catch((e) => e.message),
        limiter.execute(successFn),
        limiter.execute(successFn),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(["Test error", "success", "success"]);
      expect(successFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Concurrency and ordering", () => {
    it("processes requests in FIFO order", async () => {
      const limiter = new RateLimiter({ tokensPerSecond: 100, burstCapacity: 10 });
      const order: number[] = [];

      const promises = Array.from({ length: 20 }, (_, i) =>
        limiter.execute(async () => {
          order.push(i);
          return i;
        }),
      );

      await Promise.all(promises);

      // Should process in submission order
      expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    });
  });

  describe("Rate limit enforcement", () => {
    it("enforces sustained rate limit", async () => {
      // Configure for 5 tokens/sec, burst 10
      const limiter = new RateLimiter({ tokensPerSecond: 5, burstCapacity: 10 });
      const mockFn = vi.fn().mockResolvedValue("success");

      // Execute 20 requests
      const start = Date.now();
      await Promise.all(Array.from({ length: 20 }, () => limiter.execute(mockFn)));
      const duration = Date.now() - start;

      expect(mockFn).toHaveBeenCalledTimes(20);
      // 10 burst + 10 more at 5/sec = ~2 seconds minimum
      expect(duration).toBeGreaterThanOrEqual(1800); // 2sec with variance
    });
  });
});
