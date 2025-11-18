import { describe, it, expect } from "vitest";
import { hasLeakage, hasProperNoun, isValidWordCount } from "../eventValidation";

const goldenEvents = {
  "1969": {
    good: [
      "Woodstock Music Festival draws hundreds of thousands",
      "Concorde makes maiden flight over France",
      "Armstrong becomes first human to walk on Moon",
    ],
    bad: ["Moon landing in 1969", "Apollo 11 mission", "Event in the 1960s", "Something happens"],
  },
  "-44": {
    good: [
      "Caesar falls at Theatre of Pompey amid senatorial conspiracy",
      "Brutus and Cassius lead plot against Roman dictator",
    ],
    bad: ["Julius Caesar assassinated in 44 BCE", "Ides of March in first century BC"],
  },
};

describe("Golden event validation", () => {
  Object.entries(goldenEvents).forEach(([year, events]) => {
    describe(`Year ${year}`, () => {
      it("passes good events", () => {
        events.good.forEach((event) => {
          expect(hasLeakage(event)).toBe(false);
          expect(hasProperNoun(event)).toBe(true);
          expect(isValidWordCount(event)).toBe(true);
        });
      });

      it("flags bad events", () => {
        events.bad.forEach((event) => {
          const isValid = !hasLeakage(event) && hasProperNoun(event);
          expect(isValid).toBe(false);
        });
      });
    });
  });
});
