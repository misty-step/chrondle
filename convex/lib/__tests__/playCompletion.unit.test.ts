import { describe, expect, it } from "vitest";
import { isCompletedPlay } from "../playCompletion";

describe("isCompletedPlay", () => {
  it("returns true when completedAt is present", () => {
    expect(isCompletedPlay({ completedAt: 0 })).toBe(true);
  });

  it("returns false when completedAt is omitted", () => {
    expect(isCompletedPlay({})).toBe(false);
  });

  it("returns false when completedAt is undefined", () => {
    expect(isCompletedPlay({ completedAt: undefined })).toBe(false);
  });
});
