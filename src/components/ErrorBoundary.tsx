"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/lib/logger";
// Storage import removed - no localStorage to clear

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary for Chrondle
 * Catches JavaScript errors and provides production telemetry
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Log error for debugging
    logger.error("React Error Boundary caught an error:", error);
    logger.error("Error Info:", errorInfo);

    // Send to production telemetry
    this.reportError(error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // Only report in production to avoid noise during development
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    try {
      // Prepare error data for telemetry
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: this.getAnonymousUserId(),
      };

      // Send to console for basic telemetry
      // In a real production app, you would send this to a service like Sentry, LogRocket, etc.
      logger.error("PRODUCTION_ERROR:", JSON.stringify(errorData, null, 2));

      // Optional: Send to a telemetry service
      // Example: if (posthog.__loaded) posthog.capture("exception", { description: error.message, fatal: false });
    } catch (reportingError) {
      // Don't let error reporting crash the app
      logger.error("Failed to report error:", reportingError);
    }
  }

  private getAnonymousUserId(): string {
    // Create an anonymous user ID for error tracking
    // This helps correlate errors without storing personal data
    let userId = localStorage.getItem("chrondle-anonymous-id");
    if (!userId) {
      userId = "anon_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("chrondle-anonymous-id", userId);
    }
    return userId;
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorage = () => {
    if (confirm("Clear all game data and reload? This will reset your progress.")) {
      // No localStorage to clear - just reload
      logger.info("Reloading page (no localStorage to clear)");
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="bg-card mx-4 w-full max-w-md rounded border p-6 shadow-lg">
            <div className="text-center">
              <div className="mb-4 text-4xl">🚨</div>
              <h1 className="text-foreground mb-2 text-xl font-bold">Something went wrong</h1>
              <p className="text-muted-foreground mb-6">
                We&apos;re sorry! An unexpected error occurred. This has been logged for
                investigation.
              </p>

              <div className="space-y-3">
                <button
                  onClick={this.handleReload}
                  className="bg-primary text-body-primary-foreground hover:bg-primary/90 w-full rounded px-4 py-2 transition-colors"
                >
                  Reload Game
                </button>

                <button
                  onClick={this.handleClearStorage}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full rounded px-4 py-2 transition-colors"
                >
                  Clear Data & Reload
                </button>
              </div>

              {/* Show error details in development */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="text-muted-foreground cursor-pointer text-sm">
                    Error Details (Development)
                  </summary>
                  <pre className="bg-muted mt-2 max-h-32 overflow-auto rounded p-3 text-xs">
                    {this.state.error.message}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
