// Fetch utilities for timeout and AbortSignal management
// Cross-platform compatibility for environments without AbortSignal.timeout()

/**
 * Creates a timeout signal that automatically aborts after the specified duration.
 * Compatible with all JavaScript runtimes (Node.js, Edge Runtime, browsers).
 *
 * @param timeoutMs - Timeout duration in milliseconds
 * @returns [AbortSignal, cleanup function] - Signal to use with fetch and cleanup function to call
 */
export function createTimeoutSignal(timeoutMs: number): [AbortSignal, () => void] {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const cleanup = () => {
    clearTimeout(timeoutId);
  };

  // Auto-cleanup when signal is aborted for other reasons
  controller.signal.addEventListener("abort", cleanup, { once: true });

  return [controller.signal, cleanup];
}
