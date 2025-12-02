import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatRelativeHintText, formatRelativeHintShort } from "../formatHints";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockEvent = (overrides: Partial<OrderEvent> = {}): OrderEvent => ({
  id: "event-1",
  year: 2000,
  text: "Test Event Text",
  ...overrides,
});

const createRelativeHint = (
  earlierEventId: string,
  laterEventId: string,
): Extract<OrderHint, { type: "relative" }> => ({
  type: "relative",
  earlierEventId,
  laterEventId,
});

// =============================================================================
// formatRelativeHintText
// =============================================================================

describe("formatRelativeHintText", () => {
  it("renders event names from the events map", () => {
    const eventsById = new Map<string, OrderEvent>([
      ["event-1", createMockEvent({ id: "event-1", text: "World War I begins" })],
      ["event-2", createMockEvent({ id: "event-2", text: "World War II begins" })],
    ]);
    const hint = createRelativeHint("event-1", "event-2");

    render(<>{formatRelativeHintText(hint, eventsById)}</>);

    expect(screen.getByText("World War I begins")).toBeInTheDocument();
    expect(screen.getByText("World War II begins")).toBeInTheDocument();
  });

  it("shows 'Unknown event' for missing earlier event", () => {
    const eventsById = new Map<string, OrderEvent>([
      ["event-2", createMockEvent({ id: "event-2", text: "World War II" })],
    ]);
    const hint = createRelativeHint("missing", "event-2");

    render(<>{formatRelativeHintText(hint, eventsById)}</>);

    expect(screen.getByText("Unknown event")).toBeInTheDocument();
    expect(screen.getByText("World War II")).toBeInTheDocument();
  });

  it("shows 'Unknown event' for missing later event", () => {
    const eventsById = new Map<string, OrderEvent>([
      ["event-1", createMockEvent({ id: "event-1", text: "World War I" })],
    ]);
    const hint = createRelativeHint("event-1", "missing");

    render(<>{formatRelativeHintText(hint, eventsById)}</>);

    expect(screen.getByText("World War I")).toBeInTheDocument();
    expect(screen.getByText("Unknown event")).toBeInTheDocument();
  });

  it("includes 'happens before' relationship text", () => {
    const eventsById = new Map<string, OrderEvent>([
      ["event-1", createMockEvent({ id: "event-1", text: "Event A" })],
      ["event-2", createMockEvent({ id: "event-2", text: "Event B" })],
    ]);
    const hint = createRelativeHint("event-1", "event-2");

    render(<>{formatRelativeHintText(hint, eventsById)}</>);

    expect(screen.getByText(/happens before/i)).toBeInTheDocument();
  });
});

// =============================================================================
// formatRelativeHintShort
// =============================================================================

describe("formatRelativeHintShort", () => {
  it("formats hint with arrow notation", () => {
    const eventsById = new Map<string, OrderEvent>([
      ["event-1", createMockEvent({ id: "event-1", text: "World War I" })],
      ["event-2", createMockEvent({ id: "event-2", text: "World War II" })],
    ]);
    const hint = createRelativeHint("event-1", "event-2");

    const result = formatRelativeHintShort(hint, eventsById);

    expect(result).toBe("World War I → before → World War II");
  });

  it("shows 'Unknown' for missing events", () => {
    const eventsById = new Map<string, OrderEvent>();
    const hint = createRelativeHint("missing-1", "missing-2");

    const result = formatRelativeHintShort(hint, eventsById);

    expect(result).toBe("Unknown → before → Unknown");
  });

  it("truncates long event names to 30 characters", () => {
    const eventsById = new Map<string, OrderEvent>([
      [
        "event-1",
        createMockEvent({
          id: "event-1",
          text: "This is a very long event name that exceeds thirty characters",
        }),
      ],
      [
        "event-2",
        createMockEvent({
          id: "event-2",
          text: "Another extremely long event name that should be truncated",
        }),
      ],
    ]);
    const hint = createRelativeHint("event-1", "event-2");

    const result = formatRelativeHintShort(hint, eventsById);

    expect(result).toContain("This is a very long event name...");
    expect(result).toContain("Another extremely long event n...");
  });

  it("does not truncate short event names", () => {
    const eventsById = new Map<string, OrderEvent>([
      ["event-1", createMockEvent({ id: "event-1", text: "Short" })],
      ["event-2", createMockEvent({ id: "event-2", text: "Name" })],
    ]);
    const hint = createRelativeHint("event-1", "event-2");

    const result = formatRelativeHintShort(hint, eventsById);

    expect(result).toBe("Short → before → Name");
    expect(result).not.toContain("...");
  });

  it("handles exactly 30 character names without truncation", () => {
    const exactLength = "A".repeat(30);
    const eventsById = new Map<string, OrderEvent>([
      ["event-1", createMockEvent({ id: "event-1", text: exactLength })],
      ["event-2", createMockEvent({ id: "event-2", text: "Short" })],
    ]);
    const hint = createRelativeHint("event-1", "event-2");

    const result = formatRelativeHintShort(hint, eventsById);

    expect(result).toBe(`${exactLength} → before → Short`);
    expect(result).not.toContain("...");
  });
});
