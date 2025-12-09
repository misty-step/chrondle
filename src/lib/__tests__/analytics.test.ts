import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GameAnalytics, AnalyticsEvent } from "../analytics";
import type { GameState } from "@/types/gameState";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.gtag
const mockGtag = vi.fn();

describe("GameAnalytics", () => {
  let analytics: GameAnalytics;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

    // Setup window mocks
    Object.defineProperty(window, "gtag", {
      value: mockGtag,
      writable: true,
      configurable: true,
    });

    // Get fresh instance with test config
    analytics = GameAnalytics.getInstance({
      enabled: true,
      debugMode: false,
      sampleRate: 1.0,
      batchSize: 100, // High batch size to prevent auto-flush
      flushInterval: 60000, // Long interval to prevent timer flush
    });
  });

  afterEach(() => {
    analytics.reset();
    vi.clearAllTimers();
  });

  describe("getInstance", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = GameAnalytics.getInstance();
      const instance2 = GameAnalytics.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should accept config overrides on first call", () => {
      // Reset singleton
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      const instance = GameAnalytics.getInstance({ enabled: false });
      const summary = instance.getSummary();

      expect(summary.enabled).toBe(false);
    });
  });

  describe("trackStateTransition", () => {
    it("should record transition in history", () => {
      const prevState = {
        status: "loading-puzzle",
      } as GameState;

      const newState = {
        status: "ready",
        puzzle: { id: "test-id", targetYear: 1969, events: [], puzzleNumber: 1 },
        guesses: [],
        ranges: [],
        totalScore: 0,
        isComplete: false,
        hasWon: false,
        remainingGuesses: 6,
        remainingAttempts: 6,
        hintsRevealed: 0,
      } as unknown as GameState;

      analytics.trackStateTransition(prevState, newState);

      const summary = analytics.getSummary();
      expect(summary.lastState).toBe("ready");
    });

    it("should detect backward transitions as errors", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      const prevState = {
        status: "ready",
        puzzle: { id: "test-id", targetYear: 1969, events: [], puzzleNumber: 1 },
        guesses: [],
        ranges: [],
        totalScore: 0,
        isComplete: false,
        hasWon: false,
        remainingGuesses: 6,
        remainingAttempts: 6,
        hintsRevealed: 0,
      } as unknown as GameState;

      const newState = {
        status: "loading-progress",
      } as unknown as GameState;

      analytics.trackStateTransition(prevState, newState);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.STATE_ERROR,
        expect.objectContaining({
          issue: "backward_transition",
          from: "ready",
          to: "loading-progress",
        }),
      );
    });

    it("should track progress loss when guesses decrease", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      const prevState = {
        status: "ready",
        puzzle: { id: "test-id", targetYear: 1969, events: [], puzzleNumber: 1 },
        guesses: [1960, 1970],
        ranges: [],
        totalScore: 0,
        isComplete: false,
        hasWon: false,
        remainingGuesses: 4,
        remainingAttempts: 4,
        hintsRevealed: 2,
      } as unknown as GameState;

      const newState = {
        status: "ready",
        puzzle: { id: "test-id", targetYear: 1969, events: [], puzzleNumber: 1 },
        guesses: [1960], // Lost a guess
        ranges: [],
        totalScore: 0,
        isComplete: false,
        hasWon: false,
        remainingGuesses: 5,
        remainingAttempts: 5,
        hintsRevealed: 1,
      } as unknown as GameState;

      analytics.trackStateTransition(prevState, newState);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.PROGRESS_LOST,
        expect.objectContaining({
          expected: [1960, 1970],
          actual: [1960],
          lostCount: 1,
        }),
        undefined,
      );
    });
  });

  describe("detectDivergence", () => {
    it("should return hasDivergence: false when arrays match", () => {
      const result = analytics.detectDivergence([1960, 1970], [1960, 1970]);

      expect(result.hasDivergence).toBe(false);
      expect(result.divergenceType).toBeUndefined();
    });

    it("should detect missing_server when session has guesses but server empty", () => {
      const result = analytics.detectDivergence([1960, 1970], []);

      expect(result.hasDivergence).toBe(true);
      expect(result.divergenceType).toBe("missing_server");
      expect(result.details).toContain("Session has guesses but server doesn't");
    });

    it("should detect missing_session when server has guesses but session empty", () => {
      const result = analytics.detectDivergence([], [1960, 1970]);

      expect(result.hasDivergence).toBe(true);
      expect(result.divergenceType).toBe("missing_session");
      expect(result.details).toContain("Server has guesses but session doesn't");
    });

    it("should detect mismatch when array lengths differ", () => {
      const result = analytics.detectDivergence([1960], [1960, 1970]);

      expect(result.hasDivergence).toBe(true);
      expect(result.divergenceType).toBe("mismatch");
      expect(result.details).toContain("Session has 1 guesses, server has 2");
    });

    it("should detect mismatch when array contents differ", () => {
      const result = analytics.detectDivergence([1960, 1970], [1960, 1975]);

      expect(result.hasDivergence).toBe(true);
      expect(result.divergenceType).toBe("mismatch");
      expect(result.details).toContain("Guess 2 differs");
    });
  });

  describe("trackGuess", () => {
    it("should calculate distance correctly", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackGuess(1960, 1969, 1, false);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GUESS_SUBMITTED,
        expect.objectContaining({
          distance: 9,
        }),
        undefined,
      );
    });

    it("should determine direction as 'before' when guess < target", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackGuess(1960, 1969, 1, false);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GUESS_SUBMITTED,
        expect.objectContaining({
          direction: "before",
        }),
        undefined,
      );
    });

    it("should determine direction as 'after' when guess > target", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackGuess(1980, 1969, 1, false);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GUESS_SUBMITTED,
        expect.objectContaining({
          direction: "after",
        }),
        undefined,
      );
    });

    it("should determine direction as 'exact' when guess equals target", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackGuess(1969, 1969, 1, true);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GUESS_SUBMITTED,
        expect.objectContaining({
          direction: "exact",
          isCorrect: true,
        }),
        undefined,
      );
    });

    it("should calculate accuracy score", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      // Exact guess = accuracy 1
      analytics.trackGuess(1969, 1969, 1, true);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GUESS_SUBMITTED,
        expect.objectContaining({
          accuracy: 1,
        }),
        undefined,
      );
    });
  });

  describe("trackCompletion", () => {
    it("should track won status and guess count", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackCompletion(true, 3, 60000, 42);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GAME_COMPLETED,
        expect.objectContaining({
          won: true,
          guessCount: 3,
          timeSpent: 60000,
          puzzleNumber: 42,
        }),
        undefined,
      );
    });

    it("should calculate efficiency score (fewer guesses = higher)", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      // Win with 1 guess = max efficiency (6/6)
      analytics.trackCompletion(true, 1, 60000, 42);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GAME_COMPLETED,
        expect.objectContaining({
          efficiency: 1, // (6 - 1 + 1) / 6 = 1
        }),
        undefined,
      );

      trackSpy.mockClear();

      // Win with 6 guesses = min efficiency (1/6)
      analytics.trackCompletion(true, 6, 60000, 42);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GAME_COMPLETED,
        expect.objectContaining({
          efficiency: expect.closeTo(0.1666, 2),
        }),
        undefined,
      );
    });

    it("should set efficiency to 0 on loss", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackCompletion(false, 6, 60000, 42);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.GAME_COMPLETED,
        expect.objectContaining({
          won: false,
          efficiency: 0,
        }),
        undefined,
      );
    });
  });

  describe("trackPerformance", () => {
    it("should track slow derivations (>10ms)", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackPerformance("derivation", 15);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.SLOW_DERIVATION,
        expect.objectContaining({
          duration: 15,
          threshold: 10,
          excess: 5,
        }),
      );
    });

    it("should track slow queries (>200ms)", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackPerformance("query", 250);

      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvent.SLOW_QUERY,
        expect.objectContaining({
          duration: 250,
          threshold: 200,
          excess: 50,
        }),
      );
    });

    it("should not track operations under threshold", () => {
      const trackSpy = vi.spyOn(analytics, "track");

      analytics.trackPerformance("derivation", 5);
      analytics.trackPerformance("query", 100);

      expect(trackSpy).not.toHaveBeenCalled();
    });
  });

  describe("track", () => {
    it("should add event to queue", () => {
      analytics.track(AnalyticsEvent.GAME_LOADED, { test: true });

      const summary = analytics.getSummary();
      expect(summary.queueSize).toBe(1);
    });

    it("should call gtag when available", () => {
      analytics.track(AnalyticsEvent.GAME_LOADED, { test: true }, "user-123");

      expect(mockGtag).toHaveBeenCalledWith(
        "event",
        AnalyticsEvent.GAME_LOADED,
        expect.objectContaining({
          test: true,
          user_id: "user-123",
        }),
      );
    });

    it("should not track when disabled", () => {
      // Reset and create disabled instance
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
      const disabledAnalytics = GameAnalytics.getInstance({ enabled: false });

      disabledAnalytics.track(AnalyticsEvent.GAME_LOADED);

      const summary = disabledAnalytics.getSummary();
      expect(summary.queueSize).toBe(0);
    });

    it("should respect sample rate", () => {
      // Reset and create instance with 0 sample rate
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
      const sampledAnalytics = GameAnalytics.getInstance({
        enabled: true,
        sampleRate: 0,
      });

      sampledAnalytics.track(AnalyticsEvent.GAME_LOADED);

      const summary = sampledAnalytics.getSummary();
      expect(summary.queueSize).toBe(0);
    });
  });

  describe("reset", () => {
    it("should clear all state", () => {
      // Add some events
      analytics.track(AnalyticsEvent.GAME_LOADED);
      analytics.track(AnalyticsEvent.GAME_STARTED);

      const beforeReset = analytics.getSummary();
      expect(beforeReset.queueSize).toBe(2);

      analytics.reset();

      const afterReset = analytics.getSummary();
      expect(afterReset.queueSize).toBe(0);
      expect(afterReset.lastState).toBeUndefined();
    });

    it("should generate new session ID", () => {
      const beforeReset = analytics.getSummary();
      const sessionIdBefore = beforeReset.sessionId;

      analytics.reset();

      const afterReset = analytics.getSummary();
      expect(afterReset.sessionId).not.toBe(sessionIdBefore);
    });
  });

  describe("getSummary", () => {
    it("should return current analytics state", () => {
      analytics.track(AnalyticsEvent.GAME_LOADED);

      const summary = analytics.getSummary();

      expect(summary).toHaveProperty("sessionId");
      expect(summary).toHaveProperty("queueSize", 1);
      expect(summary).toHaveProperty("enabled", true);
      expect(summary).toHaveProperty("recentTransitions");
      expect(summary).toHaveProperty("eventCounts");
    });
  });
});
