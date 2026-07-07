/**
 * Snapshot coverage: one snapshot per mode per outcome class, so any drift
 * in the shared format family or a mode grammar is a reviewed diff.
 */
import { describe, it, expect, vi } from "vitest";
import { generateClassicShareText } from "../classic";
import { generateOrderShareText } from "../order";
import { generateDuelShareText } from "../duel";
import type { RangeGuess } from "@/types/range";
import type { OrderAttempt } from "@/types/orderGameState";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

function classicRange(start: number, end: number, hintsUsed: number): RangeGuess {
  return {
    start,
    end,
    hintsUsed: hintsUsed as RangeGuess["hintsUsed"],
    score: 0,
    timestamp: Date.now(),
  };
}

function orderAttempt(feedback: Array<"correct" | "incorrect">): OrderAttempt {
  return {
    ordering: feedback.map((_, i) => `event-${i}`),
    feedback,
    pairsCorrect: feedback.filter((f) => f === "correct").length,
    totalPairs: feedback.length,
    timestamp: Date.now(),
  };
}

describe("classic share snapshots", () => {
  it("win · narrow range, no hints", () => {
    expect(
      generateClassicShareText([classicRange(1950, 1952, 0)], 97, true, 347),
    ).toMatchSnapshot();
  });

  it("win · wide range with hints", () => {
    expect(generateClassicShareText([classicRange(1900, 1920, 3)], 92, true, 96)).toMatchSnapshot();
  });

  it("loss · missed early beyond 25 years", () => {
    expect(
      generateClassicShareText([classicRange(1900, 1929, 4)], 0, false, 96, {
        missDistance: 34,
        missDirection: "earlier",
      }),
    ).toMatchSnapshot();
  });

  it("loss · near miss late", () => {
    expect(
      generateClassicShareText([classicRange(1950, 1960, 2)], 0, false, 42, {
        missDistance: 2,
        missDirection: "later",
      }),
    ).toMatchSnapshot();
  });

  it("loss · without miss info", () => {
    expect(generateClassicShareText([classicRange(1900, 1929, 6)], 8, false, 96)).toMatchSnapshot();
  });
});

describe("order share snapshots", () => {
  it("solved first try", () => {
    expect(
      generateOrderShareText({
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          orderAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      }),
    ).toMatchSnapshot();
  });

  it("solved after multiple attempts", () => {
    expect(
      generateOrderShareText({
        puzzleNumber: 247,
        score: { attempts: 3 },
        attempts: [
          orderAttempt(["incorrect", "correct", "incorrect", "correct", "incorrect", "correct"]),
          orderAttempt(["correct", "correct", "incorrect", "correct", "correct", "correct"]),
          orderAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      }),
    ).toMatchSnapshot();
  });

  it("unsolved", () => {
    expect(
      generateOrderShareText({
        puzzleNumber: 247,
        score: { attempts: 2 },
        attempts: [
          orderAttempt([
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
          ]),
          orderAttempt(["correct", "incorrect", "correct", "incorrect", "correct", "incorrect"]),
        ],
      }),
    ).toMatchSnapshot();
  });
});

describe("duel share snapshots", () => {
  it("run ended by a miss", () => {
    expect(
      generateDuelShareText({
        streak: 12,
        bestStreak: 20,
        tierLabel: "Historian",
        finalGap: 6,
      }),
    ).toMatchSnapshot();
  });

  it("new personal best", () => {
    expect(
      generateDuelShareText({
        streak: 21,
        bestStreak: 21,
        tierLabel: "Legend",
        finalGap: 2,
      }),
    ).toMatchSnapshot();
  });

  it("archive exhausted (no miss)", () => {
    expect(
      generateDuelShareText({
        streak: 40,
        bestStreak: 40,
        tierLabel: "Legend",
        finalGap: null,
      }),
    ).toMatchSnapshot();
  });

  it("zero-streak run", () => {
    expect(
      generateDuelShareText({
        streak: 0,
        bestStreak: 0,
        tierLabel: "Novice",
        finalGap: 300,
      }),
    ).toMatchSnapshot();
  });
});
