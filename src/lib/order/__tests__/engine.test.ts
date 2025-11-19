import { describe, expect, it } from "vitest";
import type { OrderHint } from "@/types/orderGameState";
import {
  initializeOrderState,
  reduceOrderState,
  selectOrdering,
  type OrderEngineContext,
} from "@/lib/order/engine";

const BASELINE = ["a", "b", "c", "d", "e", "f"];
const CONTEXT: OrderEngineContext = { baseline: BASELINE };

function buildState(ordering: string[], hints: OrderHint[] = []) {
  return initializeOrderState(CONTEXT, ordering, hints);
}

describe("order engine", () => {
  it("keeps locked events fixed during initialization", () => {
    const hints: OrderHint[] = [{ type: "anchor", eventId: "d", position: 2 }];
    const shuffled = ["d", "c", "b", "a", "e", "f"];
    const state = buildState(shuffled, hints);
    expect(selectOrdering(state)).toEqual(["c", "b", "d", "a", "e", "f"]);
  });

  it("ignores move attempts targeting locked cards", () => {
    const hints: OrderHint[] = [{ type: "anchor", eventId: "c", position: 1 }];
    let state = buildState(["a", "c", "b", "d", "e", "f"], hints);
    state = reduceOrderState(CONTEXT, state, { type: "move", eventId: "c", targetIndex: 4 });
    expect(selectOrdering(state)).toEqual(["a", "c", "b", "d", "e", "f"]);
  });

  it("restores locked positions after moving other events", () => {
    const hints: OrderHint[] = [{ type: "anchor", eventId: "b", position: 0 }];
    let state = buildState(["a", "b", "c", "d", "e", "f"], hints);
    state = reduceOrderState(CONTEXT, state, { type: "move", eventId: "e", targetIndex: 0 });
    expect(selectOrdering(state)).toEqual(["b", "e", "a", "c", "d", "f"]);
  });

  it("applies anchor hints idempotently", () => {
    const hint: OrderHint = { type: "anchor", eventId: "f", position: 5 };
    let state = buildState(["f", "a", "b", "c", "d", "e"], []);
    state = reduceOrderState(CONTEXT, state, { type: "apply-hint", hint, correctOrder: BASELINE });
    expect(selectOrdering(state)).toEqual(["a", "b", "c", "d", "e", "f"]);
    const again = reduceOrderState(CONTEXT, state, {
      type: "apply-hint",
      hint,
      correctOrder: BASELINE,
    });
    expect(selectOrdering(again)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("hydrates with new hints from the server", () => {
    let state = buildState(["a", "b", "c", "d", "e", "f"], []);
    state = reduceOrderState(CONTEXT, state, {
      type: "hydrate",
      hints: [{ type: "anchor", eventId: "a", position: 3 }],
    });
    expect(selectOrdering(state)).toEqual(["b", "c", "d", "a", "e", "f"]);
  });

  it("normalizes ordering when duplicates or missing ids occur", () => {
    const ordering = ["a", "a", "b", "g"];
    const state = buildState(ordering, []);
    expect(selectOrdering(state)).toEqual(BASELINE);
  });

  it("prevents crossing multiple locks", () => {
    const hints: OrderHint[] = [
      { type: "anchor", eventId: "b", position: 1 },
      { type: "anchor", eventId: "e", position: 4 },
    ];
    let state = buildState(["a", "b", "c", "d", "e", "f"], hints);
    state = reduceOrderState(CONTEXT, state, { type: "move", eventId: "f", targetIndex: 0 });
    expect(selectOrdering(state)).toEqual(["f", "b", "a", "c", "e", "d"]);
    state = reduceOrderState(CONTEXT, state, { type: "move", eventId: "a", targetIndex: 5 });
    expect(selectOrdering(state)).toEqual(["f", "b", "c", "d", "e", "a"]);
  });
});
