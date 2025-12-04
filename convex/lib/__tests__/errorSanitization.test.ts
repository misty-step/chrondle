import { describe, expect, it } from "vitest";
import { sanitizeErrorForLogging, createSanitizedError } from "../errorSanitization";

// =============================================================================
// sanitizeErrorForLogging
// =============================================================================

describe("sanitizeErrorForLogging", () => {
  describe("API key redaction", () => {
    it("redacts OpenRouter API keys in error messages", () => {
      const errorWithKey = new Error(
        "Failed to authenticate with sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
      );

      const result = sanitizeErrorForLogging(errorWithKey);

      expect(result).toContain("sk-or-v1-***REDACTED***");
      expect(result).not.toContain("abc123");
    });

    it("redacts Bearer tokens with API keys", () => {
      const errorWithBearer = new Error(
        "Authorization failed: Bearer sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
      );

      const result = sanitizeErrorForLogging(errorWithBearer);

      expect(result).toContain("Bearer sk-or-v1-***REDACTED***");
      expect(result).not.toContain("abc123");
    });

    it("redacts multiple API keys in same message", () => {
      const errorMultiple = new Error(
        "Tried sk-or-v1-key1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa then sk-or-v1-key2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      );

      const result = sanitizeErrorForLogging(errorMultiple);

      // Should not contain the original key values
      expect(result).not.toContain("key1aaa");
      expect(result).not.toContain("key2bbb");
      // Should contain redacted patterns
      expect(result).toContain("***REDACTED***");
    });

    it("preserves error message without API keys", () => {
      const normalError = new Error("Network timeout after 30s");

      const result = sanitizeErrorForLogging(normalError);

      expect(result).toContain("Network timeout after 30s");
    });
  });

  describe("input type handling", () => {
    it("handles Error instances with stack traces", () => {
      const error = new Error("Test error");

      const result = sanitizeErrorForLogging(error);

      expect(result).toContain("Test error");
      expect(result).toContain("at "); // stack trace fragment
    });

    it("handles plain strings", () => {
      const result = sanitizeErrorForLogging("API key: sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

      expect(result).toBe("API key: sk-or-v1-***REDACTED***");
    });

    it("handles objects by JSON stringifying", () => {
      const errorObj = {
        message: "Failed",
        key: "sk-or-v1-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
      };

      const result = sanitizeErrorForLogging(errorObj);

      expect(result).toContain("sk-or-v1-***REDACTED***");
      expect(result).not.toContain("yyyyyyyy");
    });

    it("handles non-stringifiable objects", () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      const result = sanitizeErrorForLogging(circular);

      // Falls back to String(error)
      expect(result).toBeDefined();
    });

    it("handles null", () => {
      // JSON.stringify(null) = "null"
      expect(sanitizeErrorForLogging(null)).toBe("null");
    });

    it("handles numbers", () => {
      expect(sanitizeErrorForLogging(500)).toBe("500");
    });
  });

  describe("case sensitivity", () => {
    it("handles mixed case Bearer tokens", () => {
      const errorMixedCase = "BEARER sk-or-v1-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

      const result = sanitizeErrorForLogging(errorMixedCase);

      expect(result).toContain("***REDACTED***");
    });
  });
});

// =============================================================================
// createSanitizedError
// =============================================================================

describe("createSanitizedError", () => {
  it("creates Error with sanitized message", () => {
    const originalError = new Error("Failed: sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

    const sanitized = createSanitizedError(originalError);

    expect(sanitized).toBeInstanceOf(Error);
    expect(sanitized.message).toContain("sk-or-v1-***REDACTED***");
    expect(sanitized.message).not.toContain("aaaaaa");
  });

  it("preserves status code from original error", () => {
    const originalError = {
      message: "API Error",
      status: 429,
    };

    const sanitized = createSanitizedError(originalError);

    expect(sanitized.status).toBe(429);
  });

  it("handles errors without status", () => {
    const originalError = new Error("No status here");

    const sanitized = createSanitizedError(originalError);

    expect(sanitized.status).toBeUndefined();
  });

  it("handles plain string errors", () => {
    const sanitized = createSanitizedError("sk-or-v1-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb leaked");

    expect(sanitized.message).toContain("***REDACTED***");
  });
});
