/**
 * Unified metrics interfaces for event generation observability.
 *
 * Provides comprehensive observability across:
 * - Pool health (unused events, depletion tracking, era coverage)
 * - Cost tracking (daily, weekly, monthly aggregates)
 * - Quality metrics (scores, failure rates, trends)
 * - Generation latency (percentiles, averages)
 *
 * Design principle: Deep module - simple interface hiding aggregation complexity.
 */

/**
 * Pool health metrics - tracks event availability and coverage.
 */
export interface PoolHealthMetrics {
  /** Total number of unused events available for puzzle assignment */
  unusedEvents: number;

  /** Estimated days until pool depletes (based on 6 events/day consumption) */
  daysUntilDepletion: number;

  /** Coverage breakdown by historical era */
  coverageByEra: {
    /** Events from years < 500 CE */
    ancient: number;
    /** Events from years 500-1499 CE */
    medieval: number;
    /** Events from years >= 1500 CE */
    modern: number;
  };

  /** Number of years with at least one event ready */
  yearsReady: number;
}

/**
 * Cost tracking metrics - monitors LLM API spending.
 */
export interface CostTrackingMetrics {
  /** Total cost spent today (USD) */
  costToday: number;

  /** 7-day rolling average daily cost (USD) */
  cost7DayAvg: number;

  /** 30-day total cost (USD) */
  cost30Day: number;

  /** Average cost per successfully generated event (USD) */
  costPerEvent: number;
}

/**
 * Quality metrics - tracks event quality and failure patterns.
 */
export interface QualityMetrics {
  /** Average quality score across all generated events (0-1 scale) */
  avgQualityScore: number;

  /** Percentage of generation attempts that failed (0-1 scale) */
  failureRate: number;

  /** Most common failure reasons with counts */
  topFailureReasons: Array<{
    reason: string;
    count: number;
  }>;

  /** Quality score trend over last 7 days (daily averages) */
  qualityTrend: number[];
}

/**
 * Generation latency metrics - tracks performance characteristics.
 */
export interface GenerationLatencyMetrics {
  /** 50th percentile latency in milliseconds */
  p50: number;

  /** 95th percentile latency in milliseconds */
  p95: number;

  /** 99th percentile latency in milliseconds */
  p99: number;

  /** Mean latency in milliseconds */
  avgDuration: number;
}

/**
 * Unified metrics interface combining all observability dimensions.
 *
 * Success criteria: Comprehensive observability covering all critical dimensions
 * for event generation health monitoring and alerting.
 */
export interface Metrics {
  /** Pool health metrics */
  poolHealth: PoolHealthMetrics;

  /** Cost tracking metrics */
  cost: CostTrackingMetrics;

  /** Quality metrics */
  quality: QualityMetrics;

  /** Generation latency metrics */
  latency: GenerationLatencyMetrics;

  /** Timestamp when metrics were computed (milliseconds since epoch) */
  timestamp: number;
}

/**
 * Time range specification for metrics queries.
 */
export type TimeRange = "1h" | "24h" | "7d" | "30d" | "all";

/**
 * Generation result from orchestrator for metrics recording.
 */
export interface GenerationResult {
  /** Target year that was generated */
  year: number;

  /** Era classification */
  era: "BCE" | "CE";

  /** Generation outcome */
  status: "success" | "failed" | "skipped";

  /** Number of events successfully generated */
  eventsGenerated: number;

  /** Token usage breakdown */
  tokenUsage: {
    input: number;
    output: number;
    reasoning?: number;
    total: number;
  };

  /** Cost in USD */
  costUsd: number;

  /** Generation duration in milliseconds */
  durationMs: number;

  /** Optional quality score if available (0-1 scale) */
  qualityScore?: number;

  /** Optional error message if generation failed */
  errorMessage?: string;

  /** Cache performance */
  cacheHits?: number;
  cacheMisses?: number;

  /** Fallback count (times fell back to GPT-5-mini) */
  fallbackCount?: number;
}

/**
 * Puzzle creation result for metrics recording.
 */
export interface PuzzleCreationResult {
  /** Puzzle number */
  puzzleNumber: number;

  /** Year the puzzle is based on */
  year: number;

  /** Number of events used in the puzzle */
  eventCount: number;

  /** Timestamp of creation */
  timestamp: number;
}
