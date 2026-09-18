import { describe, it, expect } from "vitest";
import { generateDuelShareText } from "../duel";

describe("generateDuelShareText", () => {
  describe("header (shared format family)", () => {
    it("shows the Duel mode label with no puzzle number", () => {
      const text = generateDuelShareText({
        streak: 12,
        bestStreak: 20,
        tierLabel: "Historian",
        finalGap: 6,
      });
      expect(text.startsWith("Chrondle Duel\n\n")).toBe(true);
    });
  });

  describe("outcome class: ended on a miss", () => {
    it("formats a standard run", () => {
      const text = generateDuelShareText({
        streak: 12,
        bestStreak: 20,
        tierLabel: "Historian",
        finalGap: 6,
      });

      expect(text).toBe(
        "Chrondle Duel\n\n⚔️ 12 in a row · Historian\nFelled by a gap of 6 years\n\nA daily history puzzle: read the clues, guess the year. One real event per day, free at chrondle.app.\nhttps://chrondle.app/duel",
      );
    });

    it("uses singular year for a one-year gap", () => {
      const text = generateDuelShareText({
        streak: 25,
        bestStreak: 30,
        tierLabel: "Legend",
        finalGap: 1,
      });
      expect(text).toContain("Felled by a gap of 1 year\n");
    });
  });

  describe("outcome class: personal best", () => {
    it("celebrates a new personal best", () => {
      const text = generateDuelShareText({
        streak: 21,
        bestStreak: 21,
        tierLabel: "Legend",
        finalGap: 2,
      });

      expect(text).toContain("🏆 New personal best");
      expect(text).toContain("⚔️ 21 in a row · Legend");
    });

    it("does not celebrate a zero-streak run as a best", () => {
      const text = generateDuelShareText({
        streak: 0,
        bestStreak: 0,
        tierLabel: "Novice",
        finalGap: 300,
      });
      expect(text).not.toContain("🏆");
      expect(text).toContain("⚔️ 0 in a row");
    });
  });

  describe("outcome class: exhausted run (no miss)", () => {
    it("omits the gap line when no miss ended the run", () => {
      const text = generateDuelShareText({
        streak: 3,
        bestStreak: 10,
        tierLabel: "Apprentice",
        finalGap: null,
      });
      expect(text).not.toContain("Felled");
    });
  });
});
