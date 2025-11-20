import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyMutationError, safeMutation } from "../mutationErrorAdapter";
import * as sentryClient from "../sentry.client";
import { ConvexError } from "convex/values";

vi.mock("../sentry.client", () => ({
  captureClientException: vi.fn(),
}));

describe("mutationErrorAdapter", () => {
  describe("classifyMutationError", () => {
    it("classifies ConvexError as VALIDATION", () => {
      const error = new ConvexError("Invalid move");
      const result = classifyMutationError(error);

      expect(result).toEqual({
        code: "VALIDATION",
        message: "Invalid move",
        retryable: false,
        originalError: error,
      });
    });

    it("classifies auth errors as AUTH", () => {
      const error = new Error("Unauthenticated call");
      const result = classifyMutationError(error);

      expect(result.code).toBe("AUTH");
      expect(result.retryable).toBe(false);
      expect(result.message).toContain("sign in");
    });

    it("classifies network errors as NETWORK", () => {
      const error = new Error("Network request failed");
      const result = classifyMutationError(error);

      expect(result.code).toBe("NETWORK");
      expect(result.retryable).toBe(true);
      expect(result.message).toContain("Network");
    });

    it("classifies unknown errors as UNKNOWN", () => {
      const error = new Error("Something weird happened");
      const result = classifyMutationError(error);

      expect(result.code).toBe("UNKNOWN");
      expect(result.retryable).toBe(true);
    });
  });

  describe("safeMutation", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns result on success", async () => {
      const mutation = vi.fn().mockResolvedValue("success");
      const [result, error] = await safeMutation(mutation);

      expect(result).toBe("success");
      expect(error).toBeNull();
      expect(sentryClient.captureClientException).not.toHaveBeenCalled();
    });

    it("returns error tuple on failure and captures exception", async () => {
      const err = new Error("Boom");
      const mutation = vi.fn().mockRejectedValue(err);
      const context = { puzzleId: "123" };

      const [result, error] = await safeMutation(mutation, context);

      expect(result).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe("UNKNOWN");

      expect(sentryClient.captureClientException).toHaveBeenCalledWith(
        err,
        expect.objectContaining({
          tags: { mutation_code: "UNKNOWN", retryable: true },
          extras: expect.objectContaining({ puzzleId: "123" }),
        }),
      );
    });

    it("captures VALIDATION errors with info level", async () => {
      const err = new ConvexError("Invalid");
      const mutation = vi.fn().mockRejectedValue(err);

      await safeMutation(mutation);

      expect(sentryClient.captureClientException).toHaveBeenCalledWith(
        err,
        expect.objectContaining({
          level: "info",
          tags: expect.objectContaining({ mutation_code: "VALIDATION" }),
        }),
      );
    });
  });
});
