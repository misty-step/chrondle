import { describe, expect, it } from "vitest";
import { mergeHints, serializeHint } from "../hintMerging";
import type { OrderHint } from "@/types/orderGameState";

// =============================================================================
// serializeHint
// =============================================================================

describe("serializeHint", () => {
  it("serializes anchor hints", () => {
    const hint: OrderHint = { type: "anchor", eventId: "event-1", position: 3 };

    expect(serializeHint(hint)).toBe("anchor:event-1:3");
  });

  it("serializes relative hints", () => {
    const hint: OrderHint = {
      type: "relative",
      earlierEventId: "event-1",
      laterEventId: "event-2",
    };

    expect(serializeHint(hint)).toBe("relative:event-1:event-2");
  });

  it("serializes bracket hints", () => {
    const hint: OrderHint = {
      type: "bracket",
      eventId: "event-1",
      yearRange: [1900, 2000],
    };

    expect(serializeHint(hint)).toBe("bracket:event-1:1900-2000");
  });

  it("falls back to JSON for unknown hint types", () => {
    // @ts-expect-error - testing unknown hint type
    const hint: OrderHint = { type: "unknown", data: "test" };

    expect(serializeHint(hint)).toBe('{"type":"unknown","data":"test"}');
  });
});

// =============================================================================
// mergeHints
// =============================================================================

describe("mergeHints", () => {
  it("returns server hints when session hints are empty", () => {
    const serverHints: OrderHint[] = [{ type: "anchor", eventId: "event-1", position: 1 }];

    const result = mergeHints(serverHints, []);

    expect(result).toEqual(serverHints);
  });

  it("returns session hints when server hints are empty", () => {
    const sessionHints: OrderHint[] = [{ type: "anchor", eventId: "event-1", position: 1 }];

    const result = mergeHints([], sessionHints);

    expect(result).toEqual(sessionHints);
  });

  it("merges non-duplicate hints", () => {
    const serverHints: OrderHint[] = [{ type: "anchor", eventId: "event-1", position: 1 }];
    const sessionHints: OrderHint[] = [{ type: "anchor", eventId: "event-2", position: 2 }];

    const result = mergeHints(serverHints, sessionHints);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(serverHints[0]);
    expect(result).toContainEqual(sessionHints[0]);
  });

  it("deduplicates identical hints", () => {
    const hint: OrderHint = { type: "anchor", eventId: "event-1", position: 1 };
    const serverHints: OrderHint[] = [hint];
    const sessionHints: OrderHint[] = [{ ...hint }]; // Same content, different object

    const result = mergeHints(serverHints, sessionHints);

    expect(result).toHaveLength(1);
  });

  it("preserves server hints order", () => {
    const serverHints: OrderHint[] = [
      { type: "anchor", eventId: "event-1", position: 1 },
      { type: "anchor", eventId: "event-2", position: 2 },
    ];

    const result = mergeHints(serverHints, []);

    expect(result[0].type === "anchor" && result[0].eventId).toBe("event-1");
    expect(result[1].type === "anchor" && result[1].eventId).toBe("event-2");
  });

  it("appends unique session hints after server hints", () => {
    const serverHints: OrderHint[] = [{ type: "anchor", eventId: "event-1", position: 1 }];
    const sessionHints: OrderHint[] = [
      { type: "relative", earlierEventId: "event-2", laterEventId: "event-3" },
    ];

    const result = mergeHints(serverHints, sessionHints);

    expect(result[0].type).toBe("anchor");
    expect(result[1].type).toBe("relative");
  });

  it("handles all hint types together", () => {
    const serverHints: OrderHint[] = [{ type: "anchor", eventId: "event-1", position: 1 }];
    const sessionHints: OrderHint[] = [
      { type: "relative", earlierEventId: "event-2", laterEventId: "event-3" },
      { type: "bracket", eventId: "event-4", yearRange: [1900, 2000] },
    ];

    const result = mergeHints(serverHints, sessionHints);

    expect(result).toHaveLength(3);
  });
});
