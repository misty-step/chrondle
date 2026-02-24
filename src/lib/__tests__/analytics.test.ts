import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GameAnalytics, AnalyticsEvent } from "../analytics";
import type { GameState } from "@/types/gameState";

const mockCapture = vi.hoisted(() => vi.fn());
const mockGetDistinctId = vi.hoisted(() => vi.fn<() => string | undefined>(() => undefined));

vi.mock("posthog-js", () => ({
  default: {
    capture: mockCapture,
    get_distinct_id: mockGetDistinctId,
    __loaded: true,
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GameAnalytics", () => {
  let analytics: GameAnalytics;
  const originalEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  const originalPayloadFormat = process.env.NEXT_PUBLIC_ANALYTICS_FORMAT;
  const originalPosthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem("chrondle-anonymous-id");

    // Reset singleton
    (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

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
    window.localStorage.removeItem("chrondle-anonymous-id");

    if (originalEndpoint === undefined) {
      delete process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    } else {
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = originalEndpoint;
    }

    if (originalPayloadFormat === undefined) {
      delete process.env.NEXT_PUBLIC_ANALYTICS_FORMAT;
    } else {
      process.env.NEXT_PUBLIC_ANALYTICS_FORMAT = originalPayloadFormat;
    }
    if (originalPosthogKey === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    } else {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = originalPosthogKey;
    }
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

    it("should call posthog when available", async () => {
      analytics.track(AnalyticsEvent.GAME_LOADED, { test: true }, "user-123");

      // PostHog is now lazy-loaded via dynamic import
      await Promise.resolve();

      expect(mockCapture).toHaveBeenCalledWith(
        AnalyticsEvent.GAME_LOADED,
        expect.objectContaining({
          test: true,
          user_id: "user-123",
          session_id: expect.any(String),
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

  describe("flush", () => {
    it("should send PostHog batch payload for ingest endpoint", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = "/ingest/batch";
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";

      // Reset with config that will flush on first tracked event.
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
      });

      analytics.track(
        AnalyticsEvent.GAME_LOADED,
        { difficulty: "easy", event_name: "should_not_override" },
        "user-123",
        42,
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string);

      expect(url).toBe("/ingest/batch");
      expect(payload.api_key).toBe("phc_test_key");
      expect(payload.v).toBe(1);
      expect(payload.batch).toHaveLength(1);
      expect(payload.batch[0]).toEqual(
        expect.objectContaining({
          event: AnalyticsEvent.GAME_LOADED,
          distinct_id: "user-123",
          properties: expect.objectContaining({
            event_name: AnalyticsEvent.GAME_LOADED,
            difficulty: "easy",
            puzzle_number: 42,
          }),
        }),
      );

      await Promise.resolve();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("should use persistent anonymous id for PostHog distinct_id", () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = "/ingest/batch";
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
      window.localStorage.setItem("chrondle-anonymous-id", "anon_test_123");

      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { difficulty: "anon" });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string);
      expect(payload.batch[0].distinct_id).toBe("anon_test_123");
    });

    it("should prefer PostHog SDK distinct_id for batch payloads", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = "/ingest/batch";
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
      mockGetDistinctId.mockReturnValue("ph_distinct_123");

      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 100,
        flushInterval: 60000,
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "sdk-distinct-id" });
      await Promise.resolve();
      window.dispatchEvent(new Event("beforeunload"));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string);
      expect(payload.batch[0].distinct_id).toBe("ph_distinct_123");
    });

    it("should send raw { events } payload for custom endpoint", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { difficulty: "medium" }, "user-456", 7);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string);

      expect(url).toBe("https://analytics.example.test/v1/events");
      expect(payload).toEqual(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              event: AnalyticsEvent.GAME_LOADED,
              userId: "user-456",
              sessionId: expect.any(String),
              puzzleNumber: 7,
              properties: expect.objectContaining({
                difficulty: "medium",
              }),
            }),
          ]),
        }),
      );
    });

    it("should treat ingest-like custom endpoint as raw events payload", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/ingest/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "custom" }, "user-789", 9);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string);

      expect(url).toBe("https://analytics.example.test/v1/ingest/events");
      expect(payload).toEqual(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              event: AnalyticsEvent.GAME_LOADED,
              userId: "user-789",
            }),
          ]),
        }),
      );
      expect(payload.api_key).toBeUndefined();
    });

    it("should honor explicit payload format override", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = "/ingest/batch";
      process.env.NEXT_PUBLIC_ANALYTICS_FORMAT = "events";
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "format-override" }, "user-123", 3);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string);

      expect(url).toBe("/ingest/batch");
      expect(payload).toEqual(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              event: AnalyticsEvent.GAME_LOADED,
              userId: "user-123",
              puzzleNumber: 3,
            }),
          ]),
        }),
      );
      expect(payload.api_key).toBeUndefined();

      await Promise.resolve();
      expect(mockCapture).toHaveBeenCalledWith(
        AnalyticsEvent.GAME_LOADED,
        expect.objectContaining({
          source: "format-override",
        }),
      );
    });

    it("should skip direct PostHog capture for explicit posthog-batch override", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = "https://analytics.example.test/v1/events";
      process.env.NEXT_PUBLIC_ANALYTICS_FORMAT = "posthog-batch";
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
      });

      analytics.track(AnalyticsEvent.GAME_STARTED, { source: "batch-override" }, "user-999", 5);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string);
      expect(url).toBe("https://analytics.example.test/v1/events");
      expect(payload).toEqual(
        expect.objectContaining({
          api_key: "phc_test_key",
          batch: expect.arrayContaining([
            expect.objectContaining({
              event: AnalyticsEvent.GAME_STARTED,
              distinct_id: "user-999",
            }),
          ]),
          v: 1,
        }),
      );

      await Promise.resolve();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("should drop events when PostHog key is missing to avoid retry loop", () => {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = "/ingest/batch";
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "missing-key" });

      const summary = analytics.getSummary();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(summary.queueSize).toBe(0);
    });

    it("should cap queue growth when flush retries keep failing", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        maxQueueSize: 2,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { n: 1 });
      await Promise.resolve();
      analytics.track(AnalyticsEvent.GAME_STARTED, { n: 2 });
      await Promise.resolve();
      analytics.track(AnalyticsEvent.HINT_VIEWED, { n: 3 });
      await Promise.resolve();

      const summary = analytics.getSummary();
      expect(summary.queueSize).toBe(2);
    });

    it("should retry transient server errors (5xx)", async () => {
      mockFetch.mockResolvedValue(new Response("server error", { status: 503 }));
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "retry-5xx" });
      await Promise.resolve();
      await Promise.resolve();

      const summary = analytics.getSummary();
      expect(summary.queueSize).toBe(1);
    });

    it("should preserve event order when requeueing failed flushes", async () => {
      let rejectFirst: (reason?: unknown) => void = () => {};
      const firstFetch = new Promise<Response>((_resolve, reject) => {
        rejectFirst = reject;
      });

      mockFetch.mockImplementationOnce(() => firstFetch);
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { seq: 1 });
      analytics.track(AnalyticsEvent.GAME_STARTED, { seq: 2 });

      rejectFirst(new Error("network down"));
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));

      window.dispatchEvent(new Event("beforeunload"));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [, secondInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      const payload = JSON.parse(secondInit.body as string) as {
        events: Array<{ properties?: { seq?: number } }>;
      };

      expect(payload.events.map((event) => event.properties?.seq)).toEqual([1, 2]);
    });

    it("should omit keepalive on regular interval flushes", () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "interval" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.keepalive).toBeUndefined();
    });

    it("should use keepalive for beforeunload flush", () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 100,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "beforeunload" });
      window.dispatchEvent(new Event("beforeunload"));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.keepalive).toBe(true);
    });

    it("should allow keepalive flush while regular flush is in progress", async () => {
      let resolveFirst: (value: Response) => void = () => {};
      const firstFetch = new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });

      mockFetch.mockImplementationOnce(() => firstFetch);
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 1,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { seq: 1 });
      analytics.track(AnalyticsEvent.GAME_STARTED, { seq: 2 });

      window.dispatchEvent(new Event("beforeunload"));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [, secondInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(secondInit.keepalive).toBe(true);

      const payload = JSON.parse(secondInit.body as string) as {
        events: Array<{ properties?: { seq?: number } }>;
      };
      expect(payload.events.map((event) => event.properties?.seq)).toEqual([2]);

      resolveFirst(new Response(null, { status: 200 }));
      await Promise.resolve();
    });

    it("should use keepalive for visibilitychange flush", () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      const originalVisibilityState = Object.getOwnPropertyDescriptor(document, "visibilityState");
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });

      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;
      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 100,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "visibilitychange" });
      window.dispatchEvent(new Event("visibilitychange"));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.keepalive).toBe(true);

      if (originalVisibilityState) {
        Object.defineProperty(document, "visibilityState", originalVisibilityState);
      } else {
        delete (document as { visibilityState?: string }).visibilityState;
      }
    });

    it("should cap keepalive flush batch size to avoid oversized payloads", () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 200,
        flushInterval: 60000,
        endpoint: "https://analytics.example.test/v1/events",
      });

      for (let index = 0; index < 120; index += 1) {
        analytics.track(AnalyticsEvent.GAME_LOADED, { index });
      }
      window.dispatchEvent(new Event("beforeunload"));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string) as {
        events: Array<{ properties?: { index?: number } }>;
      };
      expect(payload.events).toHaveLength(50);
      expect(payload.events[0]?.properties?.index).toBe(0);
      expect(payload.events[49]?.properties?.index).toBe(49);

      const summary = analytics.getSummary();
      expect(summary.queueSize).toBe(70);
    });

    it("should keep queued events when endpoint is missing", () => {
      delete process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
      (GameAnalytics as unknown as { instance: undefined }).instance = undefined;

      analytics = GameAnalytics.getInstance({
        enabled: true,
        debugMode: false,
        sampleRate: 1,
        batchSize: 100,
        flushInterval: 60000,
      });

      analytics.track(AnalyticsEvent.GAME_LOADED, { source: "no-endpoint" });
      window.dispatchEvent(new Event("beforeunload"));

      const summary = analytics.getSummary();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(summary.queueSize).toBe(1);
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
