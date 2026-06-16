import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCaptureCanaryException } = vi.hoisted(() => ({
  mockCaptureCanaryException: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock("../canary", () => ({
  captureCanaryException: mockCaptureCanaryException,
}));

import {
  addBreadcrumb,
  captureClientException,
  captureServerException,
  setUserContext,
} from "../reporter";
import { logger } from "@/lib/logger";

describe("Canary reporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures client exceptions through Canary", () => {
    const error = new Error("Test error");
    const context = {
      tags: { operation: "test" },
      extras: { detail: "info" },
      level: "warning" as const,
    };

    captureClientException(error, context);

    expect(mockCaptureCanaryException).toHaveBeenCalledWith(error, context);
  });

  it("awaits server exception capture through Canary", async () => {
    const error = new Error("Server error");
    const context = { tags: { route: "/play" } };

    await captureServerException(error, context);

    expect(mockCaptureCanaryException).toHaveBeenCalledWith(error, context);
  });

  it("records lightweight user context breadcrumbs locally", () => {
    setUserContext("user_123", "signed_in");

    expect(logger.debug).toHaveBeenCalledWith(
      "[Canary] User context updated",
      expect.objectContaining({
        hasUserId: true,
        authState: "signed_in",
      }),
    );
  });

  it("records lightweight breadcrumbs locally", () => {
    addBreadcrumb("Test action", { detail: "info" });

    expect(logger.debug).toHaveBeenCalledWith(
      "[Canary] Breadcrumb",
      expect.objectContaining({
        message: "Test action",
        data: { detail: "info" },
      }),
    );
  });
});
