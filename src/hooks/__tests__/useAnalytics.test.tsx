import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAnalytics } from "../useAnalytics";
import type { GameState } from "@/types/gameState";

const track = vi.hoisted(() => vi.fn());
const completion = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/analytics")>();
  return {
    ...original,
    analytics: {
      track,
      trackCompletion: completion,
      trackStateTransition: vi.fn(),
      detectDivergence: vi.fn(),
    },
  };
});
const ready = (id: string, isComplete = false) =>
  ({
    status: "ready",
    puzzle: { id },
    guesses: [],
    ranges: [],
    isComplete,
  }) as unknown as GameState;

describe("story events follow readiness, not renders or restored completion", () => {
  beforeEach(() => vi.clearAllMocks());
  it("captures loading-to-ready once, retries of readiness do not inflate it", () => {
    const { rerender } = renderHook(({ state }) => useAnalytics({ gameState: state }), {
      initialProps: { state: { status: "loading-puzzle" } as GameState },
    });
    rerender({ state: ready("one") });
    rerender({ state: ready("one") });
    rerender({ state: { status: "loading-progress" } as GameState });
    rerender({ state: ready("one", true) });
    expect(track.mock.calls.filter(([name]) => name === "game_loaded")).toHaveLength(1);
    expect(completion).not.toHaveBeenCalled();
    rerender({ state: ready("two") });
    expect(track.mock.calls.filter(([name]) => name === "game_loaded")).toHaveLength(2);
  });
  it("does not emit a completed action when restoring a result", () => {
    renderHook(() => useAnalytics({ gameState: ready("completed", true) }));
    expect(completion).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith("game_completed", expect.anything());
  });
});
