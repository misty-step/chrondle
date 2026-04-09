/**
 * Integration tests for multi-mode event usage tracking.
 *
 * Verifies that Classic, Order, and Groups modes independently track event usage
 * via classicPuzzleId, orderPuzzleId, and groupsPuzzleId fields.
 */
import { describe, it, expect } from "vitest";
import { calculatePoolHealth } from "../lib/observability/metricsService";
import type { Doc } from "../_generated/dataModel";

describe("Dual-mode event usage tracking", () => {
  const now = Date.now();

  /**
   * Creates a mock event with specified usage state.
   */
  function createMockEvent(
    id: string,
    year: number,
    options: {
      classicPuzzleId?: string;
      orderPuzzleId?: string;
      groupsPuzzleId?: string;
    } = {},
  ): Doc<"events"> {
    return {
      _id: id as Doc<"events">["_id"],
      _creationTime: now,
      year,
      event: `Test event ${id}`,
      classicPuzzleId: options.classicPuzzleId as Doc<"puzzles">["_id"] | undefined,
      orderPuzzleId: options.orderPuzzleId as Doc<"orderPuzzles">["_id"] | undefined,
      groupsPuzzleId: options.groupsPuzzleId as Doc<"groupsPuzzles">["_id"] | undefined,
      updatedAt: now,
    } as Doc<"events">;
  }

  describe("calculatePoolHealth with mode filter", () => {
    const mockEvents: Doc<"events">[] = [
      // Event 1: Unused in both modes
      createMockEvent("evt1", 1969),
      // Event 2: Used in Classic only
      createMockEvent("evt2", 1969, { classicPuzzleId: "classic-puzzle-1" }),
      // Event 3: Used in Order only
      createMockEvent("evt3", 1500, { orderPuzzleId: "order-puzzle-1" }),
      // Event 4: Used in ALL modes
      createMockEvent("evt4", 400, {
        classicPuzzleId: "classic-puzzle-1",
        orderPuzzleId: "order-puzzle-1",
        groupsPuzzleId: "groups-puzzle-1",
      }),
      // Event 5: Unused in both modes
      createMockEvent("evt5", 1776),
      // Event 6: Used in Groups only
      createMockEvent("evt6", 1200, { groupsPuzzleId: "groups-puzzle-1" }),
    ];

    it("mode='all' counts events unused in all live modes", () => {
      const result = calculatePoolHealth(mockEvents, "all");

      // Only evt1 and evt5 are unused in both modes
      expect(result.unusedEvents).toBe(2);
      expect(result.yearsReady).toBe(2); // 1969, 1776
    });

    it("mode='classic' counts events unused in Classic mode", () => {
      const result = calculatePoolHealth(mockEvents, "classic");

      // evt1, evt3, evt5, evt6 are unused in Classic
      expect(result.unusedEvents).toBe(4);
      expect(result.yearsReady).toBe(4); // 1969, 1500, 1776, 1200
    });

    it("mode='order' counts events unused in Order mode", () => {
      const result = calculatePoolHealth(mockEvents, "order");

      // evt1, evt2, evt5, evt6 are unused in Order
      expect(result.unusedEvents).toBe(4);
      expect(result.yearsReady).toBe(3); // 1969, 1776, 1200
    });

    it("mode='groups' counts events unused in Groups mode", () => {
      const result = calculatePoolHealth(mockEvents, "groups");

      // evt1, evt2, evt3, evt5 are unused in Groups
      expect(result.unusedEvents).toBe(4);
      expect(result.yearsReady).toBe(3); // 1969, 1500, 1776
    });

    it("default mode is 'all' when not specified", () => {
      const resultDefault = calculatePoolHealth(mockEvents);
      const resultAll = calculatePoolHealth(mockEvents, "all");

      expect(resultDefault.unusedEvents).toBe(resultAll.unusedEvents);
      expect(resultDefault.yearsReady).toBe(resultAll.yearsReady);
    });
  });

  describe("same event can be used across modes independently", () => {
    it("event used in all three modes is unavailable everywhere", () => {
      const events: Doc<"events">[] = [
        // Event used in both modes
        createMockEvent("dual-used", 1969, {
          classicPuzzleId: "classic-1",
          orderPuzzleId: "order-1",
          groupsPuzzleId: "groups-1",
        }),
        // Event unused in both
        createMockEvent("unused", 1776),
      ];

      // Classic mode: only "unused" is available
      const classicHealth = calculatePoolHealth(events, "classic");
      expect(classicHealth.unusedEvents).toBe(1);

      // Order mode: only "unused" is available
      const orderHealth = calculatePoolHealth(events, "order");
      expect(orderHealth.unusedEvents).toBe(1);

      // Groups mode: only "unused" is available
      const groupsHealth = calculatePoolHealth(events, "groups");
      expect(groupsHealth.unusedEvents).toBe(1);

      // All mode: only "unused" is available
      const allHealth = calculatePoolHealth(events, "all");
      expect(allHealth.unusedEvents).toBe(1);
    });

    it("event used in Classic only is still available for Order", () => {
      const events: Doc<"events">[] = [
        createMockEvent("classic-only", 1969, { classicPuzzleId: "classic-1" }),
      ];

      // Classic: 0 available (used)
      expect(calculatePoolHealth(events, "classic").unusedEvents).toBe(0);

      // Order: 1 available (not used in Order)
      expect(calculatePoolHealth(events, "order").unusedEvents).toBe(1);

      // Groups: 1 available (not used in Groups)
      expect(calculatePoolHealth(events, "groups").unusedEvents).toBe(1);

      // All: 0 available (not unused everywhere)
      expect(calculatePoolHealth(events, "all").unusedEvents).toBe(0);
    });

    it("event used in Order only is still available for Classic", () => {
      const events: Doc<"events">[] = [
        createMockEvent("order-only", 1500, { orderPuzzleId: "order-1" }),
      ];

      // Classic: 1 available (not used in Classic)
      expect(calculatePoolHealth(events, "classic").unusedEvents).toBe(1);

      // Order: 0 available (used)
      expect(calculatePoolHealth(events, "order").unusedEvents).toBe(0);

      // Groups: 1 available (not used in Groups)
      expect(calculatePoolHealth(events, "groups").unusedEvents).toBe(1);

      // All: 0 available (not unused everywhere)
      expect(calculatePoolHealth(events, "all").unusedEvents).toBe(0);
    });

    it("event used in Groups only is still available for Classic and Order", () => {
      const events: Doc<"events">[] = [
        createMockEvent("groups-only", 1200, { groupsPuzzleId: "groups-1" }),
      ];

      expect(calculatePoolHealth(events, "classic").unusedEvents).toBe(1);
      expect(calculatePoolHealth(events, "order").unusedEvents).toBe(1);
      expect(calculatePoolHealth(events, "groups").unusedEvents).toBe(0);
      expect(calculatePoolHealth(events, "all").unusedEvents).toBe(0);
    });
  });

  describe("era coverage breakdown by mode", () => {
    const events: Doc<"events">[] = [
      // Ancient (year < 500): 1 unused in all, 1 used in Classic
      createMockEvent("ancient-1", 400),
      createMockEvent("ancient-2", 300, { classicPuzzleId: "classic-1" }),
      // Medieval (500-1499): 1 unused in all, 1 used in Order
      createMockEvent("medieval-1", 1000),
      createMockEvent("medieval-2", 1200, { orderPuzzleId: "order-1" }),
      // Modern (>= 1500): 1 unused in all, 1 used in Groups
      createMockEvent("modern-1", 1776),
      createMockEvent("modern-2", 1969, { groupsPuzzleId: "groups-1" }),
    ];

    it("era breakdown respects mode filter - all", () => {
      const result = calculatePoolHealth(events, "all");

      expect(result.coverageByEra.ancient).toBe(1); // ancient-1 only
      expect(result.coverageByEra.medieval).toBe(1); // medieval-1 only
      expect(result.coverageByEra.modern).toBe(1); // modern-1 only
      expect(result.unusedEvents).toBe(3);
    });

    it("era breakdown respects mode filter - classic", () => {
      const result = calculatePoolHealth(events, "classic");

      // ancient-2 is used in Classic, so not counted
      // medieval-2 is used in Order only, so still available for Classic
      // modern-2 is used in Groups only, so still available for Classic
      expect(result.coverageByEra.ancient).toBe(1); // ancient-1
      expect(result.coverageByEra.medieval).toBe(2); // medieval-1, medieval-2
      expect(result.coverageByEra.modern).toBe(2); // modern-1, modern-2
      expect(result.unusedEvents).toBe(5);
    });

    it("era breakdown respects mode filter - order", () => {
      const result = calculatePoolHealth(events, "order");

      // ancient-2 is used in Classic only, so still available for Order
      // medieval-2 is used in Order, so not counted
      // modern-2 is used in Groups only, so still available for Order
      expect(result.coverageByEra.ancient).toBe(2); // ancient-1, ancient-2
      expect(result.coverageByEra.medieval).toBe(1); // medieval-1
      expect(result.coverageByEra.modern).toBe(2); // modern-1, modern-2
      expect(result.unusedEvents).toBe(5);
    });

    it("era breakdown respects mode filter - groups", () => {
      const result = calculatePoolHealth(events, "groups");

      // ancient-2/classic-only and medieval-2/order-only stay available for Groups
      // modern-2 is used in Groups, so not counted
      expect(result.coverageByEra.ancient).toBe(2); // ancient-1, ancient-2
      expect(result.coverageByEra.medieval).toBe(2); // medieval-1, medieval-2
      expect(result.coverageByEra.modern).toBe(1); // modern-1
      expect(result.unusedEvents).toBe(5);
    });
  });

  describe("days until depletion calculation", () => {
    it("calculates combined depletion for the shared pool", () => {
      const events: Doc<"events">[] = Array.from({ length: 30 }, (_, i) =>
        createMockEvent(`evt-${i}`, 1900 + i),
      );

      const result = calculatePoolHealth(events, "all");

      // 30 events / 28 per day across Classic, Order, and Groups = 1 day
      expect(result.daysUntilDepletion).toBe(1);
    });

    it("calculates Groups depletion based on 16 events per day", () => {
      const events: Doc<"events">[] = Array.from({ length: 32 }, (_, i) =>
        createMockEvent(`groups-${i}`, 1800 + i),
      );

      const result = calculatePoolHealth(events, "groups");

      expect(result.daysUntilDepletion).toBe(2);
    });

    it("returns 0 when no events available", () => {
      const events: Doc<"events">[] = [
        createMockEvent("used", 1969, {
          classicPuzzleId: "c1",
          orderPuzzleId: "o1",
        }),
      ];

      const result = calculatePoolHealth(events, "all");
      expect(result.daysUntilDepletion).toBe(0);
    });
  });
});
