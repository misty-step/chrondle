import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isValidConvexId,
  assertConvexId,
  safeConvexId,
  validateConvexIds,
  isConvexIdValidationError,
  ConvexIdValidationError,
} from "../validation";

describe("Convex ID Validation Utilities", () => {
  const validConvexId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a"; // 32 lowercase alphanumeric
  const clerkId = "user_2gFqK5X7B8hM9nL0P3rT6vY1dZ4w"; // Clerk format - invalid
  const shortId = "jh7k3n4m8p9q2r5s"; // Too short
  const longId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a1b2c"; // Too long
  const uppercaseId = "JH7K3N4M8P9Q2R5S6T1U0V3W4X8Y9Z0A"; // Has uppercase
  const specialCharId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0!"; // Has special char

  describe("isValidConvexId", () => {
    it("should return true for valid Convex ID", () => {
      expect(isValidConvexId(validConvexId)).toBe(true);
    });

    it("should return false for Clerk ID format", () => {
      expect(isValidConvexId(clerkId)).toBe(false);
    });

    it("should return false for IDs that are too short", () => {
      expect(isValidConvexId(shortId)).toBe(false);
    });

    it("should return false for IDs that are too long", () => {
      expect(isValidConvexId(longId)).toBe(false);
    });

    it("should return false for IDs with uppercase letters", () => {
      expect(isValidConvexId(uppercaseId)).toBe(false);
    });

    it("should return false for IDs with special characters", () => {
      expect(isValidConvexId(specialCharId)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isValidConvexId(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isValidConvexId(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidConvexId("")).toBe(false);
    });

    it("should return false for non-string types", () => {
      expect(isValidConvexId(123)).toBe(false);
      expect(isValidConvexId({})).toBe(false);
      expect(isValidConvexId([])).toBe(false);
      expect(isValidConvexId(true)).toBe(false);
    });

    it("should validate all lowercase alphanumeric combinations", () => {
      const allLowerAlphaNum = "0123456789abcdefghijklmnopqrstuv";
      expect(isValidConvexId(allLowerAlphaNum)).toBe(true);
    });
  });

  describe("assertConvexId", () => {
    it("should return ID with proper typing for valid ID", () => {
      const result = assertConvexId(validConvexId, "users");
      expect(result).toBe(validConvexId);
      // TypeScript should infer this as Id<"users">
    });

    it("should throw ConvexIdValidationError for invalid ID", () => {
      expect(() => assertConvexId(clerkId, "users")).toThrow(ConvexIdValidationError);
    });

    it("should include ID and type in error message", () => {
      try {
        assertConvexId(clerkId, "puzzles");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexIdValidationError);
        if (error instanceof ConvexIdValidationError) {
          expect(error.message).toContain("puzzles");
          expect(error.message).toContain(clerkId);
          expect(error.id).toBe(clerkId);
          expect(error.type).toBe("puzzles");
        }
      }
    });

    it("should throw for empty string", () => {
      expect(() => assertConvexId("", "users")).toThrow(ConvexIdValidationError);
    });

    it("should work with different table types", () => {
      const userId = assertConvexId(validConvexId, "users");
      const puzzleId = assertConvexId(validConvexId, "puzzles");
      const playId = assertConvexId(validConvexId, "plays");

      expect(userId).toBe(validConvexId);
      expect(puzzleId).toBe(validConvexId);
      expect(playId).toBe(validConvexId);
    });
  });

  describe("safeConvexId", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let consoleSpy: any;
    let originalEnv: string | undefined;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      vi.unstubAllEnvs();
      if (originalEnv !== undefined) {
        vi.stubEnv("NODE_ENV", originalEnv);
      }
    });

    it("should return ID with proper typing for valid ID", () => {
      const result = safeConvexId(validConvexId, "users");
      expect(result).toBe(validConvexId);
    });

    it("should return null for invalid ID", () => {
      const result = safeConvexId(clerkId, "users");
      expect(result).toBeNull();
    });

    it("should return null for null input", () => {
      const result = safeConvexId(null, "users");
      expect(result).toBeNull();
    });

    it("should return null for undefined input", () => {
      const result = safeConvexId(undefined, "users");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = safeConvexId("", "users");
      expect(result).toBeNull();
    });

    it("should log warning in development for invalid ID", () => {
      vi.stubEnv("NODE_ENV", "development");

      safeConvexId(clerkId, "users");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[safeConvexId] Invalid users ID format"),
        clerkId,
        expect.any(String),
      );
    });

    it("should not log warning in production for invalid ID", () => {
      vi.stubEnv("NODE_ENV", "production");

      safeConvexId(clerkId, "users");

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should not log warning for null or undefined", () => {
      vi.stubEnv("NODE_ENV", "development");

      safeConvexId(null, "users");
      safeConvexId(undefined, "users");

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("validateConvexIds", () => {
    it("should validate multiple IDs correctly", () => {
      const result = validateConvexIds({
        validId1: validConvexId,
        validId2: validConvexId,
        invalidId1: clerkId,
        invalidId2: shortId,
        nullId: null,
        undefinedId: undefined,
      });

      expect(result.allValid).toBe(false);
      expect(result.valid).toEqual(["validId1", "validId2"]);
      expect(result.invalid).toEqual(["invalidId1", "invalidId2", "nullId", "undefinedId"]);
      expect(result.results).toEqual({
        validId1: true,
        validId2: true,
        invalidId1: false,
        invalidId2: false,
        nullId: false,
        undefinedId: false,
      });
    });

    it("should return allValid true when all IDs are valid", () => {
      const result = validateConvexIds({
        id1: validConvexId,
        id2: validConvexId,
        id3: validConvexId,
      });

      expect(result.allValid).toBe(true);
      expect(result.valid).toEqual(["id1", "id2", "id3"]);
      expect(result.invalid).toEqual([]);
    });

    it("should return allValid false when all IDs are invalid", () => {
      const result = validateConvexIds({
        id1: clerkId,
        id2: null,
        id3: "",
      });

      expect(result.allValid).toBe(false);
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual(["id1", "id2", "id3"]);
    });

    it("should handle empty object", () => {
      const result = validateConvexIds({});

      expect(result.allValid).toBe(true);
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
      expect(result.results).toEqual({});
    });
  });

  describe("isConvexIdValidationError", () => {
    it("should return true for ConvexIdValidationError instances", () => {
      const error = new ConvexIdValidationError("test", "testid", "users");
      expect(isConvexIdValidationError(error)).toBe(true);
    });

    it("should return false for other error types", () => {
      const error = new Error("regular error");
      expect(isConvexIdValidationError(error)).toBe(false);
    });

    it("should return false for non-error values", () => {
      expect(isConvexIdValidationError("string")).toBe(false);
      expect(isConvexIdValidationError(null)).toBe(false);
      expect(isConvexIdValidationError(undefined)).toBe(false);
      expect(isConvexIdValidationError({})).toBe(false);
    });

    it("should work in try-catch blocks", () => {
      try {
        assertConvexId(clerkId, "users");
      } catch (error) {
        expect(isConvexIdValidationError(error)).toBe(true);
        if (isConvexIdValidationError(error)) {
          expect(error.id).toBe(clerkId);
          expect(error.type).toBe("users");
        }
      }
    });
  });

  describe("ConvexIdValidationError", () => {
    it("should be instanceof Error", () => {
      const error = new ConvexIdValidationError("message", "id", "type");
      expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name property", () => {
      const error = new ConvexIdValidationError("message", "id", "type");
      expect(error.name).toBe("ConvexIdValidationError");
    });

    it("should store id and type properties", () => {
      const error = new ConvexIdValidationError("test message", "testId", "testType");
      expect(error.message).toBe("test message");
      expect(error.id).toBe("testId");
      expect(error.type).toBe("testType");
    });
  });
});
