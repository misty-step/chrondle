import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCaptureCanaryException } = vi.hoisted(() => ({
  mockCaptureCanaryException: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../canary", () => ({
  captureCanaryException: mockCaptureCanaryException,
}));

import {
  initSentryClient,
  captureClientException,
  setUserContext,
  addBreadcrumb,
} from "../sentry.client";
import { logger } from "@/lib/logger";

describe("Sentry Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const initializeClientForTests = () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/456";
    initSentryClient();
    vi.clearAllMocks();
  };

  describe("initSentryClient", () => {
    it("does not initialize when DSN missing", () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      initSentryClient();

      // Should not call init when DSN is missing
      expect(logger.debug).toHaveBeenCalledWith(
        "[Sentry] Client DSN not configured, skipping init",
      );

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });

    it("initializes with correct config when DSN present", () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/456";
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "test";
      process.env.NEXT_PUBLIC_SENTRY_RELEASE = "abc123";

      initSentryClient();

      expect(logger.debug).toHaveBeenCalledWith(
        "[Sentry] Client initialized via Canary bridge",
        expect.objectContaining({
          environment: "test",
          release: "abc123",
        }),
      );
    });
  });

  describe("captureClientException", () => {
    it("captures exception with context", () => {
      initializeClientForTests();

      const error = new Error("Test error");
      const context = {
        tags: { operation: "test" },
        extras: { detail: "info" },
        level: "warning" as const,
      };

      captureClientException(error, context);

      expect(mockCaptureCanaryException).toHaveBeenCalledWith(error, context);
    });

    it("forwards to Canary even before init", () => {
      const error = new Error("Test error");

      expect(() => captureClientException(error)).not.toThrow();
      expect(mockCaptureCanaryException).toHaveBeenCalledWith(error, undefined);
    });
  });

  describe("setUserContext", () => {
    it("logs user context updates", () => {
      initializeClientForTests();

      setUserContext("user_123", "signed_in");

      expect(logger.debug).toHaveBeenCalledWith(
        "[Sentry] Client user context updated",
        expect.objectContaining({
          hasUserId: true,
          authState: "signed_in",
        }),
      );
    });

    it("does nothing before init", () => {
      expect(() => setUserContext("user_123")).not.toThrow();
    });

    it("handles missing user IDs", () => {
      initializeClientForTests();

      setUserContext();

      expect(logger.debug).toHaveBeenCalledWith(
        "[Sentry] Client user context updated",
        expect.objectContaining({
          hasUserId: false,
          authState: undefined,
        }),
      );
    });
  });

  describe("addBreadcrumb", () => {
    it("logs breadcrumb details after init", () => {
      initializeClientForTests();

      addBreadcrumb("Test action", { detail: "info" });

      expect(logger.debug).toHaveBeenCalledWith(
        "[Sentry] Client breadcrumb",
        expect.objectContaining({
          message: "Test action",
          data: { detail: "info" },
        }),
      );
    });

    it("does nothing before init", () => {
      expect(() => addBreadcrumb("Test")).not.toThrow();
    });
  });
});
