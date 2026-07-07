import { describe, it, expect } from "vitest";
import { generateOrderShareText, type OrderShareInput } from "../order";
import type { OrderAttempt } from "@/types/orderGameState";

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

describe("generateOrderShareText", () => {
  describe("header (shared format family)", () => {
    it("shows the Order mode label and puzzle number: Chrondle Order #247", () => {
      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("Chrondle Order #247");
    });

    it("leaves a blank line between header and body", () => {
      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [createAttempt(["correct"])],
      };
      const result = generateOrderShareText(payload);
      expect(result.startsWith("Chrondle Order #247\n\n")).toBe(true);
    });
  });

  describe("attempt-progression grid", () => {
    it("shows 🟩 for correct positions", () => {
      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("🟩🟩🟩🟩🟩🟩");
    });

    it("shows ⬜ for incorrect positions", () => {
      const payload: OrderShareInput = {
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
      const result = generateOrderShareText(payload);

      expect(result).toContain("⬜⬜⬜⬜⬜⬜");
    });

    it("shows mixed emojis for partial correctness", () => {
      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "incorrect", "correct", "incorrect", "correct", "incorrect"]),
        ],
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("🟩⬜🟩⬜🟩⬜");
    });

    it("shows each attempt on separate lines, in chronological order", () => {
      const payload: OrderShareInput = {
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
      const result = generateOrderShareText(payload);

      const allIncorrectIndex = result.indexOf("⬜⬜⬜⬜⬜⬜");
      const allCorrectIndex = result.indexOf("🟩🟩🟩🟩🟩🟩");
      expect(allIncorrectIndex).toBeGreaterThanOrEqual(0);
      expect(allIncorrectIndex).toBeLessThan(allCorrectIndex);
    });
  });

  describe("URL footer", () => {
    it("uses default URL when not provided", () => {
      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [createAttempt(["correct"])],
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("https://chrondle.app");
    });

    it("uses custom URL when provided", () => {
      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [createAttempt(["correct"])],
        url: "https://custom.chrondle.app/order/247",
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("https://custom.chrondle.app/order/247");
    });
  });

  describe("full share text examples per outcome class", () => {
    it("generates correct text for a perfect first-try solve", () => {
      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateOrderShareText(payload);

      const expected = `Chrondle Order #247

🟩🟩🟩🟩🟩🟩

https://chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for a multi-attempt solve", () => {
      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 3 },
        attempts: [
          createAttempt(["incorrect", "correct", "incorrect", "correct", "incorrect", "incorrect"]),
          createAttempt(["incorrect", "correct", "correct", "correct", "incorrect", "correct"]),
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateOrderShareText(payload);

      const expected = `Chrondle Order #247

⬜🟩⬜🟩⬜⬜
⬜🟩🟩🟩⬜🟩
🟩🟩🟩🟩🟩🟩

https://chrondle.app`;

      expect(result).toBe(expected);
    });
  });

  describe("character limits", () => {
    it("keeps share text reasonable for social media", () => {
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

      const payload: OrderShareInput = {
        puzzleNumber: 247,
        score: { attempts: 10 },
        attempts: maxAttempts,
      };
      const result = generateOrderShareText(payload);

      expect(result.length).toBeLessThan(500);
    });
  });
});
