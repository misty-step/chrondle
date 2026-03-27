import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Scope } from "@sentry/nextjs";

const { mockCaptureCanaryException } = vi.hoisted(() => ({
  mockCaptureCanaryException: vi.fn(),
}));

// Mock Sentry before importing our module
vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: Scope) => void) => {
    const mockScope = {
      setTag: vi.fn(),
      setExtra: vi.fn(),
      setLevel: vi.fn(),
    } as unknown as Scope;
    callback(mockScope);
  }),
  setUser: vi.fn(),
  setTag: vi.fn(),
  addBreadcrumb: vi.fn(),
  replayIntegration: vi.fn(() => ({})),
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

import * as Sentry from "@sentry/nextjs";
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

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: "https://test@sentry.io/456",
          environment: "test",
          release: "abc123",
          sendDefaultPii: false,
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

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(mockCaptureCanaryException).toHaveBeenCalledWith(error, context);
    });

    it("does not throw on capture errors", () => {
      initializeClientForTests();

      const error = new Error("Test error");
      vi.mocked(Sentry.withScope).mockImplementation(() => {
        throw new Error("Capture failed");
      });

      expect(() => captureClientException(error)).not.toThrow();
      expect(mockCaptureCanaryException).toHaveBeenCalledWith(error, undefined);
    });
  });

  describe("setUserContext", () => {
    it("sets user with hashed ID", () => {
      initializeClientForTests();

      setUserContext("user_123", "signed_in");

      expect(Sentry.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f]{8}$/),
          username: expect.stringMatching(/^user_[0-9a-f]{6}$/),
        }),
      );
      expect(Sentry.setTag).toHaveBeenCalledWith("auth_state", "signed_in");
    });

    it("clears user when no ID provided", () => {
      initializeClientForTests();

      setUserContext();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });

    it("handles errors gracefully", () => {
      vi.mocked(Sentry.setUser).mockImplementation(() => {
        throw new Error("Set user failed");
      });

      expect(() => setUserContext("user_123")).not.toThrow();
    });
  });

  describe("addBreadcrumb", () => {
    it("adds breadcrumb with message and data", () => {
      initializeClientForTests();

      addBreadcrumb("Test action", { detail: "info" });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Test action",
          data: { detail: "info" },
          timestamp: expect.any(Number),
        }),
      );
    });

    it("handles errors gracefully", () => {
      vi.mocked(Sentry.addBreadcrumb).mockImplementation(() => {
        throw new Error("Add breadcrumb failed");
      });

      expect(() => addBreadcrumb("Test")).not.toThrow();
    });
  });
});
