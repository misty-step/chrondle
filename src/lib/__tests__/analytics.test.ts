import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsEvent, GameAnalytics } from "../analytics";
import type { GameState } from "@/types/gameState";

const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/posthog", () => ({ captureProductEvent: capture }));

describe("GameAnalytics local diagnostics and SDK delegation", () => {
  let analytics: GameAnalytics;
  beforeEach(() => {
    capture.mockClear();
    (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
    analytics = GameAnalytics.getInstance({ enabled: true, debugMode: false });
  });

  it("uses one instance and never sends account identifiers", () => {
    expect(GameAnalytics.getInstance()).toBe(analytics);
    analytics.track(AnalyticsEvent.GAME_LOADED, { mode: "classic" }, "private-account", 42);
    expect(capture).toHaveBeenCalledWith("game_loaded", { mode: "classic" });
    expect(analytics.getSummary()).toMatchObject({ eventCounts: { game_loaded: 1 }, queueSize: 0 });
  });

  it.each([false, true])("honors enabled=%s and sampling", (enabled) => {
    (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
    const instance = GameAnalytics.getInstance({ enabled, sampleRate: 0 });
    instance.track(AnalyticsEvent.GAME_LOADED);
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    [[1960], [1960], undefined],
    [[1960], [], "missing_server"],
    [[], [1960], "missing_session"],
    [[1960], [1960, 1970], "mismatch"],
    [[1960], [1970], "mismatch"],
  ] as const)("detects divergence %j / %j", (session, server, type) => {
    expect(analytics.detectDivergence([...session], [...server])).toMatchObject({
      hasDivergence: type !== undefined,
      ...(type ? { divergenceType: type } : {}),
    });
  });

  it("records transitions and progress loss in bounded local history", () => {
    const before = { status: "ready", guesses: [1900, 1950] } as GameState;
    const after = { status: "ready", guesses: [1900] } as GameState;
    analytics.trackStateTransition(before, after);
    expect(capture).toHaveBeenCalledWith(
      "progress_lost",
      expect.objectContaining({ lostCount: 1 }),
    );
    analytics.trackStateTransition(before, { status: "loading-progress" } as GameState);
    expect(capture).toHaveBeenCalledWith(
      "state_error",
      expect.objectContaining({ issue: "backward_transition" }),
    );
    for (let i = 0; i < 100; i++)
      analytics.trackStateTransition(null, { status: "loading-puzzle" });
    expect(analytics.getSummary().recentTransitions).toHaveLength(10);
  });

  it.each([
    [1960, "before", 9],
    [1980, "after", 11],
    [1969, "exact", 0],
  ])("keeps guess diagnostics for %s", (guess, direction, distance) => {
    analytics.trackGuess(guess as number, 1969, 1, guess === 1969);
    expect(capture).toHaveBeenCalledWith(
      "guess_submitted",
      expect.objectContaining({ direction, distance }),
    );
  });

  it("retains completion and slow-operation diagnostics", () => {
    analytics.trackCompletion(true, 1, 1000, 42);
    expect(capture).toHaveBeenCalledWith(
      "game_completed",
      expect.objectContaining({ won: true, efficiency: 1 }),
    );
    capture.mockClear();
    analytics.trackPerformance("derivation", 5);
    analytics.trackPerformance("query", 100);
    expect(capture).not.toHaveBeenCalled();
    analytics.trackPerformance("derivation", 15);
    analytics.trackPerformance("query", 250);
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("resets diagnostics without managing another event queue or anonymous identity", () => {
    const previous = analytics.getSummary().sessionId;
    analytics.track(AnalyticsEvent.GAME_LOADED);
    analytics.reset();
    expect(analytics.getSummary()).toMatchObject({ eventCounts: {}, queueSize: 0 });
    expect(analytics.getSummary().sessionId).not.toBe(previous);
  });
});
