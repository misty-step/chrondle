import { describe, it, expect } from "vitest";
import { generateOrderShareText, type OrderSharePayload } from "../order";
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
    it("shows puzzle number: Chrondle Order #247", () => {
      const payload: OrderSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      const result = generateOrderShareText(payload);
      expect(result.startsWith("Chrondle Order #247\n\n")).toBe(true);
    });

    it("ends with the chrondle.app footer", () => {
      const payload: OrderSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [createAttempt(["correct", "correct"])],
      };
      expect(generateOrderShareText(payload).endsWith("\n\nhttps://chrondle.app")).toBe(true);
    });

    it("uses a custom url when provided", () => {
      const payload: OrderSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [createAttempt(["correct", "correct"])],
        url: "https://chrondle.app/order",
      };
      expect(generateOrderShareText(payload).endsWith("\n\nhttps://chrondle.app/order")).toBe(true);
    });
  });

  describe("attempt grid (arrangement correctness mechanic)", () => {
    it("shows 🟩 for correct positions", () => {
      const payload: OrderSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      };
      expect(generateOrderShareText(payload)).toContain("🟩🟩🟩🟩🟩🟩");
    });

    it("shows ⬜ for incorrect positions", () => {
      const payload: OrderSharePayload = {
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
      expect(generateOrderShareText(payload)).toContain("⬜⬜⬜⬜⬜⬜");
    });

    it("renders one row per attempt in order", () => {
      const payload: OrderSharePayload = {
        puzzleNumber: 247,
        score: { attempts: 2 },
        attempts: [
          createAttempt(["incorrect", "correct", "incorrect", "correct"]),
          createAttempt(["correct", "correct", "correct", "correct"]),
        ],
      };
      expect(generateOrderShareText(payload)).toContain("⬜🟩⬜🟩\n🟩🟩🟩🟩");
    });
  });

  it("generates the full family-shaped text", () => {
    const payload: OrderSharePayload = {
      puzzleNumber: 247,
      score: { attempts: 2 },
      attempts: [
        createAttempt(["incorrect", "correct", "incorrect", "correct", "incorrect", "correct"]),
        createAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
      ],
    };
    expect(generateOrderShareText(payload)).toBe(
      `Chrondle Order #247\n\n⬜🟩⬜🟩⬜🟩\n🟩🟩🟩🟩🟩🟩\n\nhttps://chrondle.app`,
    );
  });
});
