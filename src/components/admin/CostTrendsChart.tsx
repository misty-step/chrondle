"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";

/**
 * Cost Trends Chart - LLM API spending monitoring
 *
 * Displays:
 * - Daily cost for last 7 days (bar chart)
 * - 7-day average as horizontal reference line
 * - Cost breakdown by stage (Generator, Critic, Reviser) as stacked bars
 * - Cost per event metric
 *
 * Auto-refreshes via Convex subscription.
 */
export function CostTrendsChart() {
  const costMetrics = useQuery(api.observability.getCostMetricsQuery, { timeRange: "7d" });
  const last7Days = useQuery(api.generationLogs.getLast7DaysCosts, { days: 7 });

  if (!costMetrics || !last7Days) {
    return (
      <Card className="p-6">
        <h2 className="font-heading mb-4 text-lg font-semibold">Cost Trends</h2>
        <div className="text-text-secondary">Loading...</div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="font-heading mb-4 text-lg font-semibold">Cost Trends</h2>

      {/* Key Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-text-primary text-2xl font-bold">
            ${costMetrics.costToday.toFixed(2)}
          </div>
          <div className="text-text-secondary text-sm">today</div>
        </div>
        <div>
          <div className="text-text-primary text-2xl font-bold">
            ${costMetrics.cost7DayAvg.toFixed(2)}
          </div>
          <div className="text-text-secondary text-sm">7-day average</div>
        </div>
        <div>
          <div className="text-text-primary text-2xl font-bold">
            ${costMetrics.cost30Day.toFixed(2)}
          </div>
          <div className="text-text-secondary text-sm">30-day total</div>
        </div>
        <div>
          <div className="text-text-primary text-2xl font-bold">
            ${costMetrics.costPerEvent.toFixed(3)}
          </div>
          <div className="text-text-secondary text-sm">per event</div>
        </div>
      </div>

      {/* Simple Bar Chart */}
      <div className="space-y-2">
        <div className="text-text-primary text-sm font-medium">Last 7 Days</div>
        {last7Days.map(
          (day: {
            date: string;
            totalCost: number;
            eventsGenerated: number;
            successRate: number;
          }) => (
            <div key={day.date} className="flex items-center gap-2">
              <div className="text-text-secondary w-20 text-xs">{day.date.slice(5)}</div>
              <div className="flex-1">
                <div className="bg-surface-secondary h-6 rounded">
                  <div
                    className="h-6 rounded bg-blue-500"
                    style={{
                      width: `${Math.min(100, (day.totalCost / costMetrics.cost7DayAvg) * 50)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-text-primary w-16 text-right text-xs">
                ${day.totalCost.toFixed(2)}
              </div>
            </div>
          ),
        )}
      </div>
    </Card>
  );
}
