import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTimeoutSignal } from "../fetch-utils";

describe("createTimeoutSignal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an abort signal and cleanup function", () => {
    const [signal, cleanup] = createTimeoutSignal(1000);

    expect(signal).toBeInstanceOf(AbortSignal);
    expect(typeof cleanup).toBe("function");
    expect(signal.aborted).toBe(false);
  });

  it("aborts the signal after the specified timeout", () => {
    const [signal] = createTimeoutSignal(5000);

    expect(signal.aborted).toBe(false);

    // Advance time by 4999ms - should not be aborted yet
    vi.advanceTimersByTime(4999);
    expect(signal.aborted).toBe(false);

    // Advance to exactly 5000ms - should be aborted
    vi.advanceTimersByTime(1);
    expect(signal.aborted).toBe(true);
  });

  it("cleanup function clears the timeout", () => {
    const [signal, cleanup] = createTimeoutSignal(5000);

    // Call cleanup before timeout
    cleanup();

    // Advance past the timeout duration
    vi.advanceTimersByTime(10000);

    // Signal should not be aborted because we cleaned up
    expect(signal.aborted).toBe(false);
  });

  it("handles immediate timeout (0ms)", () => {
    const [signal] = createTimeoutSignal(0);

    expect(signal.aborted).toBe(false);

    // Execute any pending timers
    vi.runAllTimers();

    expect(signal.aborted).toBe(true);
  });

  it("handles very long timeouts", () => {
    const [signal, cleanup] = createTimeoutSignal(86400000); // 24 hours

    expect(signal.aborted).toBe(false);

    // Advance by 23 hours - should not be aborted
    vi.advanceTimersByTime(23 * 60 * 60 * 1000);
    expect(signal.aborted).toBe(false);

    // Cleanup and verify
    cleanup();
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(signal.aborted).toBe(false);
  });

  it("can be used with fetch", async () => {
    // This test verifies the signal is compatible with the Fetch API interface
    const [signal, cleanup] = createTimeoutSignal(5000);

    // Signal has the correct shape for fetch
    expect(signal.aborted).toBe(false);
    expect(typeof signal.addEventListener).toBe("function");
    expect(typeof signal.removeEventListener).toBe("function");

    cleanup();
  });

  it("multiple createTimeoutSignal calls are independent", () => {
    const [signal1, cleanup1] = createTimeoutSignal(1000);
    const [signal2, cleanup2] = createTimeoutSignal(2000);

    // Advance 1000ms - only first should abort
    vi.advanceTimersByTime(1000);
    expect(signal1.aborted).toBe(true);
    expect(signal2.aborted).toBe(false);

    // Advance another 1000ms - second should also abort
    vi.advanceTimersByTime(1000);
    expect(signal2.aborted).toBe(true);

    cleanup1();
    cleanup2();
  });
});
