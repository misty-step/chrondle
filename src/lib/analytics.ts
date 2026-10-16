import { logger } from "@/lib/logger";
import { captureProductEvent } from "@/lib/posthog";
import { GameState, isReady } from "@/types/gameState";

export enum AnalyticsEvent {
  GAME_LOADED = "game_loaded",
  GAME_STARTED = "game_started",
  GAME_COMPLETED = "game_completed",
  GAME_RESET = "game_reset",
  STATE_TRANSITION = "state_transition",
  STATE_ERROR = "state_error",
  STATE_DIVERGENCE = "state_divergence",
  GUESS_SUBMITTED = "guess_submitted",
  HINT_VIEWED = "hint_viewed",
  PROGRESS_LOST = "progress_lost",
  PROGRESS_RESTORED = "progress_restored",
  SLOW_DERIVATION = "slow_derivation",
  SLOW_QUERY = "slow_query",
  RETURN_HOOK_SHOWN = "return_hook_shown",
  REMINDER_OPTIN = "reminder_optin",
}

export interface StateTransition {
  from: string;
  to: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface DivergenceResult {
  hasDivergence: boolean;
  sessionGuesses: number[];
  serverGuesses: number[];
  divergenceType?: "missing_server" | "missing_session" | "mismatch";
  details?: string;
}

interface AnalyticsConfig {
  enabled: boolean;
  debugMode: boolean;
  sampleRate: number;
}

// Local diagnostics stay local. The official PostHog SDK owns all transport,
// sessions, anonymous identity, batching and bounded retries.
export class GameAnalytics {
  private static instance: GameAnalytics;
  private config: AnalyticsConfig;
  private eventCounts: Partial<Record<AnalyticsEvent, number>> = {};
  private sessionId = this.generateSessionId();
  private lastState: GameState | null = null;
  private stateHistory: StateTransition[] = [];

  private constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      enabled:
        process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true",
      debugMode: process.env.NODE_ENV === "development",
      sampleRate: 1,
      ...config,
    };
  }

  public static getInstance(config?: Partial<AnalyticsConfig>): GameAnalytics {
    return (GameAnalytics.instance ??= new GameAnalytics(config));
  }

  public trackStateTransition(
    previousState: GameState | null,
    newState: GameState,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.config.enabled) return;
    const from = previousState?.status || "initial";
    const to = newState.status;
    this.stateHistory.push({ from, to, timestamp: Date.now(), metadata });
    this.stateHistory = this.stateHistory.slice(-50);
    if (
      previousState &&
      isReady(previousState) &&
      isReady(newState) &&
      previousState.guesses.length > newState.guesses.length
    ) {
      this.trackProgressLost(previousState.guesses, newState.guesses, undefined);
    }
    if (previousState?.status === "ready" && to === "loading-progress") {
      this.track(AnalyticsEvent.STATE_ERROR, { issue: "backward_transition", from, to });
    }
    this.track(AnalyticsEvent.STATE_TRANSITION, { from, to, ...metadata });
    this.lastState = newState;
  }

  public trackGuess(
    guess: number,
    targetYear: number,
    guessNumber: number,
    isCorrect: boolean,
    userId?: string | null,
  ): void {
    const distance = Math.abs(guess - targetYear);
    this.track(
      AnalyticsEvent.GUESS_SUBMITTED,
      {
        guessNumber,
        isCorrect,
        distance,
        direction: guess < targetYear ? "before" : guess > targetYear ? "after" : "exact",
        accuracy: isCorrect ? 1 : Math.max(0, 1 - distance / 1000),
      },
      userId,
    );
  }

  public trackCompletion(
    won: boolean,
    guessCount: number,
    timeSpent: number,
    puzzleNumber: number,
    userId?: string | null,
  ): void {
    this.track(
      AnalyticsEvent.GAME_COMPLETED,
      {
        won,
        guessCount,
        timeSpent,
        puzzleNumber,
        completionRate: won ? 1 : 0,
        efficiency: won ? (6 - guessCount + 1) / 6 : 0,
      },
      userId,
    );
  }

  public detectDivergence(
    sessionGuesses: number[],
    serverGuesses: number[],
    userId?: string | null,
  ): DivergenceResult {
    const result: DivergenceResult = { hasDivergence: false, sessionGuesses, serverGuesses };
    if (sessionGuesses.length !== serverGuesses.length) {
      result.hasDivergence = true;
      if (serverGuesses.length === 0) {
        result.divergenceType = "missing_server";
        result.details = "Session has guesses but server doesn't";
      } else if (sessionGuesses.length === 0) {
        result.divergenceType = "missing_session";
        result.details = "Server has guesses but session doesn't";
      } else {
        result.divergenceType = "mismatch";
        result.details = `Session has ${sessionGuesses.length} guesses, server has ${serverGuesses.length}`;
      }
    } else {
      for (let i = 0; i < sessionGuesses.length; i++) {
        if (sessionGuesses[i] !== serverGuesses[i]) {
          result.hasDivergence = true;
          result.divergenceType = "mismatch";
          result.details = `Guess ${i + 1} differs: session=${sessionGuesses[i]}, server=${serverGuesses[i]}`;
          break;
        }
      }
    }
    if (result.hasDivergence) {
      this.track(
        AnalyticsEvent.STATE_DIVERGENCE,
        {
          divergenceType: result.divergenceType,
          details: result.details,
          sessionCount: sessionGuesses.length,
          serverCount: serverGuesses.length,
        },
        userId,
      );
    }
    return result;
  }

  public trackProgressLost(
    expectedGuesses: number[],
    actualGuesses: number[],
    userId?: string | null,
  ): void {
    this.track(
      AnalyticsEvent.PROGRESS_LOST,
      {
        expected: expectedGuesses,
        actual: actualGuesses,
        lostCount: expectedGuesses.length - actualGuesses.length,
        stateHistory: this.stateHistory.slice(-5),
      },
      userId,
    );
  }

  public trackPerformance(
    operation: "derivation" | "query",
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    const threshold = operation === "derivation" ? 10 : 200;
    if (duration > threshold) {
      this.track(
        operation === "derivation" ? AnalyticsEvent.SLOW_DERIVATION : AnalyticsEvent.SLOW_QUERY,
        {
          duration,
          threshold,
          excess: duration - threshold,
          ...metadata,
        },
      );
    }
  }

  public getSummary(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      queueSize: 0,
      recentTransitions: this.stateHistory.slice(-10),
      eventCounts: { ...this.eventCounts },
      lastState: this.lastState?.status,
      enabled: this.config.enabled,
    };
  }

  public track(
    event: AnalyticsEvent,
    properties?: Record<string, unknown>,
    _userId?: string | null,
    _puzzleNumber?: number,
  ): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) return;
    this.eventCounts[event] = (this.eventCounts[event] ?? 0) + 1;
    if (this.config.debugMode) logger.error("[Analytics]", event, properties);
    // No account IDs or local diagnostic histories cross this transport boundary.
    captureProductEvent(event, properties);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  public reset(): void {
    this.eventCounts = {};
    this.stateHistory = [];
    this.lastState = null;
    this.sessionId = this.generateSessionId();
  }
}

export const analytics = GameAnalytics.getInstance();
