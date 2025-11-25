"use client";

import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { Archive, Home, RotateCw } from "lucide-react";
import Link from "next/link";
import { logger } from "@/lib/logger";

interface ArchiveErrorBoundaryProps {
  children: React.ReactNode;
  year?: string | number;
}

/**
 * Specialized error boundary for archive routes with custom fallback UI
 */
export function ArchiveErrorBoundary({ children, year }: ArchiveErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="bg-card mx-4 w-full max-w-md rounded-sm border p-6 shadow-lg">
            <div className="text-center">
              <div className="mb-4 text-4xl">🚨</div>
              <h1 className="text-foreground mb-2 text-xl font-bold">Archive Error</h1>
              <p className="text-muted-foreground mb-6">
                {year
                  ? `Unable to load the puzzle for year ${year}.`
                  : "Unable to load the puzzle archive."}
                {" This has been logged for investigation."}
              </p>

              <div className="space-y-3">
                <Link href="/archive" className="block">
                  <button className="bg-primary text-body-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-sm px-4 py-2 transition-colors">
                    <Archive className="h-4 w-4" />
                    Return to Archive
                  </button>
                </Link>

                <Link href="/" className="block">
                  <button className="bg-secondary text-body-secondary-foreground hover:bg-secondary/90 flex w-full items-center justify-center gap-2 rounded-sm px-4 py-2 transition-colors">
                    <Home className="h-4 w-4" />
                    Go to Today&apos;s Puzzle
                  </button>
                </Link>

                <button
                  onClick={() => window.location.reload()}
                  className="bg-muted text-muted-foreground hover:bg-muted/90 flex w-full items-center justify-center gap-2 rounded-sm px-4 py-2 transition-colors"
                >
                  <RotateCw className="h-4 w-4" />
                  Try Again
                </button>
              </div>

              {/* Development error details */}
              {process.env.NODE_ENV === "development" && (
                <div className="mt-6 text-left">
                  <p className="text-muted-foreground text-xs">
                    Check console for detailed error information
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      }
      onError={(error) => {
        // Log archive-specific error context
        logger.error("Archive Error:", {
          error: error.message,
          year,
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
