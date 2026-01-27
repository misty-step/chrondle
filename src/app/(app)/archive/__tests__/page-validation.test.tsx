import { describe, expect, it } from "vitest";

// Extract the validation logic for testing
function validatePageParam(pageParam: string | undefined): number {
  const DEFAULT_PAGE = 1;
  const MAX_PAGE = 10000;

  if (!pageParam) return DEFAULT_PAGE;

  // Trim whitespace
  const trimmed = pageParam.trim();
  if (!trimmed) return DEFAULT_PAGE;

  // Reject if contains non-digit characters (except leading +)
  // This prevents "12abc", "1e10", etc.
  if (!/^\+?\d+$/.test(trimmed)) return DEFAULT_PAGE;

  // Parse as integer
  const parsed = parseInt(trimmed, 10);

  // Check for NaN, negative, or unreasonably large values
  if (isNaN(parsed) || parsed < 1) return DEFAULT_PAGE;
  if (parsed > MAX_PAGE) return MAX_PAGE;

  return parsed;
}

describe("Archive Page Parameter Validation", () => {
  describe("validatePageParam", () => {
    it("should return default page for undefined", () => {
      expect(validatePageParam(undefined)).toBe(1);
    });

    it("should return default page for empty string", () => {
      expect(validatePageParam("")).toBe(1);
    });

    it("should return default page for non-numeric values", () => {
      expect(validatePageParam("abc")).toBe(1);
      expect(validatePageParam("12abc")).toBe(1);
      expect(validatePageParam("1.5.2")).toBe(1);
    });

    it("should return default page for negative numbers", () => {
      expect(validatePageParam("-1")).toBe(1);
      expect(validatePageParam("-100")).toBe(1);
      expect(validatePageParam("-999999")).toBe(1);
    });

    it("should return default page for zero", () => {
      expect(validatePageParam("0")).toBe(1);
    });

    it("should accept valid positive integers", () => {
      expect(validatePageParam("1")).toBe(1);
      expect(validatePageParam("2")).toBe(2);
      expect(validatePageParam("50")).toBe(50);
      expect(validatePageParam("999")).toBe(999);
    });

    it("should clamp to maximum for huge numbers", () => {
      expect(validatePageParam("10001")).toBe(10000);
      expect(validatePageParam("99999999")).toBe(10000);
      expect(validatePageParam("1e10")).toBe(1); // Scientific notation rejected
    });

    it("should reject decimal numbers", () => {
      expect(validatePageParam("1.5")).toBe(1);
      expect(validatePageParam("2.9")).toBe(1);
      expect(validatePageParam("10.1")).toBe(1);
    });

    it("should handle special numeric values", () => {
      expect(validatePageParam("NaN")).toBe(1);
      expect(validatePageParam("Infinity")).toBe(1);
      expect(validatePageParam("-Infinity")).toBe(1);
    });

    it("should handle malicious inputs", () => {
      expect(validatePageParam("' OR 1=1 --")).toBe(1);
      expect(validatePageParam("<script>alert('xss')</script>")).toBe(1);
      expect(validatePageParam("../../etc/passwd")).toBe(1);
      expect(validatePageParam("%00")).toBe(1);
      expect(validatePageParam("0x1234")).toBe(1);
      expect(validatePageParam("1e308")).toBe(1); // Scientific notation rejected
    });

    it("should handle Unicode and special characters", () => {
      expect(validatePageParam("①")).toBe(1); // Unicode digit
      expect(validatePageParam("۱")).toBe(1); // Arabic-Indic digit
      expect(validatePageParam("🔢")).toBe(1); // Emoji
      expect(validatePageParam("\n1\n")).toBe(1);
      expect(validatePageParam(" 5 ")).toBe(5);
    });
  });
});
