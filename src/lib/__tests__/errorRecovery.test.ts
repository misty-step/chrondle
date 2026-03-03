import { describe, expect, it } from "vitest";
import { classifyLoadError, getAutoRetryDelayMs } from "@/lib/errorRecovery";

describe("errorRecovery", () => {
  it("marks transient network failures as recoverable", () => {
    const plan = classifyLoadError("Network timeout while fetching puzzle");
    expect(plan.recoverability).toBe("recoverable");
    expect(plan.canAutoRetry).toBe(true);
  });

  it("marks missing puzzle errors as unrecoverable", () => {
    const plan = classifyLoadError("Order puzzle #42 not found");
    expect(plan.recoverability).toBe("unrecoverable");
    expect(plan.canAutoRetry).toBe(false);
  });

  it("returns bounded exponential backoff values", () => {
    const first = getAutoRetryDelayMs(0);
    const second = getAutoRetryDelayMs(1);
    const third = getAutoRetryDelayMs(2);

    expect(first).toBeGreaterThanOrEqual(750);
    expect(first).toBeLessThanOrEqual(4000);
    expect(second).toBeGreaterThanOrEqual(1500);
    expect(second).toBeLessThanOrEqual(4000);
    expect(third).toBeGreaterThanOrEqual(3000);
    expect(third).toBeLessThanOrEqual(4000);
  });
});
