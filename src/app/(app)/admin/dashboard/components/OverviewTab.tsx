"use client";

import React from "react";
import { PoolHealthCard } from "@/components/admin/PoolHealthCard";
import { CostTrendsChart } from "@/components/admin/CostTrendsChart";
import { QualityMetricsGrid } from "@/components/admin/QualityMetricsGrid";
import { RecentGenerationsTable } from "@/components/admin/RecentGenerationsTable";
import { TodaysPuzzlesCard } from "./TodaysPuzzlesCard";
import { ModeFilter, useGameMode } from "./shared/ModeFilter";

/**
 * Overview Tab - Event Generation Observability
 *
 * Displays 5-panel grid of:
 * - Today's puzzles (daily ops visibility)
 * - Pool health (unused events, depletion timeline)
 * - Cost trends (daily spending, averages)
 * - Quality metrics (scores, failure rates)
 * - Recent generations (debug view)
 *
 * Mode filter persists in URL, affects pool health metrics.
 */
export default function OverviewTab() {
  const mode = useGameMode();

  return (
    <div className="space-y-6">
      {/* Mode Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-lg font-medium">Event Generation</h2>
        <ModeFilter />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Puzzles - Daily Ops */}
        <div className="lg:col-span-2">
          <TodaysPuzzlesCard />
        </div>

        {/* Pool Health - Mode Filtered */}
        <div className="lg:col-span-1">
          <PoolHealthCard mode={mode} />
        </div>

        {/* Cost Trends */}
        <div className="lg:col-span-1">
          <CostTrendsChart />
        </div>

        {/* Quality Metrics */}
        <div className="lg:col-span-1">
          <QualityMetricsGrid />
        </div>

        {/* Recent Generations - Full Width */}
        <div className="lg:col-span-2">
          <RecentGenerationsTable />
        </div>
      </div>
    </div>
  );
}
