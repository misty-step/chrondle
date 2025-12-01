import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateOrderShareText,
  generateArchivalShareText,
  copyArchivalShareTextToClipboard,
  copyOrderShareTextToClipboard,
  type OrderSharePayload,
  type ArchivalSharePayload,
} from "../shareCard";
import type { OrderAttempt, AttemptScore } from "@/types/orderGameState";

describe("generateOrderShareText", () => {
  describe("NYT-style header", () => {
    it("shows score: Chrondle Order #347 6/6", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("Chrondle Order #347 6/6");
    });

    it("shows partial score: Chrondle Order #347 4/6", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("Chrondle Order #347 4/6");
    });
  });

  describe("results line", () => {
    it("converts correct results to ✓", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("✓ ✓ ✓ ✓ ✓ ✓");
    });

    it("converts incorrect results to ✗", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["incorrect", "incorrect", "incorrect", "incorrect", "incorrect", "incorrect"],
        score: { correctPairs: 0, totalPairs: 6, hintsUsed: 3, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("✗ ✗ ✗ ✗ ✗ ✗");
    });

    it("mixes ✓ and ✗ for mixed results", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("✓ ✗ ✓ ✓ ✗ ✓");
    });
  });

  describe("hints visualization bar (max 3)", () => {
    it("shows ⬜⬜⬜ for 0 hints used", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("⬜⬜⬜");
    });

    it("shows 💡💡⬜ for 2 hints used", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("💡💡⬜");
    });

    it("shows 💡💡💡 for all 3 hints used", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["incorrect", "incorrect", "incorrect", "incorrect", "incorrect", "correct"],
        score: { correctPairs: 1, totalPairs: 6, hintsUsed: 3, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("💡💡💡");
    });
  });

  describe("URL footer", () => {
    it("uses chrondle.app without protocol when no URL provided", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("chrondle.app");
      expect(result).not.toContain("https://");
    });

    it("strips protocol from provided URL", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
        url: "https://www.chrondle.app",
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("chrondle.app");
      expect(result).not.toContain("https://");
      expect(result).not.toContain("www.");
    });
  });

  describe("removed old kitschy elements", () => {
    it("does NOT include date", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("—");
      expect(result).not.toContain("Nov");
      expect(result).not.toContain("2025");
    });

    it("does NOT include Sequence Analysis subheader", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("📜");
      expect(result).not.toContain("Sequence Analysis");
    });

    it("does NOT include Status tier", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("Status:");
      expect(result).not.toContain("ARCHIVIST");
    });

    it("does NOT include Examined clues text", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("Examined:");
      expect(result).not.toContain("clues");
    });

    it("does NOT include accuracy percentage", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("Accuracy:");
      expect(result).not.toContain("%");
    });
  });

  describe("character limits", () => {
    it("keeps share text under 280 characters for all scenarios", () => {
      const testCases: OrderSharePayload[] = [
        // Perfect score
        {
          dateLabel: "Nov 28",
          puzzleNumber: 347,
          results: ["correct", "correct", "correct", "correct", "correct", "correct"],
          score: {
            correctPairs: 6,
            totalPairs: 6,
            hintsUsed: 0,
            totalScore: 0,
          },
        },
        // High accuracy
        {
          dateLabel: "Nov 28",
          puzzleNumber: 347,
          results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
          score: {
            correctPairs: 4,
            totalPairs: 6,
            hintsUsed: 2,
            totalScore: 0,
          },
        },
        // Low accuracy
        {
          dateLabel: "Nov 28",
          puzzleNumber: 347,
          results: ["incorrect", "incorrect", "incorrect", "incorrect", "incorrect", "correct"],
          score: {
            correctPairs: 1,
            totalPairs: 6,
            hintsUsed: 3,
            totalScore: 0,
          },
        },
      ];

      testCases.forEach((payload) => {
        const result = generateOrderShareText(payload);
        expect(result.length).toBeLessThanOrEqual(280);
      });
    });
  });

  describe("full share text examples", () => {
    it("generates correct text for perfect score (6/6)", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      const expected = `Chrondle Order #347 6/6

✓ ✓ ✓ ✓ ✓ ✓
⬜⬜⬜

chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for partial score (4/6)", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      const expected = `Chrondle Order #347 4/6

✓ ✗ ✓ ✓ ✗ ✓
💡💡⬜

chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for low score (1/6)", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["incorrect", "incorrect", "incorrect", "incorrect", "incorrect", "correct"],
        score: { correctPairs: 1, totalPairs: 6, hintsUsed: 3, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      const expected = `Chrondle Order #347 1/6

✗ ✗ ✗ ✗ ✗ ✓
💡💡💡

chrondle.app`;

      expect(result).toBe(expected);
    });
  });
});

// =============================================================================
// Test Fixtures for Archival
// =============================================================================

const createMockAttempt = (feedback: ("correct" | "incorrect")[]): OrderAttempt => ({
  ordering: feedback.map((_, i) => `event-${i}`),
  feedback,
  pairsCorrect: feedback.filter((f) => f === "correct").length,
  totalPairs: feedback.length,
  timestamp: Date.now(),
});

const createMockScore = (overrides: Partial<AttemptScore> = {}): AttemptScore => ({
  attempts: 3,
  ...overrides,
});

// =============================================================================
// generateArchivalShareText
// =============================================================================

describe("generateArchivalShareText", () => {
  it("generates share text with puzzle number", () => {
    const result = generateArchivalShareText({
      puzzleNumber: 247,
      score: createMockScore(),
      attempts: [createMockAttempt(["correct", "correct", "correct"])],
    });

    expect(result).toContain("Chrondle: Order #247");
  });

  it("shows correct feedback as green squares", () => {
    const result = generateArchivalShareText({
      puzzleNumber: 1,
      score: createMockScore(),
      attempts: [createMockAttempt(["correct", "correct", "correct"])],
    });

    expect(result).toContain("🟩🟩🟩");
  });

  it("shows incorrect feedback as white squares", () => {
    const result = generateArchivalShareText({
      puzzleNumber: 1,
      score: createMockScore(),
      attempts: [createMockAttempt(["incorrect", "incorrect", "incorrect"])],
    });

    expect(result).toContain("⬜⬜⬜");
  });

  it("shows mixed feedback correctly", () => {
    const result = generateArchivalShareText({
      puzzleNumber: 1,
      score: createMockScore(),
      attempts: [createMockAttempt(["correct", "incorrect", "correct", "incorrect"])],
    });

    expect(result).toContain("🟩⬜🟩⬜");
  });

  it("shows multiple attempts on separate lines", () => {
    const result = generateArchivalShareText({
      puzzleNumber: 1,
      score: createMockScore(),
      attempts: [
        createMockAttempt(["incorrect", "correct", "incorrect"]),
        createMockAttempt(["correct", "correct", "incorrect"]),
        createMockAttempt(["correct", "correct", "correct"]),
      ],
    });

    expect(result).toContain("⬜🟩⬜\n🟩🟩⬜\n🟩🟩🟩");
  });

  it("uses default URL when not provided", () => {
    const result = generateArchivalShareText({
      puzzleNumber: 1,
      score: createMockScore(),
      attempts: [createMockAttempt(["correct"])],
    });

    expect(result).toContain("https://www.chrondle.app");
  });

  it("uses custom URL when provided", () => {
    const result = generateArchivalShareText({
      puzzleNumber: 1,
      score: createMockScore(),
      attempts: [createMockAttempt(["correct"])],
      url: "https://custom.url",
    });

    expect(result).toContain("https://custom.url");
    expect(result).not.toContain("chrondle.app");
  });
});

// =============================================================================
// Clipboard Functions
// =============================================================================

describe("clipboard functions", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("copyArchivalShareTextToClipboard", () => {
    it("copies share text to clipboard", async () => {
      await copyArchivalShareTextToClipboard({
        puzzleNumber: 1,
        score: createMockScore(),
        attempts: [createMockAttempt(["correct"])],
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("Chrondle: Order #1"),
      );
    });

    it("throws when clipboard API unavailable", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: null },
        writable: true,
      });

      await expect(
        copyArchivalShareTextToClipboard({
          puzzleNumber: 1,
          score: createMockScore(),
          attempts: [createMockAttempt(["correct"])],
        }),
      ).rejects.toThrow("Clipboard API unsupported");
    });
  });

  describe("copyOrderShareTextToClipboard", () => {
    it("copies share text to clipboard", async () => {
      await copyOrderShareTextToClipboard({
        dateLabel: "2025-01-15",
        puzzleNumber: 1,
        results: ["correct"],
        score: { totalScore: 100, correctPairs: 1, totalPairs: 1, hintsUsed: 0 },
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("Chrondle Order #1"),
      );
    });

    it("throws when clipboard API unavailable", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: null },
        writable: true,
      });

      await expect(
        copyOrderShareTextToClipboard({
          dateLabel: "2025-01-15",
          puzzleNumber: 1,
          results: ["correct"],
          score: { totalScore: 100, correctPairs: 1, totalPairs: 1, hintsUsed: 0 },
        }),
      ).rejects.toThrow("Clipboard API unsupported");
    });
  });
});
