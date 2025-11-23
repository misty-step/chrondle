"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

/**
 * Skeleton component for loading state
 */
export const HistoricalContextSkeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <Card className={`border-muted/50 border-2 ${className}`}>
      <div className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="bg-muted h-8 w-8 animate-pulse rounded-full"></div>
          <div>
            <div className="bg-muted mb-1 h-4 w-32 animate-pulse rounded"></div>
            <div className="bg-muted h-3 w-20 animate-pulse rounded"></div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-muted h-4 w-full animate-pulse rounded"></div>
          <div className="bg-muted h-4 w-5/6 animate-pulse rounded"></div>
          <div className="bg-muted h-4 w-4/5 animate-pulse rounded"></div>
          <div className="bg-muted h-4 w-full animate-pulse rounded"></div>
          <div className="bg-muted h-4 w-3/4 animate-pulse rounded"></div>
        </div>

        <div className="border-muted mt-4 border-t pt-4">
          <div className="bg-muted h-3 w-48 animate-pulse rounded"></div>
        </div>
      </div>
    </Card>
  );
};

/**
 * Error component for failed context generation
 */
export const HistoricalContextError: React.FC<{
  onRetry?: () => void;
  className?: string;
}> = ({ onRetry, className = "" }) => {
  return (
    <Card
      className={`border-2 border-red-500/20 bg-gradient-to-br from-red-500/5 to-red-600/10 ${className}`}
    >
      <div className="p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h3 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-300">
          Context Unavailable
        </h3>

        <p className="mb-4 text-red-600 dark:text-red-400">
          We couldn&apos;t generate historical context for this year. This might be due to a
          temporary service issue.
        </p>

        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try Again
          </Button>
        )}
      </div>
    </Card>
  );
};
