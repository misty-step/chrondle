"use client";

import React from "react";
import { PoolHealthCard } from "@/components/admin/PoolHealthCard";
import { CostTrendsChart } from "@/components/admin/CostTrendsChart";
import { QualityMetricsGrid } from "@/components/admin/QualityMetricsGrid";
import { RecentGenerationsTable } from "@/components/admin/RecentGenerationsTable";
import { TodaysPuzzlesCard } from "./TodaysPuzzlesCard";

/**
 * Overview Tab - Event Generation Observability
 *
 * Displays 5-panel grid of:
 * - Today's puzzles (daily ops visibility)
 * - Pool health (unused events, depletion timeline)
 * - Cost trends (daily spending, averages)
 * - Quality metrics (scores, failure rates)
 * - Recent generations (debug view)
 */
export default function OverviewTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Today's Puzzles - Daily Ops */}
      <div className="lg:col-span-2">
        <TodaysPuzzlesCard />
      </div>

      {/* Pool Health */}
      <div className="lg:col-span-1">
        <PoolHealthCard />
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
  );
}
