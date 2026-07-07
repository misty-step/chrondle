/**
 * Shared spoiler-leakage suite for the unified share system.
 *
 * Vision red line: a share artifact seen by someone who has NOT played yet
 * must never reveal the target year, its era (BC/AD), the guessed range
 * endpoints (from which the year could be bracketed), or hint content.
 * Every mode and every outcome class is asserted through one property.
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

interface LeakageCase {
  name: string;
  text: string;
  /** Strings that must never appear anywhere in the share text */
  forbidden: string[];
}

function classicRange(start: number, end: number, hintsUsed: number): RangeGuess {
  return {
    start,
    end,
    hintsUsed: hintsUsed as RangeGuess["hintsUsed"],
    score: 0,
    timestamp: Date.now(),
  };
}

function orderAttempt(feedback: Array<"correct" | "incorrect">, events: string[]): OrderAttempt {
  return {
    ordering: events,
    feedback,
    pairsCorrect: feedback.filter((f) => f === "correct").length,
    totalPairs: feedback.length,
    timestamp: Date.now(),
  };
}

// Classic fixtures: target year 1969, guesses around it. The share may show
// width, hints, score, and relative miss distance — never these absolutes.
const CLASSIC_SECRETS = ["1969", "1947", "1958", "1972", "1985"];

const ORDER_EVENTS = [
  "Apollo 11 lands on the Moon",
  "Fall of the Berlin Wall",
  "Battle of Hastings",
  "Construction of the Great Pyramid",
];
// Event content and their years must never leak from Order shares.
const ORDER_SECRETS = [...ORDER_EVENTS, "1969", "1989", "1066", "2560"];

const CASES: LeakageCase[] = [
  {
    name: "classic · win (contained)",
    text: generateClassicShareText([classicRange(1958, 1972, 3)], 88, true, 96),
    forbidden: CLASSIC_SECRETS,
  },
  {
    name: "classic · loss, missed early",
    text: generateClassicShareText([classicRange(1947, 1958, 4)], 0, false, 96, {
      missDistance: 11,
      missDirection: "earlier",
    }),
    forbidden: CLASSIC_SECRETS,
  },
  {
    name: "classic · loss, missed late",
    text: generateClassicShareText([classicRange(1972, 1985, 2)], 0, false, 96, {
      missDistance: 3,
      missDirection: "later",
    }),
    forbidden: CLASSIC_SECRETS,
  },
  {
    name: "classic · loss without miss info",
    text: generateClassicShareText([classicRange(1947, 1958, 6)], 12, false, 96),
    forbidden: CLASSIC_SECRETS,
  },
  {
    name: "order · solved first try",
    text: generateOrderShareText({
      puzzleNumber: 247,
      score: { attempts: 1 },
      attempts: [orderAttempt(["correct", "correct", "correct", "correct"], ORDER_EVENTS)],
    }),
    forbidden: ORDER_SECRETS,
  },
  {
    name: "order · solved after multiple attempts",
    text: generateOrderShareText({
      puzzleNumber: 247,
      score: { attempts: 3 },
      attempts: [
        orderAttempt(["incorrect", "incorrect", "correct", "incorrect"], ORDER_EVENTS),
        orderAttempt(["correct", "incorrect", "correct", "incorrect"], ORDER_EVENTS),
        orderAttempt(["correct", "correct", "correct", "correct"], ORDER_EVENTS),
      ],
    }),
    forbidden: ORDER_SECRETS,
  },
  {
    name: "order · unsolved (all attempts imperfect)",
    text: generateOrderShareText({
      puzzleNumber: 247,
      score: { attempts: 2 },
      attempts: [
        orderAttempt(["incorrect", "incorrect", "incorrect", "incorrect"], ORDER_EVENTS),
        orderAttempt(["correct", "incorrect", "incorrect", "correct"], ORDER_EVENTS),
      ],
    }),
    forbidden: ORDER_SECRETS,
  },
  {
    name: "duel · run ended by a miss",
    // The pair years (1815, 1848) must not leak; only the relative gap may show.
    text: generateDuelShareText({
      streak: 12,
      bestStreak: 20,
      tierLabel: "Historian",
      finalGap: 33,
    }),
    forbidden: ["1815", "1848"],
  },
  {
    name: "duel · archive exhausted (no miss)",
    text: generateDuelShareText({
      streak: 40,
      bestStreak: 40,
      tierLabel: "Legend",
      finalGap: null,
    }),
    forbidden: ["1815", "1848"],
  },
];

describe("share leakage (all modes, all outcome classes)", () => {
  it.each(CASES)("$name leaks no absolute year or secret content", ({ text, forbidden }) => {
    for (const secret of forbidden) {
      expect(text).not.toContain(secret);
    }
  });

  it.each(CASES)("$name leaks no era marker", ({ text }) => {
    expect(text).not.toMatch(/\b(BC|AD|BCE|CE)\b/);
  });

  it.each(CASES)("$name contains no absolute 3-4 digit year outside game stats", ({ text }) => {
    // Numbers a share may carry: width (≤ ~few hundred), hints (≤6), score
    // (≤100), streaks, miss distance/gap (relative). Any standalone number
    // with 3+ digits that is not part of "NNN/100" or the puzzle number in
    // the header is treated as a potential year leak.
    const body = text
      .split("\n")
      .slice(1) // header may carry the puzzle number
      .join("\n")
      .replace(/\b(\d{1,3})\/100\b/g, "") // score fraction
      .replace(/https:\/\/\S+/g, ""); // footer url
    const bigNumbers = body.match(/\d{3,}/g) ?? [];
    expect(bigNumbers).toEqual([]);
  });
});
