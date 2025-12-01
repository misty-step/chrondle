"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";

/**
 * Quality Metrics Grid - Event quality monitoring
 *
 * Displays:
 * - Average quality score (large number with trend arrow)
 * - Individual score dimensions (factual, leakage, ambiguity, guessability, metadata)
 * - Failure rate percentage with 30-day trend
 * - Top 5 failure reasons with counts
 *
 * Auto-refreshes via Convex subscription.
 */
export function QualityMetricsGrid() {
  const qualityMetrics = useQuery(api.observability.getQualityMetricsQuery, { timeRange: "7d" });

  if (!qualityMetrics) {
    return (
      <Card className="p-6">
        <h2 className="font-heading mb-4 text-lg font-semibold">Quality Metrics</h2>
        <div className="text-text-secondary">Loading...</div>
      </Card>
    );
  }

  const scorePercentage = (qualityMetrics.avgQualityScore * 100).toFixed(1);
  const failurePercentage = (qualityMetrics.failureRate * 100).toFixed(1);

  return (
    <Card className="p-6">
      <h2 className="font-heading mb-4 text-lg font-semibold">Quality Metrics</h2>

      {/* Average Quality Score */}
      <div className="mb-6">
        <div className="text-text-primary text-4xl font-bold">{scorePercentage}%</div>
        <div className="text-text-secondary text-sm">average quality score</div>
      </div>

      {/* Failure Rate */}
      <div className="mb-6">
        <div
          className={`text-2xl font-semibold ${
            qualityMetrics.failureRate > 0.5
              ? "text-red-600 dark:text-red-400"
              : qualityMetrics.failureRate > 0.2
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-green-600 dark:text-green-400"
          }`}
        >
          {failurePercentage}%
        </div>
        <div className="text-text-secondary text-sm">failure rate</div>
      </div>

      {/* Top Failure Reasons */}
      {qualityMetrics.topFailureReasons.length > 0 && (
        <div className="space-y-2">
          <div className="text-text-primary text-sm font-medium">Top Failure Reasons</div>
          {qualityMetrics.topFailureReasons
            .slice(0, 5)
            .map((reason: { reason: string; count: number }, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{reason.reason}</span>
                <span className="bg-surface-secondary text-text-primary rounded px-2 py-1 text-xs">
                  {reason.count}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Quality Trend */}
      {qualityMetrics.qualityTrend.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-text-primary text-sm font-medium">7-Day Trend</div>
          <div className="flex items-end gap-1">
            {qualityMetrics.qualityTrend.map((score: number, index: number) => (
              <div key={index} className="flex-1">
                <div className="bg-surface-secondary h-12 rounded-t">
                  <div
                    className="rounded-t bg-green-500"
                    style={{
                      height: `${score * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
