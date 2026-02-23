/**
 * Shared types for observability modules
 */

export interface SentryContext {
  tags?: Record<string, string | number | boolean>;
  extras?: Record<string, unknown>;
  level?: "error" | "warning" | "info" | "debug";
}
