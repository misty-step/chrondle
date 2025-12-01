/**
 * Token bucket rate limiter for controlling request throughput.
 *
 * Prevents overwhelming external APIs (OpenRouter) with burst traffic while
 * allowing smooth sustained throughput. Implements classic token bucket algorithm
 * with FIFO queue for fair request ordering.
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter({ tokensPerSecond: 10, burstCapacity: 20 });
 * await limiter.execute(() => callExternalAPI());
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private readonly tokensPerSecond: number;
  private readonly burstCapacity: number;
  private lastRefill: number;
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private processing = false;

  constructor(options: { tokensPerSecond: number; burstCapacity: number }) {
    this.tokensPerSecond = options.tokensPerSecond;
    this.burstCapacity = options.burstCapacity;
    this.tokens = options.burstCapacity; // Start with full bucket
    this.lastRefill = Date.now();
  }

  /**
   * Execute async function with rate limiting.
   * Queues request if rate limit exceeded, processes in FIFO order.
   *
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      this.refillTokens();

      if (this.tokens >= 1) {
        // Consume token and execute request
        this.tokens -= 1;
        const item = this.queue.shift();
        if (!item) break;

        // Execute without awaiting - fire and forget for concurrency
        item
          .fn()
          .then((result) => item.resolve(result))
          .catch((error) => item.reject(error));
      } else {
        // No tokens available - wait for refill
        const waitTime = this.calculateWaitTime();
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.processing = false;
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.tokensPerSecond;

    this.tokens = Math.min(this.burstCapacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private calculateWaitTime(): number {
    // Time to accumulate 1 token
    return (1 / this.tokensPerSecond) * 1000; // milliseconds
  }
}
