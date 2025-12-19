import { describe, it, expect } from "vitest";
import { generateArchivalShareText, type ArchivalSharePayload } from "../shareCard";
import type { OrderAttempt } from "@/types/orderGameState";

// Helper to create mock attempts with feedback
function createAttempt(feedback: Array<"correct" | "incorrect">): OrderAttempt {
  const pairsCorrect = feedback.filter((f) => f === "correct").length;
  return {
    ordering: feedback.map((_, i) => `event-${i}`),
    feedback,
    pairsCorrect,
    totalPairs: feedback.length,
    timestamp: Date.now(),
  };
}

describe("generateArchivalShareText", () => {
  describe("header format", () => {
    it("shows puzzle number with attempt count: Chrondle: Order #247 1/3", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      expect(result).toContain("Chrondle: Order #247 1/3");
    });

    it("shows correct attempt count for multiple attempts", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 100,
        score: { attempts: 2 },
        attempts: [
          createAttempt(["incorrect", "correct", "correct", "correct", "correct", "correct"]),
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      expect(result).toContain("Chrondle: Order #100 2/3");
    });
  });

  describe("emoji grid per attempt", () => {
    it("shows 🟩 for correct positions", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      expect(result).toContain("🟩🟩🟩🟩🟩🟩");
    });

    it("shows ⬜ for incorrect positions", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt([
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
          ]),
        ],
      };
      const result = generateArchivalShareText(payload);

      expect(result).toContain("⬜⬜⬜⬜⬜⬜");
    });

    it("shows mixed emojis for partial correctness", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "incorrect", "correct", "incorrect", "correct", "incorrect"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      expect(result).toContain("🟩⬜🟩⬜🟩⬜");
    });
  });

  describe("multiple attempts", () => {
    it("shows each attempt on separate lines", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 3 },
        attempts: [
          createAttempt(["incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect"]),
          createAttempt(["correct", "incorrect", "correct", "correct", "incorrect", "correct"]),
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      // Each attempt row should be present
      expect(result).toContain("⬜⬜🟩🟩⬜⬜");
      expect(result).toContain("🟩⬜🟩🟩⬜🟩");
      expect(result).toContain("🟩🟩🟩🟩🟩🟩");
    });

    it("attempts appear in chronological order (first to last)", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 2 },
        attempts: [
          createAttempt([
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
          ]),
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      const allIncorrectIndex = result.indexOf("⬜⬜⬜⬜⬜⬜");
      const allCorrectIndex = result.indexOf("🟩🟩🟩🟩🟩🟩");
      expect(allIncorrectIndex).toBeLessThan(allCorrectIndex);
    });
  });

  describe("URL footer", () => {
    it("uses default URL when not provided", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      expect(result).toContain("chrondle.app");
    });

    it("uses custom URL when provided", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
        url: "https://custom.chrondle.app/order/247",
      };
      const result = generateArchivalShareText(payload);

      expect(result).toContain("https://custom.chrondle.app/order/247");
    });
  });

  describe("full share text examples", () => {
    it("generates correct text for perfect first-try solve", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      const expected = `Chrondle: Order #247 1/3
🟩🟩🟩🟩🟩🟩

chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for multi-attempt solve", () => {
      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 3 },
        attempts: [
          createAttempt(["incorrect", "correct", "incorrect", "correct", "incorrect", "incorrect"]),
          createAttempt(["incorrect", "correct", "correct", "correct", "incorrect", "correct"]),
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateArchivalShareText(payload);

      const expected = `Chrondle: Order #247 3/3
⬜🟩⬜🟩⬜⬜
⬜🟩🟩🟩⬜🟩
🟩🟩🟩🟩🟩🟩

chrondle.app`;

      expect(result).toBe(expected);
    });
  });

  describe("character limits", () => {
    it("keeps share text reasonable for Twitter/social media", () => {
      // Worst case: 10 attempts with max events
      const maxAttempts = Array(10)
        .fill(null)
        .map(() =>
          createAttempt([
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
          ]),
        );

      const payload: ArchivalSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 10 },
        attempts: maxAttempts,
      };
      const result = generateArchivalShareText(payload);

      // Should be reasonable for social media (under 500 chars for 10 attempts)
      expect(result.length).toBeLessThan(500);
    });
  });
});
