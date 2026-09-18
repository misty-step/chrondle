/**
 * Shared spoiler-safety invariant across all three share modes.
 *
 * Chrondle's prime directive (AGENTS.md "Puzzle Integrity") is that the
 * answer is never revealed outside the hint system. A share artifact is
 * read by people who have *not* played yet, so it carries the same bar as
 * in-game UI: no absolute calendar year, and nothing that lets a
 * not-yet-played reader derive the target year or era.
 *
 * Order and Duel are structurally safe: their adapters' input types never
 * accept an absolute year at all (Order takes only correct/incorrect
 * feedback; Duel takes only a relative gap), so there is nothing to leak
 * by construction. Classic is the one adapter that touches real calendar
 * years (RangeGuess.start/end, and formerly a targetYear option) — these
 * tests are the regression guard for that surface, run across win and loss
 * outcome classes.
 */
import { describe, it, expect, vi } from "vitest";
import { generateClassicShareText } from "../classic";
import { generateOrderShareText } from "../order";
import { generateDuelShareText } from "../duel";
import { SHARE_PITCH } from "../format";
import type { RangeGuess } from "@/types/range";
import type { OrderAttempt } from "@/types/orderGameState";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

// Plausible absolute years a puzzle could plausibly target or a player
// could plausibly guess. If any adapter ever starts interpolating an
// absolute calendar year into share text, one of these will surface and
// fail the assertion below.
const FORBIDDEN_YEARS = ["1969", "1945", "1776", "1865", "2001", "1991", "1700", "1959"];

function assertNoForbiddenYears(text: string) {
  for (const year of FORBIDDEN_YEARS) {
    expect(text).not.toContain(year);
  }
}

/** No bare 4-digit calendar-year-shaped number anywhere in the share body. */
function assertNoCalendarYearShapedNumber(text: string) {
  // Strip the header line: puzzle numbers (e.g. "Chrondle Order #1947") are
  // a sequential day counter, not a calendar year, and are out of scope for
  // this check — only the body (the mechanic-expressing content) matters.
  const [, ...rest] = text.split("\n\n");
  const body = rest.slice(0, -1).join("\n\n");
  const bodyWithoutPitch = body.replace(SHARE_PITCH, "");
  expect(bodyWithoutPitch).not.toMatch(/\b(1[5-9]|20)\d{2}\b/);
}

const range = (start: number, end: number, hintsUsed = 0): RangeGuess => ({
  start,
  end,
  hintsUsed: hintsUsed as RangeGuess["hintsUsed"],
  score: 0,
  timestamp: 0,
});

function orderAttempt(feedback: Array<"correct" | "incorrect">): OrderAttempt {
  return {
    ordering: feedback.map((_, i) => `event-${i}`),
    feedback,
    pairsCorrect: feedback.filter((f) => f === "correct").length,
    totalPairs: feedback.length,
    timestamp: 0,
  };
}

describe("share text spoiler-safety (no year/era/derivable-hint leakage)", () => {
  describe("classic", () => {
    it("win: does not leak any guessed range's absolute years", () => {
      const ranges = [range(1700, 1999, 0), range(1900, 1980, 1), range(1945, 1959, 2)];
      const text = generateClassicShareText(ranges, 85, true, 347);
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });

    it("loss (earlier miss): does not leak guessed years or the target", () => {
      const ranges = [range(1700, 1999, 0), range(1900, 1980, 2)];
      const text = generateClassicShareText(ranges, 0, false, 347, {
        missDistance: 11,
        missDirection: "earlier",
      });
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });

    it("loss (later miss): does not leak guessed years or the target", () => {
      const ranges = [range(1700, 1999, 0), range(1960, 1991, 3)];
      const text = generateClassicShareText(ranges, 0, false, 347, {
        missDistance: 10,
        missDirection: "later",
      });
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });

    it("loss (no miss info available): does not leak guessed years", () => {
      const ranges = [range(1865, 1969, 0)];
      const text = generateClassicShareText(ranges, 0, false, 347);
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });

    it("single-guess win: does not leak the guessed year", () => {
      const text = generateClassicShareText([range(1776, 1776, 0)], 100, true, 1);
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });
  });

  describe("order", () => {
    it("win: attempt grid carries no year information", () => {
      const text = generateOrderShareText({
        puzzleNumber: 247,
        score: { attempts: 1 },
        attempts: [
          orderAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      });
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });

    it("multi-attempt loss-then-solve carries no year information", () => {
      const text = generateOrderShareText({
        puzzleNumber: 247,
        score: { attempts: 2 },
        attempts: [
          orderAttempt(["incorrect", "correct", "incorrect", "correct", "incorrect", "incorrect"]),
          orderAttempt(["correct", "correct", "correct", "correct", "correct", "correct"]),
        ],
      });
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });
  });

  describe("duel", () => {
    it("run ended by a miss carries only a relative gap, never absolute years", () => {
      const text = generateDuelShareText({
        streak: 12,
        bestStreak: 20,
        tierLabel: "Historian",
        finalGap: 6,
      });
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });

    it("exhausted run (no miss) carries no year information", () => {
      const text = generateDuelShareText({
        streak: 30,
        bestStreak: 30,
        tierLabel: "Legend",
        finalGap: null,
      });
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });

    it("new-personal-best run carries no year information", () => {
      const text = generateDuelShareText({
        streak: 21,
        bestStreak: 21,
        tierLabel: "Legend",
        finalGap: 2,
      });
      assertNoForbiddenYears(text);
      assertNoCalendarYearShapedNumber(text);
    });
  });
});
