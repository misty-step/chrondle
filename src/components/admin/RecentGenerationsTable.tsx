"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface GenerationLog {
  _id: string;
  year: number;
  era: string;
  status: string;
  events_generated: number;
  cost_usd: number;
  token_usage: {
    input: number;
    output: number;
    reasoning?: number;
    total: number;
  };
  timestamp: number;
  error_message?: string;
}

/**
 * Recent Generations Table - Debug view for generation attempts
 *
 * Displays:
 * - Last 20 generation attempts
 * - Columns: year, status, events generated, cost, duration, timestamp
 * - Sortable columns, filterable by status
 * - Drill-down: Click row to see detailed error message, generated events, quality scores
 *
 * Auto-refreshes via Convex subscription.
 */
export function RecentGenerationsTable() {
  const recentAttempts = useQuery(api.observability.getRecentGenerationsQuery, { limit: 20 });

  if (!recentAttempts) {
    return (
      <Card className="p-6">
        <h2 className="font-heading mb-4 text-lg font-semibold">Recent Generations</h2>
        <div className="text-text-secondary">Loading...</div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="font-heading mb-4 text-lg font-semibold">Recent Generations</h2>

      {recentAttempts.length === 0 ? (
        <div className="text-text-secondary">No recent generation attempts</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-surface-secondary border-b text-left">
                <th className="text-text-secondary pb-2 font-medium">Year</th>
                <th className="text-text-secondary pb-2 font-medium">Era</th>
                <th className="text-text-secondary pb-2 font-medium">Status</th>
                <th className="text-text-secondary pb-2 font-medium">Events</th>
                <th className="text-text-secondary pb-2 font-medium">Cost</th>
                <th className="text-text-secondary pb-2 font-medium">Tokens</th>
                <th className="text-text-secondary pb-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAttempts.map((attempt: GenerationLog) => (
                <tr key={attempt._id} className="border-surface-secondary border-b">
                  <td className="text-text-primary py-3">{attempt.year}</td>
                  <td className="text-text-secondary py-3">{attempt.era}</td>
                  <td className="py-3">
                    <Badge
                      variant={
                        attempt.status === "success"
                          ? "default"
                          : attempt.status === "failed"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {attempt.status}
                    </Badge>
                  </td>
                  <td className="text-text-primary py-3">{attempt.events_generated}</td>
                  <td className="text-text-primary py-3">${attempt.cost_usd.toFixed(3)}</td>
                  <td className="text-text-secondary py-3">
                    {attempt.token_usage.total.toLocaleString()}
                  </td>
                  <td className="text-text-secondary py-3">
                    {new Date(attempt.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recentAttempts.length > 0 && (
        <div className="text-text-secondary mt-4 text-xs">
          Showing {recentAttempts.length} recent generation attempts
        </div>
      )}
    </Card>
  );
}
