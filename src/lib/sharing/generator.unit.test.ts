import { describe, it, expect } from "vitest";
import { generateShareText } from "./generator";
import type { RangeGuess } from "@/types/range";

describe("generateShareText", () => {
  const mockRange: RangeGuess = {
    start: 1900,
    end: 1910,
    score: 90,
    hintsUsed: 2,
    timestamp: 123,
  };

  it("generates correct text for win", () => {
    const text = generateShareText([mockRange], 95, true, 123);
    expect(text).toContain("Chrondle #123");
    expect(text).toContain("95/100 pts · 11 yrs range");
    expect(text).toContain("💡💡⚫⚫⚫⚫");
    expect(text).toContain("chrondle.app");
  });

  it("generates correct text for loss", () => {
    const text = generateShareText([mockRange], 20, false, 123, { targetYear: 1920 });
    expect(text).toContain("Chrondle #123");
    expect(text).toContain("Missed by 10 yrs");
    expect(text).toContain("💡💡⚫⚫⚫⚫");
  });
});
