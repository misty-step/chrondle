/**
 * Analytics module for tracking game state transitions and user behavior
 *
 * This module provides:
 * - State transition tracking for debugging race conditions
 * - Completion rate monitoring
 * - Guess pattern analysis
 * - Session vs persisted state divergence detection
 * - Production telemetry integration
 */

import { logger } from "@/lib/logger";
import { GameState, isReady } from "@/types/gameState";

// Lazy-loaded PostHog - avoids bundling in initial chunk
let posthogPromise: Promise<typeof import("posthog-js").default> | null = null;

function getPostHog(): Promise<typeof import("posthog-js").default> {
  if (!posthogPromise) {
    posthogPromise = import("posthog-js").then((m) => m.default);
  }
  return posthogPromise;
}

/**
 * Analytics event types for game state tracking
 */
export enum AnalyticsEvent {
  // Game lifecycle events
  GAME_LOADED = "game_loaded",
  GAME_STARTED = "game_started",
  GAME_COMPLETED = "game_completed",
  GAME_RESET = "game_reset",

  // State transition events
  STATE_TRANSITION = "state_transition",
  STATE_ERROR = "state_error",
  STATE_DIVERGENCE = "state_divergence",

  // User interaction events
  GUESS_SUBMITTED = "guess_submitted",
  HINT_VIEWED = "hint_viewed",

  // Progress tracking
  PROGRESS_LOST = "progress_lost",
  PROGRESS_RESTORED = "progress_restored",

  // Performance events
  SLOW_DERIVATION = "slow_derivation",
  SLOW_QUERY = "slow_query",
}

/**
 * Event data payload for analytics
 */
export interface AnalyticsEventData {
  event: AnalyticsEvent;
  timestamp: number;
  properties?: Record<string, unknown>;
  userId?: string | null;
  sessionId: string;
  puzzleNumber?: number;
  environment: "development" | "production";
}

/**
 * State transition tracking data
 */
export interface StateTransition {
  from: string;
  to: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Divergence detection result
 */
export interface DivergenceResult {
  hasDivergence: boolean;
  sessionGuesses: number[];
  serverGuesses: number[];
  divergenceType?: "missing_server" | "missing_session" | "mismatch";
  details?: string;
}

/**
 * Analytics configuration
 */
interface AnalyticsConfig {
  enabled: boolean;
  debugMode: boolean;
  sampleRate: number; // 0-1, for production sampling
  endpoint?: string; // Analytics endpoint URL
  batchSize: number;
  flushInterval: number; // ms
}

/**
 * Main analytics class for game state tracking
 */
export class GameAnalytics {
  private static instance: GameAnalytics;
  private config: AnalyticsConfig;
  private eventQueue: AnalyticsEventData[] = [];
  private sessionId: string;
  private lastState: GameState | null = null;
  private stateHistory: StateTransition[] = [];
  private flushTimer?: NodeJS.Timeout;

  private constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      enabled:
        process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true",
      debugMode: process.env.NODE_ENV === "development",
      sampleRate: 1.0, // Track all events by default
      batchSize: 10,
      flushInterval: 5000, // 5 seconds
      ...config,
    };

    // Generate session ID
    this.sessionId = this.generateSessionId();

    // Start flush timer if enabled
    if (this.config.enabled) {
      this.startFlushTimer();
    }

    // Bind window events for cleanup
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flush());
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flush();
        }
      });
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<AnalyticsConfig>): GameAnalytics {
    if (!GameAnalytics.instance) {
      GameAnalytics.instance = new GameAnalytics(config);
    }
    return GameAnalytics.instance;
  }

  /**
   * Track a state transition
   */
  public trackStateTransition(
    previousState: GameState | null,
    newState: GameState,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.config.enabled) return;

    const fromStatus = previousState?.status || "initial";
    const toStatus = newState.status;

    // Record transition
    const transition: StateTransition = {
      from: fromStatus,
      to: toStatus,
      timestamp: Date.now(),
      metadata,
    };

    this.stateHistory.push(transition);

    // Detect potential issues
    this.detectStateIssues(previousState, newState);

    // Track the transition event
    this.track(AnalyticsEvent.STATE_TRANSITION, {
      from: fromStatus,
      to: toStatus,
      ...metadata,
    });

    // Store last state for comparison
    this.lastState = newState;
  }

  /**
   * Track a guess submission
   */
  public trackGuess(
    guess: number,
    targetYear: number,
    guessNumber: number,
    isCorrect: boolean,
    userId?: string | null,
  ): void {
    if (!this.config.enabled) return;

    const distance = Math.abs(guess - targetYear);
    const direction = guess < targetYear ? "before" : guess > targetYear ? "after" : "exact";

    this.track(
      AnalyticsEvent.GUESS_SUBMITTED,
      {
        guessNumber,
        isCorrect,
        distance,
        direction,
        accuracy: isCorrect ? 1 : Math.max(0, 1 - distance / 1000), // Accuracy score
      },
      userId,
    );
  }

  /**
   * Track game completion
   */
  public trackCompletion(
    won: boolean,
    guessCount: number,
    timeSpent: number,
    puzzleNumber: number,
    userId?: string | null,
  ): void {
    if (!this.config.enabled) return;

    this.track(
      AnalyticsEvent.GAME_COMPLETED,
      {
        won,
        guessCount,
        timeSpent,
        puzzleNumber,
        completionRate: won ? 1 : 0,
        efficiency: won ? (6 - guessCount + 1) / 6 : 0, // Higher score for fewer guesses
      },
      userId,
    );
  }

  /**
   * Detect session vs server state divergence
   */
  public detectDivergence(
    sessionGuesses: number[],
    serverGuesses: number[],
    userId?: string | null,
  ): DivergenceResult {
    const result: DivergenceResult = {
      hasDivergence: false,
      sessionGuesses,
      serverGuesses,
    };

    // Check for divergence
    if (sessionGuesses.length !== serverGuesses.length) {
      result.hasDivergence = true;
      if (serverGuesses.length === 0 && sessionGuesses.length > 0) {
        result.divergenceType = "missing_server";
        result.details = "Session has guesses but server doesn't";
      } else if (sessionGuesses.length === 0 && serverGuesses.length > 0) {
        result.divergenceType = "missing_session";
        result.details = "Server has guesses but session doesn't";
      } else {
        result.divergenceType = "mismatch";
        result.details = `Session has ${sessionGuesses.length} guesses, server has ${serverGuesses.length}`;
      }
    } else {
      // Check if guesses match
      for (let i = 0; i < sessionGuesses.length; i++) {
        if (sessionGuesses[i] !== serverGuesses[i]) {
          result.hasDivergence = true;
          result.divergenceType = "mismatch";
          result.details = `Guess ${i + 1} differs: session=${sessionGuesses[i]}, server=${serverGuesses[i]}`;
          break;
        }
      }
    }

    // Track divergence if detected
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

  /**
   * Track when user loses progress (the original bug we're fixing)
   */
  public trackProgressLost(
    expectedGuesses: number[],
    actualGuesses: number[],
    userId?: string | null,
  ): void {
    if (!this.config.enabled) return;

    this.track(
      AnalyticsEvent.PROGRESS_LOST,
      {
        expected: expectedGuesses,
        actual: actualGuesses,
        lostCount: expectedGuesses.length - actualGuesses.length,
        stateHistory: this.getRecentStateHistory(),
      },
      userId,
    );
  }

  /**
   * Track performance metrics
   */
  public trackPerformance(
    operation: "derivation" | "query",
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.config.enabled) return;

    // Only track slow operations
    const threshold = operation === "derivation" ? 10 : 200; // ms
    if (duration > threshold) {
      const event =
        operation === "derivation" ? AnalyticsEvent.SLOW_DERIVATION : AnalyticsEvent.SLOW_QUERY;

      this.track(event, {
        duration,
        threshold,
        excess: duration - threshold,
        ...metadata,
      });
    }
  }

  /**
   * Get analytics summary for monitoring
   */
  public getSummary(): Record<string, unknown> {
    const recentTransitions = this.stateHistory.slice(-10);
    const eventCounts = this.eventQueue.reduce(
      (acc, event) => {
        acc[event.event] = (acc[event.event] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      sessionId: this.sessionId,
      queueSize: this.eventQueue.length,
      recentTransitions,
      eventCounts,
      lastState: this.lastState?.status,
      enabled: this.config.enabled,
    };
  }

  /**
   * Core tracking method
   */
  public track(
    event: AnalyticsEvent,
    properties?: Record<string, unknown>,
    userId?: string | null,
    puzzleNumber?: number,
  ): void {
    if (!this.config.enabled) return;

    // Apply sampling rate
    if (Math.random() > this.config.sampleRate) return;

    const eventData: AnalyticsEventData = {
      event,
      timestamp: Date.now(),
      properties,
      userId,
      sessionId: this.sessionId,
      puzzleNumber,
      environment: process.env.NODE_ENV as "development" | "production",
    };

    // Add to queue
    this.eventQueue.push(eventData);

    // Debug logging
    if (this.config.debugMode) {
      // Using console.error which is allowed by ESLint
      logger.error("[Analytics]", event, properties);
    }

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }

    // Send to PostHog if available (lazy-loaded for bundle optimization)
    if (typeof window !== "undefined") {
      getPostHog().then((posthog) => {
        if (posthog.__loaded) {
          posthog.capture(event, {
            ...properties,
            user_id: userId,
            session_id: this.sessionId,
          });
        }
      });
    }
  }

  /**
   * Detect potential state issues
   */
  private detectStateIssues(previousState: GameState | null, newState: GameState): void {
    // Detect if progress was lost
    if (
      previousState &&
      isReady(previousState) &&
      isReady(newState) &&
      previousState.guesses.length > newState.guesses.length
    ) {
      this.trackProgressLost(previousState.guesses, newState.guesses, undefined);
    }

    // Detect unexpected state transitions
    if (previousState?.status === "ready" && newState.status === "loading-progress") {
      // This shouldn't happen - going backwards in loading priority
      this.track(AnalyticsEvent.STATE_ERROR, {
        issue: "backward_transition",
        from: previousState.status,
        to: newState.status,
      });
    }
  }

  /**
   * Get recent state history for debugging
   */
  private getRecentStateHistory(): StateTransition[] {
    return this.stateHistory.slice(-5);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  /**
   * Flush event queue to analytics service
   */
  private flush(): void {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // In production, send to analytics endpoint
    if (this.config.endpoint) {
      fetch(this.config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true, // Important for beforeunload
      }).catch((error) => {
        logger.error("Analytics flush failed:", error);
        // Re-add events to queue for retry
        this.eventQueue.unshift(...events);
      });
    }

    // Debug output
    if (this.config.debugMode) {
      // Using console.error which is allowed by ESLint
      logger.error("[Analytics] Flushed", events.length, "events");
    }
  }

  /**
   * Reset analytics (for testing)
   */
  public reset(): void {
    this.eventQueue = [];
    this.stateHistory = [];
    this.lastState = null;
    this.sessionId = this.generateSessionId();
  }
}

// Export singleton instance
export const analytics = GameAnalytics.getInstance();
