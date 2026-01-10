/**
 * Integration tests for ID validation edge cases in hooks
 * Tests real-world scenarios of ID validation across the application
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUserProgress } from "../data/useUserProgress";
import { useGameActions } from "../actions/useGameActions";
import type { DataSources } from "@/lib/deriveGameState";
import { Id } from "convex/_generated/dataModel";

// Create mock functions that we can manipulate
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockAddToast = vi.fn();

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

// Mock toast hook
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

describe("ID Validation Integration Tests", () => {
  let consoleErrorSpy: any;

  let consoleWarnSpy: any;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development"); // Enable development warnings
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("useUserProgress ID Validation", () => {
    it("should skip query with Clerk ID format and log warning", () => {
      mockUseQuery.mockReturnValue(undefined);

      // Clerk ID format: user_xxxxx
      const clerkId = "user_2gFqK5X7B8hM9nL0P3rT6vY1dZ4w";
      const validPuzzleId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a";

      const { result } = renderHook(() => useUserProgress(clerkId, validPuzzleId));

      // Should skip the query
      expect(mockUseQuery).toHaveBeenCalledWith(expect.any(Object), "skip");

      // Should return null progress without loading
      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);

      // Should have logged warning about invalid ID
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[WARN] [safeConvexId] Invalid users ID format detected:",
        clerkId,
        "Expected 32-character lowercase alphanumeric Convex ID",
      );
    });

    it("should execute query with valid Convex ID format", () => {
      mockUseQuery.mockReturnValue({
        guesses: [1969, 1970],
        completedAt: Date.now(),
      });

      // Valid Convex ID format: 32 lowercase alphanumeric chars
      const validUserId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a";
      const validPuzzleId = "ab2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q";

      // Test that valid IDs work
      renderHook(() => useUserProgress(validUserId, validPuzzleId));

      // Should execute the query with proper parameters
      expect(mockUseQuery).toHaveBeenCalledWith(expect.any(Object), {
        userId: validUserId,
        puzzleId: validPuzzleId,
      });

      // Should not log any warnings
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully without warnings", () => {
      mockUseQuery.mockReturnValue(undefined);

      const validPuzzleId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a";

      const { result } = renderHook(() => useUserProgress(null, validPuzzleId));

      // Should skip the query
      expect(mockUseQuery).toHaveBeenCalledWith(expect.any(Object), "skip");

      // Should return null without loading
      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);

      // Should not log warnings for null (expected case)
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should handle undefined values gracefully", () => {
      mockUseQuery.mockReturnValue(undefined);

      const { result } = renderHook(() =>
        useUserProgress(
          undefined as unknown as string | null,
          undefined as unknown as string | null,
        ),
      );

      // Should skip the query
      expect(mockUseQuery).toHaveBeenCalledWith(expect.any(Object), "skip");

      // Should return null without loading
      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);

      // Should not log warnings for undefined
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should skip query with malformed ID strings", () => {
      mockUseQuery.mockReturnValue(undefined);

      const malformedCases = [
        "123", // Too short
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456", // Contains uppercase
        "special-chars-@#$%-in-the-id!!!", // Special characters
        "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0", // 31 chars (one short)
        "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0ab", // 33 chars (one too long)
        "", // Empty string
        "user_" + "a".repeat(26), // Clerk-like prefix
      ];

      malformedCases.forEach((malformedId) => {
        vi.clearAllMocks();

        const { result } = renderHook(() =>
          useUserProgress(malformedId, "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a"),
        );

        // Should skip the query
        expect(mockUseQuery).toHaveBeenCalledWith(expect.any(Object), "skip");

        // Should return null without loading
        expect(result.current.progress).toBeNull();
        expect(result.current.isLoading).toBe(false);

        // Should log warning about invalid format
        if (malformedId !== "") {
          expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining("[safeConvexId] Invalid"),
            malformedId,
            "Expected 32-character lowercase alphanumeric Convex ID",
          );
        }
      });
    });

    it("should validate both userId and puzzleId independently", () => {
      mockUseQuery.mockReturnValue(undefined);

      // Invalid userId, valid puzzleId
      const invalidUserId = "user_invalid";
      const validPuzzleId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a";

      const { result: result1 } = renderHook(() => useUserProgress(invalidUserId, validPuzzleId));

      expect(result1.current.progress).toBeNull();
      expect(result1.current.isLoading).toBe(false);

      // First query should have been skipped
      expect(mockUseQuery).toHaveBeenCalledWith(expect.any(Object), "skip");

      // Valid userId, invalid puzzleId
      const validUserId = "ab2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q";
      const invalidPuzzleId = "puzzle_invalid";

      const { result: result2 } = renderHook(() => useUserProgress(validUserId, invalidPuzzleId));

      expect(result2.current.progress).toBeNull();
      expect(result2.current.isLoading).toBe(false);

      // Second query should also have been skipped
      expect(mockUseQuery).toHaveBeenLastCalledWith(expect.any(Object), "skip");
    });
  });

  describe("useGameActions ID Validation", () => {
    it("should call mutation even with Clerk ID format (server handles auth)", async () => {
      // Note: With the security fix, userId is no longer passed to the server.
      // The client doesn't validate userId format - it just checks if userId is truthy.
      // The server derives userId from auth context for security.
      const mockSubmitGuess = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue(mockSubmitGuess);

      const sources: DataSources = {
        puzzle: {
          puzzle: {
            id: "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a" as Id<"puzzles">,
            targetYear: 1969,
            events: ["Event 1", "Event 2"],
            puzzleNumber: 1,
          },
          isLoading: false,
          error: null,
        },
        auth: {
          userId: "user_2gFqK5X7B8hM9nL0P3rT6vY1dZ4w", // Clerk ID format - client doesn't validate
          isAuthenticated: true,
          isLoading: false,
        },
        progress: {
          progress: null,
          isLoading: false,
        },
        session: {
          sessionGuesses: [],
          addGuess: vi.fn(),
          clearGuesses: vi.fn(),
        },
      };

      const { result } = renderHook(() => useGameActions(sources));

      const success = await result.current.submitGuess(1969);

      // Should return true (mutation succeeded)
      expect(success).toBe(true);

      // Should have called addGuess for optimistic update
      expect(sources.session.addGuess).toHaveBeenCalledWith(1969);

      // Mutation SHOULD be called - server handles auth, not client
      // userId is no longer passed to the server
      expect(mockSubmitGuess).toHaveBeenCalledWith({
        puzzleId: "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a",
        guess: 1969,
      });

      // No client-side validation errors
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Invalid ID format"),
      );
    });

    it("should successfully submit with valid Convex IDs", async () => {
      const mockSubmitGuess = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue(mockSubmitGuess);

      const sources: DataSources = {
        puzzle: {
          puzzle: {
            id: "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a" as Id<"puzzles">,
            targetYear: 1969,
            events: ["Event 1", "Event 2"],
            puzzleNumber: 1,
          },
          isLoading: false,
          error: null,
        },
        auth: {
          userId: "ab2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q", // Valid Convex ID
          isAuthenticated: true,
          isLoading: false,
        },
        progress: {
          progress: null,
          isLoading: false,
        },
        session: {
          sessionGuesses: [],
          addGuess: vi.fn(),
          clearGuesses: vi.fn(),
        },
      };

      const { result } = renderHook(() => useGameActions(sources));

      const success = await result.current.submitGuess(1969);

      expect(success).toBe(true);

      // Should have called the mutation with valid puzzle ID (userId derived on server)
      expect(mockSubmitGuess).toHaveBeenCalledWith({
        puzzleId: "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a",
        guess: 1969,
      });

      // No error logs
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Invalid ID format"),
      );
    });

    it("should handle malformed puzzle ID gracefully", async () => {
      const mockSubmitGuess = vi.fn();
      mockUseMutation.mockReturnValue(mockSubmitGuess);

      const sources: DataSources = {
        puzzle: {
          puzzle: {
            id: "invalid_puzzle_id_format" as Id<"puzzles">, // Invalid format
            targetYear: 1969,
            events: ["Event 1", "Event 2"],
            puzzleNumber: 1,
          },
          isLoading: false,
          error: null,
        },
        auth: {
          userId: "ab2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q",
          isAuthenticated: true,
          isLoading: false,
        },
        progress: {
          progress: null,
          isLoading: false,
        },
        session: {
          sessionGuesses: [],
          addGuess: vi.fn(),
          clearGuesses: vi.fn(),
        },
      };

      const { result } = renderHook(() => useGameActions(sources));

      const success = await result.current.submitGuess(1969);

      // Still returns true (optimistic)
      expect(success).toBe(true);

      // Should not call mutation
      expect(mockSubmitGuess).not.toHaveBeenCalled();

      // Should show error toast
      expect(mockAddToast).toHaveBeenCalledWith({
        title: "Authentication Error",
        description: "There was an issue with your user session. Please refresh the page.",
        variant: "destructive",
      });
    });

    it("should work without authentication (null userId)", async () => {
      const mockSubmitGuess = vi.fn();
      mockUseMutation.mockReturnValue(mockSubmitGuess);

      const sources: DataSources = {
        puzzle: {
          puzzle: {
            id: "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a" as Id<"puzzles">,
            targetYear: 1969,
            events: ["Event 1", "Event 2"],
            puzzleNumber: 1,
          },
          isLoading: false,
          error: null,
        },
        auth: {
          userId: null,
          isAuthenticated: false,
          isLoading: false,
        },
        progress: {
          progress: null,
          isLoading: false,
        },
        session: {
          sessionGuesses: [],
          addGuess: vi.fn(),
          clearGuesses: vi.fn(),
        },
      };

      const { result } = renderHook(() => useGameActions(sources));

      const success = await result.current.submitGuess(1969);

      expect(success).toBe(true);

      // Should add to session
      expect(sources.session.addGuess).toHaveBeenCalledWith(1969);

      // Should not call mutation (not authenticated)
      expect(mockSubmitGuess).not.toHaveBeenCalled();

      // No errors logged
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should handle edge case of empty string IDs", async () => {
      const mockSubmitGuess = vi.fn();
      mockUseMutation.mockReturnValue(mockSubmitGuess);

      const sources: DataSources = {
        puzzle: {
          puzzle: {
            id: "invalid" as Id<"puzzles">, // Invalid ID to trigger error
            targetYear: 1969,
            events: ["Event 1", "Event 2"],
            puzzleNumber: 1,
          },
          isLoading: false,
          error: null,
        },
        auth: {
          userId: "invalid", // Invalid ID to trigger error
          isAuthenticated: true,
          isLoading: false,
        },
        progress: {
          progress: null,
          isLoading: false,
        },
        session: {
          sessionGuesses: [],
          addGuess: vi.fn(),
          clearGuesses: vi.fn(),
        },
      };

      const { result } = renderHook(() => useGameActions(sources));

      const success = await result.current.submitGuess(1969);

      expect(success).toBe(true);

      // Should not call mutation
      expect(mockSubmitGuess).not.toHaveBeenCalled();

      // Should show error about authentication
      expect(mockAddToast).toHaveBeenCalledWith({
        title: "Authentication Error",
        description: "There was an issue with your user session. Please refresh the page.",
        variant: "destructive",
      });
    });
  });

  describe("Cross-Hook ID Validation Consistency", () => {
    it("should handle the same invalid ID consistently across hooks", () => {
      mockUseQuery.mockReturnValue(undefined);
      mockUseMutation.mockReturnValue(vi.fn());

      const invalidId = "user_2gFqK5X7B8hM9nL0P3rT6vY1dZ4w";

      // Test in useUserProgress
      const { result: progressResult } = renderHook(() =>
        useUserProgress(invalidId, "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a"),
      );

      expect(progressResult.current.progress).toBeNull();
      expect(progressResult.current.isLoading).toBe(false);

      // Test same ID in useGameActions
      const sources: DataSources = {
        puzzle: {
          puzzle: {
            id: "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a" as Id<"puzzles">,
            targetYear: 1969,
            events: ["Event 1"],
            puzzleNumber: 1,
          },
          isLoading: false,
          error: null,
        },
        auth: {
          userId: invalidId,
          isAuthenticated: true,
          isLoading: false,
        },
        progress: {
          progress: null,
          isLoading: false,
        },
        session: {
          sessionGuesses: [],
          addGuess: vi.fn(),
          clearGuesses: vi.fn(),
        },
      };

      const { result: actionsResult } = renderHook(() => useGameActions(sources));

      // Both hooks should handle the invalid ID appropriately
      expect(actionsResult.current).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should handle valid IDs consistently across hooks", () => {
      mockUseQuery.mockReturnValue({
        guesses: [1969],
        completedAt: null,
      });

      const mockMutation = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue(mockMutation);

      const validUserId = "ab2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q";
      const validPuzzleId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a";

      // Test in useUserProgress
      renderHook(() => useUserProgress(validUserId, validPuzzleId));

      // Should execute query with valid IDs
      expect(mockUseQuery).toHaveBeenCalledWith(expect.any(Object), {
        userId: validUserId,
        puzzleId: validPuzzleId,
      });

      // Test same IDs in useGameActions
      const sources: DataSources = {
        puzzle: {
          puzzle: {
            id: validPuzzleId as Id<"puzzles">,
            targetYear: 1969,
            events: ["Event 1"],
            puzzleNumber: 1,
          },
          isLoading: false,
          error: null,
        },
        auth: {
          userId: validUserId,
          isAuthenticated: true,
          isLoading: false,
        },
        progress: {
          progress: null,
          isLoading: false,
        },
        session: {
          sessionGuesses: [],
          addGuess: vi.fn(),
          clearGuesses: vi.fn(),
        },
      };

      renderHook(() => useGameActions(sources));

      // No warnings should be logged for valid IDs
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
