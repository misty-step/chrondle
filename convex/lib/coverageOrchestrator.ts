import type { EraBucket, YearCandidateSource } from "./workSelector";

/**
 * Strategy for selecting years to generate events for in a batch.
 * Returned by selectWork() to guide Orchestrator.
 */
export interface CoverageStrategy {
  /** Years selected for generation in this batch */
  targetYears: number[];

  /** Primary priority driving year selection */
  priority: YearCandidateSource;

  /** Era distribution of selected years */
  eraBalance: Record<EraBucket, number>;
}
