import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Scope } from "@sentry/nextjs";

// Store original env
const originalEnv = { ...process.env };

// Create mock Sentry module with resetable state
const createSentryMock = () => ({
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
});

let mockSentry = createSentryMock();

// Mock Sentry
vi.mock("@sentry/nextjs", () => mockSentry);

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  error: vi.fn(),
};
vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

describe("Sentry Server", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSentry = createSentryMock();
    vi.doMock("@sentry/nextjs", () => mockSentry);
    vi.clearAllMocks();
    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("initSentryServer", () => {
    it("does not initialize when DSN missing", async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const { initSentryServer } = await import("../sentry.server");

      initSentryServer();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[Sentry] Server DSN not configured, skipping init",
      );
      expect(mockSentry.init).not.toHaveBeenCalled();
    });

    it("initializes with correct config when DSN present", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";
      process.env.SENTRY_ENVIRONMENT = "test-server";
      process.env.SENTRY_RELEASE = "server-abc123";

      const { initSentryServer } = await import("../sentry.server");

      initSentryServer();

      expect(mockSentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: "https://test@sentry.io/789",
          environment: "test-server",
          release: "server-abc123",
        }),
      );
    });

    it("guards against re-initialization", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";

      const { initSentryServer } = await import("../sentry.server");

      initSentryServer();
      initSentryServer();

      expect(mockSentry.init).toHaveBeenCalledTimes(1);
    });

    it("handles initialization errors gracefully", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";
      mockSentry.init.mockImplementation(() => {
        throw new Error("Init failed");
      });

      const { initSentryServer } = await import("../sentry.server");

      expect(() => initSentryServer()).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[Sentry] Failed to initialize server",
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it("uses default sample rates when env vars not set", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";
      delete process.env.SENTRY_TRACES_SAMPLE_RATE;
      delete process.env.SENTRY_PROFILES_SAMPLE_RATE;

      const { initSentryServer } = await import("../sentry.server");

      initSentryServer();

      expect(mockSentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.1,
          profilesSampleRate: 0,
        }),
      );
    });
  });

  describe("captureServerException", () => {
    it("logs error when not initialized", async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const { captureServerException } = await import("../sentry.server");

      const error = new Error("Test error");
      captureServerException(error, { tags: { test: "tag" } });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[Sentry] Exception (not initialized)",
        expect.objectContaining({ error }),
      );
    });

    it("captures exception with tags and extras when initialized", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";

      const { initSentryServer, captureServerException } = await import("../sentry.server");

      initSentryServer();

      const error = new Error("Test error");
      captureServerException(error, {
        tags: { operation: "test" },
        extras: { detail: "info" },
        level: "warning",
      });

      expect(mockSentry.withScope).toHaveBeenCalled();
      expect(mockSentry.captureException).toHaveBeenCalledWith(error);
    });

    it("handles capture errors gracefully", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";
      mockSentry.withScope.mockImplementation(() => {
        throw new Error("Capture failed");
      });

      const { initSentryServer, captureServerException } = await import("../sentry.server");

      initSentryServer();
      vi.clearAllMocks(); // Clear the init logs

      expect(() => captureServerException(new Error("Test"))).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[Sentry] Failed to capture exception",
        expect.any(Object),
      );
    });
  });

  describe("setUserContext", () => {
    it("does nothing when not initialized", async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const { setUserContext } = await import("../sentry.server");

      setUserContext("user_123", "signed_in");

      expect(mockSentry.setUser).not.toHaveBeenCalled();
    });

    it("sets user with hashed ID when initialized", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";

      const { initSentryServer, setUserContext } = await import("../sentry.server");

      initSentryServer();
      setUserContext("user_123", "signed_in");

      expect(mockSentry.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f]{8}$/),
          username: expect.stringMatching(/^user_[0-9a-f]{6}$/),
        }),
      );
      expect(mockSentry.setTag).toHaveBeenCalledWith("auth_state", "signed_in");
    });

    it("clears user when no ID provided", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";

      const { initSentryServer, setUserContext } = await import("../sentry.server");

      initSentryServer();
      setUserContext();

      expect(mockSentry.setUser).toHaveBeenCalledWith(null);
    });

    it("handles errors gracefully", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";
      mockSentry.setUser.mockImplementation(() => {
        throw new Error("Set user failed");
      });

      const { initSentryServer, setUserContext } = await import("../sentry.server");

      initSentryServer();

      expect(() => setUserContext("user_123")).not.toThrow();
    });
  });

  describe("addBreadcrumb", () => {
    it("does nothing when not initialized", async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const { addBreadcrumb } = await import("../sentry.server");

      addBreadcrumb("Test message", { key: "value" });

      expect(mockSentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it("adds breadcrumb with message and data when initialized", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";

      const { initSentryServer, addBreadcrumb } = await import("../sentry.server");

      initSentryServer();
      addBreadcrumb("Test action", { detail: "info" });

      expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Test action",
          data: { detail: "info" },
          timestamp: expect.any(Number),
        }),
      );
    });

    it("handles errors gracefully", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/789";
      mockSentry.addBreadcrumb.mockImplementation(() => {
        throw new Error("Add breadcrumb failed");
      });

      const { initSentryServer, addBreadcrumb } = await import("../sentry.server");

      initSentryServer();

      expect(() => addBreadcrumb("Test")).not.toThrow();
    });
  });
});
