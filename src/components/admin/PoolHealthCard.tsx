"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";

/**
 * Pool Health Card - Event pool availability monitoring
 *
 * Displays:
 * - Unused events count (large number)
 * - Days until depletion (color-coded: green >90, yellow 30-90, red <30)
 * - Era coverage breakdown (ancient/medieval/modern as progress bars)
 * - Year coverage trend (line chart, last 30 days)
 *
 * Auto-refreshes via Convex subscription.
 */
export function PoolHealthCard() {
  // Default to "all" mode - shows events unused in both Classic and Order
  const poolHealth = useQuery(api.observability.getPoolHealthQuery, { mode: "all" });

  if (!poolHealth) {
    return (
      <Card className="p-6">
        <h2 className="font-heading mb-4 text-lg font-semibold">Pool Health</h2>
        <div className="text-text-secondary">Loading...</div>
      </Card>
    );
  }

  // Color coding for days until depletion
  const depletionColor =
    poolHealth.daysUntilDepletion > 90
      ? "text-green-600 dark:text-green-400"
      : poolHealth.daysUntilDepletion > 30
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <Card className="p-6">
      <h2 className="font-heading mb-4 text-lg font-semibold">Pool Health</h2>

      {/* Unused Events Count */}
      <div className="mb-6">
        <div className="text-text-primary text-4xl font-bold">{poolHealth.unusedEvents}</div>
        <div className="text-text-secondary text-sm">unused events available</div>
      </div>

      {/* Days Until Depletion */}
      <div className="mb-6">
        <div className={`text-2xl font-semibold ${depletionColor}`}>
          {poolHealth.daysUntilDepletion} days
        </div>
        <div className="text-text-secondary text-sm">until depletion</div>
      </div>

      {/* Era Coverage */}
      <div className="space-y-3">
        <div className="text-text-primary text-sm font-medium">Coverage by Era</div>

        {/* Ancient */}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-text-secondary">Ancient (&lt;500 CE)</span>
            <span className="text-text-primary">{poolHealth.coverageByEra.ancient}</span>
          </div>
          <div className="bg-surface-secondary h-2 rounded-full">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{
                width: `${Math.min(100, (poolHealth.coverageByEra.ancient / poolHealth.unusedEvents) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Medieval */}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-text-secondary">Medieval (500-1499 CE)</span>
            <span className="text-text-primary">{poolHealth.coverageByEra.medieval}</span>
          </div>
          <div className="bg-surface-secondary h-2 rounded-full">
            <div
              className="h-2 rounded-full bg-purple-500"
              style={{
                width: `${Math.min(100, (poolHealth.coverageByEra.medieval / poolHealth.unusedEvents) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Modern */}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-text-secondary">Modern (≥1500 CE)</span>
            <span className="text-text-primary">{poolHealth.coverageByEra.modern}</span>
          </div>
          <div className="bg-surface-secondary h-2 rounded-full">
            <div
              className="h-2 rounded-full bg-green-500"
              style={{
                width: `${Math.min(100, (poolHealth.coverageByEra.modern / poolHealth.unusedEvents) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
