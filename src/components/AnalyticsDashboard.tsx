"use client";

import React, { useState, useEffect } from "react";
import { analytics } from "@/lib/analytics";
import type { StateTransition } from "@/lib/analytics";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, AlertTriangle, Users, Activity } from "lucide-react";

/**
 * Analytics summary type
 */
interface AnalyticsSummary {
  sessionId?: string;
  queueSize?: number;
  recentTransitions?: StateTransition[];
  eventCounts?: Record<string, number>;
  lastState?: string;
  enabled?: boolean;
}

/**
 * Analytics Dashboard Component
 *
 * Displays real-time analytics data for monitoring game health,
 * state transitions, and potential issues.
 *
 * Only visible in development mode or when analytics debug is enabled.
 */
export function AnalyticsDashboard() {
  const [isVisible, setIsVisible] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Only show in development or with debug flag
  const shouldShow =
    process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

  useEffect(() => {
    if (!shouldShow) return;

    // Keyboard shortcut to toggle dashboard (Ctrl+Shift+A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shouldShow]);

  useEffect(() => {
    if (!isVisible) return;

    // Update summary data
    const updateSummary = () => {
      setSummary(analytics.getSummary() as AnalyticsSummary);
    };

    updateSummary();

    // Auto-refresh every 2 seconds
    const interval = setInterval(updateSummary, 2000);

    return () => clearInterval(interval);
  }, [isVisible, refreshKey]);

  if (!shouldShow || !isVisible) {
    return null;
  }

  const {
    sessionId,
    queueSize = 0,
    recentTransitions = [],
    eventCounts = {},
    lastState,
    enabled,
  } = summary;

  // Calculate metrics
  const totalEvents = Object.values(eventCounts || {}).reduce(
    (sum: number, count: number) => sum + count,
    0,
  );
  const divergenceCount = eventCounts?.state_divergence || 0;
  const errorCount = eventCounts?.state_error || 0;
  const completionCount = eventCounts?.game_completed || 0;

  return (
    <div className="fixed right-4 bottom-4 z-50 max-h-[600px] w-96 overflow-auto">
      <Card className="bg-background/95 border-primary/20 shadow-xl backdrop-blur">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Activity className="text-body-primary h-5 w-5" />
            <h3 className="font-bold">Analytics Dashboard</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? "Active" : "Disabled"}
            </Badge>
            <button
              onClick={() => setIsVisible(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close dashboard"
            >
              ×
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 p-4">
          <MetricCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Total Events"
            value={totalEvents}
            color="text-body-primary"
          />
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Queue Size"
            value={queueSize}
            color="text-blue-500"
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Completions"
            value={completionCount}
            color="text-green-500"
          />
          <MetricCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Issues"
            value={divergenceCount + errorCount}
            color={divergenceCount + errorCount > 0 ? "text-red-500" : "text-muted-foreground"}
          />
        </div>

        {/* State Info */}
        <div className="px-4 pb-2">
          <div className="text-muted-foreground mb-1 text-xs">Current State</div>
          <Badge variant="outline" className="font-mono">
            {lastState || "unknown"}
          </Badge>
        </div>

        {/* Recent Transitions */}
        {recentTransitions && recentTransitions.length > 0 && (
          <div className="px-4 pb-4">
            <div className="text-muted-foreground mb-2 text-xs">Recent Transitions</div>
            <div className="space-y-1">
              {recentTransitions
                .slice(-5)
                .reverse()
                .map((transition, index) => (
                  <div
                    key={index}
                    className="bg-muted/50 flex items-center justify-between rounded px-2 py-1 text-xs"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">{transition.from}</span>
                      <span>→</span>
                      <span className="font-medium">{transition.to}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(transition.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Event Breakdown */}
        {eventCounts && Object.keys(eventCounts).length > 0 && (
          <div className="px-4 pb-4">
            <div className="text-muted-foreground mb-2 text-xs">Event Breakdown</div>
            <div className="space-y-1">
              {Object.entries(eventCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([event, count]) => (
                  <div key={event} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{event.replace(/_/g, " ")}</span>
                    <Badge variant="secondary" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {(divergenceCount > 0 || errorCount > 0) && (
          <div className="border-t px-4 pb-4">
            <div className="text-muted-foreground mt-2 mb-2 text-xs">Alerts</div>
            {divergenceCount > 0 && (
              <div className="mb-1 flex items-center gap-2 text-xs text-yellow-600">
                <AlertTriangle className="h-3 w-3" />
                <span>{divergenceCount} state divergence(s) detected</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>{errorCount} state error(s) detected</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t px-4 pb-4">
          <div className="mt-2 flex items-center justify-between">
            <div className="text-muted-foreground text-xs">
              Session: {sessionId?.slice(0, 8)}...
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="h-6 text-xs"
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Metric card component
 */
function MetricCard({
  icon,
  label,
  value,
  color = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="bg-muted/50 rounded p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-muted-foreground text-xs">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
