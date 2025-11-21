import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkSubmissionAuth,
  handleSubmissionError,
  logSubmissionAttempt,
  type AuthState,
  type SubmissionAuthError,
} from "../gameSubmission";
import * as SentryClient from "@/observability/sentry.client";

// Mock Sentry
vi.mock("@/observability/sentry.client", () => ({
  captureClientException: vi.fn(),
}));

const captureClientExceptionMock = vi.mocked(SentryClient.captureClientException);

describe("checkSubmissionAuth", () => {
  const mockPuzzleId = "puzzle-123";
  const context = { gameMode: "order" as const, action: "commitOrdering" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scenario 1: Anonymous users", () => {
    it("allows local-only gameplay when not authenticated", () => {
      const auth: AuthState = {
        isAuthenticated: false,
        userId: null,
        isLoading: false,
      };

      const result = checkSubmissionAuth(auth, mockPuzzleId, context);

      expect(result).toEqual({
        canPersist: false,
        isAnonymous: true,
        isAuthPending: false,
      });
      expect(result.error).toBeUndefined();
    });

    it("treats unauthenticated users as anonymous even when loading", () => {
      const auth: AuthState = {
        isAuthenticated: false,
        userId: null,
        isLoading: true,
      };

      const result = checkSubmissionAuth(auth, mockPuzzleId, context);

      expect(result.isAnonymous).toBe(true);
      expect(result.canPersist).toBe(false);
    });
  });

  describe("Scenario 2: Fully authenticated users", () => {
    it("enables server persistence when authenticated with userId", () => {
      const auth: AuthState = {
        isAuthenticated: true,
        userId: "user-456",
        isLoading: false,
      };

      const result = checkSubmissionAuth(auth, mockPuzzleId, context);

      expect(result).toEqual({
        canPersist: true,
        isAnonymous: false,
        isAuthPending: false,
      });
      expect(result.error).toBeUndefined();
    });
  });

  describe("Scenario 3: Auth edge case (the bug)", () => {
    it("detects auth pending state when authenticated but userId null", () => {
      const auth: AuthState = {
        isAuthenticated: true,
        userId: null, // Clerk authenticated but Convex user creation pending
        isLoading: true,
      };

      const result = checkSubmissionAuth(auth, mockPuzzleId, context);

      expect(result.canPersist).toBe(false);
      expect(result.isAnonymous).toBe(false);
      expect(result.isAuthPending).toBe(true);
      expect(result.error).toMatchObject({
        code: "AUTH_PENDING",
        message: expect.stringContaining("Loading your account data"),
        shouldAlert: true,
        retryable: true,
      });

      // Verify Sentry capture
      expect(captureClientExceptionMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: {
            error_type: "auth_pending",
            game_mode: "order",
            action: "commitOrdering",
          },
          level: "warning",
        }),
      );
    });

    it("captures auth edge case even without context", () => {
      const auth: AuthState = {
        isAuthenticated: true,
        userId: null,
        isLoading: false,
      };

      const result = checkSubmissionAuth(auth, mockPuzzleId);

      expect(result.isAuthPending).toBe(true);
      expect(result.error?.shouldAlert).toBe(true);
    });
  });

  describe("Scenario 4: Missing puzzle data", () => {
    it("returns validation error when puzzleId is null", () => {
      const auth: AuthState = {
        isAuthenticated: true,
        userId: "user-456",
        isLoading: false,
      };

      const result = checkSubmissionAuth(auth, null, context);

      expect(result.canPersist).toBe(false);
      expect(result.error).toMatchObject({
        code: "MISSING_PUZZLE",
        message: expect.stringContaining("Puzzle data not available"),
        shouldAlert: false,
        retryable: true,
      });
    });

    it("does not alert Sentry for missing puzzle (user-driven error)", () => {
      const auth: AuthState = {
        isAuthenticated: true,
        userId: "user-456",
        isLoading: false,
      };

      checkSubmissionAuth(auth, null, context);

      // Should not capture user-driven validation errors
      expect(captureClientExceptionMock).not.toHaveBeenCalled();
    });
  });
});

describe("handleSubmissionError", () => {
  it("converts AUTH_PENDING to AUTH mutation error", () => {
    const authError: SubmissionAuthError = {
      code: "AUTH_PENDING",
      message: "Account setup in progress",
      shouldAlert: true,
      retryable: true,
    };

    const [result, error] = handleSubmissionError(authError);

    expect(result).toBeNull();
    expect(error).toMatchObject({
      code: "AUTH",
      message: "Account setup in progress",
      retryable: true,
    });
    expect(error.originalError).toBeInstanceOf(Error);
  });

  it("converts MISSING_PUZZLE to VALIDATION mutation error", () => {
    const authError: SubmissionAuthError = {
      code: "MISSING_PUZZLE",
      message: "Puzzle not found",
      shouldAlert: false,
      retryable: true,
    };

    const [result, error] = handleSubmissionError(authError);

    expect(result).toBeNull();
    expect(error).toMatchObject({
      code: "VALIDATION",
      message: "Puzzle not found",
      retryable: true,
    });
  });
});

describe("logSubmissionAttempt", () => {
  it("logs submission with all required fields", () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = {
      canPersist: true,
      isAnonymous: false,
      isAuthPending: false,
    };

    logSubmissionAttempt("classic", "submitGuess", result, "success");

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[Submission]",
      expect.objectContaining({
        gameMode: "classic",
        action: "submitGuess",
        canPersist: true,
        isAnonymous: false,
        isAuthPending: false,
        hasError: false,
        outcome: "success",
        timestamp: expect.any(String),
      }),
    );

    consoleInfoSpy.mockRestore();
  });

  it("logs auth pending errors with error code", () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = {
      canPersist: false,
      isAnonymous: false,
      isAuthPending: true,
      error: {
        code: "AUTH_PENDING" as const,
        message: "Setup in progress",
        shouldAlert: true,
        retryable: true,
      },
    };

    logSubmissionAttempt("order", "commitOrdering", result, "failure");

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[Submission]",
      expect.objectContaining({
        gameMode: "order",
        action: "commitOrdering",
        hasError: true,
        errorCode: "AUTH_PENDING",
        outcome: "failure",
      }),
    );

    consoleInfoSpy.mockRestore();
  });
});
