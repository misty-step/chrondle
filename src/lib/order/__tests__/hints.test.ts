import { describe, expect, it } from "vitest";
import { generateAnchorHint, generateBracketHint, generateRelativeHint } from "@/lib/order/hints";
import type { OrderEvent } from "@/types/orderGameState";

const events: OrderEvent[] = [
  { id: "a", year: 1200, text: "Event A" },
  { id: "b", year: 1500, text: "Event B" },
  { id: "c", year: 1800, text: "Event C" },
];

describe("Order hint generation", () => {
  it("reveals the first mismatched slot when no seed is provided", () => {
    const hint = generateAnchorHint(["b", "a", "c"], ["a", "b", "c"]);
    expect(hint).toEqual({ type: "anchor", eventId: "a", position: 0 });
  });

  it("uses the seed to select among multiple mismatched slots", () => {
    const current = ["c", "b", "a", "d"];
    const correct = ["a", "b", "c", "d"];
    const seen = new Set<number>();

    [1, 7, 42, 88, 1337].forEach((seed) => {
      const hint = generateAnchorHint(current, correct, { seed });
      if (hint.type === "anchor") {
        seen.add(hint.position);
      }
    });

    expect([...seen].sort()).toEqual([0, 2]);
  });

  it("skips events that already received anchor hints", () => {
    const hint = generateAnchorHint(["c", "b", "a"], ["a", "b", "c"], {
      excludeEventIds: ["a"],
    });
    expect(hint).toEqual({ type: "anchor", eventId: "c", position: 2 });
  });

  it("picks a deterministic misordered pair using the provided seed", () => {
    const hint = generateRelativeHint(["c", "a", "b"], events, { seed: 99 });
    expect(hint).toEqual({ type: "relative", earlierEventId: "a", laterEventId: "c" });
  });

  it("avoids repeating relative pairs when excluded", () => {
    const hint = generateRelativeHint(["c", "a", "b"], events, {
      excludePairs: [{ earlierEventId: "a", laterEventId: "c" }],
    });
    expect(hint).toEqual({ type: "relative", earlierEventId: "b", laterEventId: "c" });
  });

  it("falls back to earliest chronological pair when already correct", () => {
    const hint = generateRelativeHint(["a", "b", "c"], events);
    expect(hint).toEqual({ type: "relative", earlierEventId: "a", laterEventId: "b" });
  });

  it("produces bracket hints around the event year", () => {
    const hint = generateBracketHint(events[1], 50);
    expect(hint).toEqual({ type: "bracket", eventId: "b", yearRange: [1450, 1550] });
  });

  it("handles BC events when creating bracket hints", () => {
    const bcEvent: OrderEvent = { id: "rome", year: -44, text: "Julius Caesar assassinated" };
    const hint = generateBracketHint(bcEvent);
    expect(hint).toEqual({ type: "bracket", eventId: "rome", yearRange: [-69, -19] });
  });
});
