import { describe, expect, it } from "vitest";
import type { Id } from "convex/_generated/dataModel";
import {
  type OrderEventCandidate,
  type SelectionConfig,
  selectEventsWithSpread,
} from "convex/orderPuzzles/generation";

const baseConfig: SelectionConfig = {
  count: 6,
  minSpan: 100,
  maxSpan: 2000,
  excludeYears: [],
};

const makeEvents = (years: number[]): OrderEventCandidate[] =>
  years.map((year, index) => ({
    _id: `event_${index}` as Id<"events">,
    year,
    event: `Event ${year}`,
  }));

const spanOf = (events: OrderEventCandidate[]) => {
  const years = events.map((event) => event.year).sort((a, b) => a - b);
  return years[years.length - 1] - years[0];
};

describe("selectEventsWithSpread", () => {
  it("returns deterministic selections for the same seed", () => {
    // Create events that span 100-2000 years with enough candidates
    const events = makeEvents([
      1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400,
      2500, 2600, 2700, 2800, 2900,
    ]);
    const config = { ...baseConfig };

    const first = selectEventsWithSpread(events, 42, config);
    const second = selectEventsWithSpread(events, 42, config);

    expect(first.map((event) => event._id)).toEqual(second.map((event) => event._id));
  });

  it("excludes specified years from the selection pool", () => {
    // Need enough events to select 6 after excluding 2 (total 8 minimum, using 10 for safety)
    const events = makeEvents([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900]);
    const config: SelectionConfig = {
      ...baseConfig,
      excludeYears: [1500, 1600],
    };

    const selection = selectEventsWithSpread(events, 123, config);

    expect(selection.some((event) => config.excludeYears.includes(event.year))).toBe(false);
    expect(selection).toHaveLength(config.count);
  });

  it("honors span constraints when data allows", () => {
    const events = makeEvents([-900, -600, -200, 300, 800, 1100, 1500, 1900, 2200]);
    const config: SelectionConfig = {
      ...baseConfig,
      minSpan: 1000,
      maxSpan: 2500,
    };

    const selection = selectEventsWithSpread(events, 11, config);
    const span = spanOf(selection);

    expect(span).toBeGreaterThanOrEqual(config.minSpan);
    expect(span).toBeLessThanOrEqual(config.maxSpan);
    expect(selection).toHaveLength(config.count);
  });

  it("throws when constraints cannot be satisfied with available events", () => {
    const events = makeEvents([100, 120, 140, 160, 180, 200]);
    const config: SelectionConfig = {
      ...baseConfig,
      minSpan: 500,
      maxSpan: 600,
    };

    expect(() => selectEventsWithSpread(events, 1, config)).toThrowError(
      /Unable to select 6 events/,
    );
  });

  it("retries with incremented seeds when initial selection violates constraints", () => {
    const events = makeEvents([
      -1200, -800, -500, -200, -50, 300, 800, 1200, 1500, 1700, 1900, 1950, 2000, 2300, 2600, 3000,
    ]);
    const strictConfig: SelectionConfig = {
      ...baseConfig,
      minSpan: 2000,
      maxSpan: 3600,
      maxAttempts: 2,
    };

    expect(() => selectEventsWithSpread(events, 0, { ...strictConfig, maxAttempts: 1 })).toThrow();

    const selectionWithRetries = selectEventsWithSpread(events, 0, strictConfig);
    const directSelection = selectEventsWithSpread(events, 1, {
      ...strictConfig,
      maxAttempts: 1,
    });

    expect(selectionWithRetries.map((event) => event._id)).toEqual(
      directSelection.map((event) => event._id),
    );
  });

  it("handles BC and AD timelines by forcing spans that cross year zero", () => {
    const events = makeEvents([-900, -850, -500, -100, 200, 400, 600, 900, 1200]);
    const config: SelectionConfig = {
      ...baseConfig,
      minSpan: 1000,
      maxSpan: 2200,
    };

    const selection = selectEventsWithSpread(events, 3, config);
    const years = selection.map((event) => event.year);

    expect(Math.min(...years)).toBeLessThan(0);
    expect(Math.max(...years)).toBeGreaterThan(0);
    expect(spanOf(selection)).toBeGreaterThanOrEqual(config.minSpan);
  });
});
