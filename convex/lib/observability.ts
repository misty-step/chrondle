import { sanitizeErrorForLogging } from "./errorSanitization";

type FailureReason = "validation" | "auth" | "not_found" | "server" | "unknown";

/**
 * Emulated Sentry capture for Convex environment.
 * Logs structured error data that can be ingested by logging platforms or Sentry integrations.
 */
function captureServerException(
  error: unknown,
  context?: { tags?: Record<string, string>; extras?: Record<string, unknown> },
) {
  console.error(
    "[Sentry Capture]",
    JSON.stringify({
      error: sanitizeErrorForLogging(error),
      tags: context?.tags,
      extras: context?.extras,
      environment: process.env.CONVEX_ENV || "development", // Convex standard env
    }),
  );
}

/**
 * Wraps a Convex mutation or action handler with observability:
 * - Error capturing (Sentry-compatible logs)
 * - Failure classification
 * - Metrics logging
 */
export function withObservability<Ctx, Args, Return>(
  fn: (ctx: Ctx, args: Args) => Promise<Return>,
  config: {
    name: string;
    tags?: Record<string, string>;
    ignoreErrors?: string[]; // Error messages to ignore
  },
) {
  return async (ctx: Ctx, args: Args): Promise<Return> => {
    try {
      return await fn(ctx, args);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error) || "Unknown error";

      // Skip ignored errors
      if (config.ignoreErrors?.some((ignore) => message.includes(ignore))) {
        throw error;
      }

      const reason = classifyError(error);

      // 1. Capture Exception
      captureServerException(error, {
        tags: {
          convexFn: config.name,
          reason,
          ...config.tags,
        },
        extras: {
          args: sanitizeArgs(args),
          message,
        },
      });

      // 2. Emit Metric (Log-based)
      console.info(`[Metric] order.submit.failure`, {
        reason,
        function: config.name,
      });

      throw error;
    }
  };
}

function classifyError(error: unknown): FailureReason {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes("authentication") || msg.includes("forbidden") || msg.includes("unauthorized"))
    return "auth";
  if (msg.includes("not found")) return "not_found";
  if (msg.includes("validation") || msg.includes("invalid") || msg.includes("score verification"))
    return "validation";
  return "unknown"; // Defaults to unknown (potential server error)
}

function sanitizeArgs(args: unknown): unknown {
  if (!args || typeof args !== "object") return args;
  // Shallow sanitization for common sensitive fields
  const sanitized = { ...(args as Record<string, unknown>) };
  if (sanitized.token) sanitized.token = "[REDACTED]";
  if (sanitized.password) sanitized.password = "[REDACTED]";
  return sanitized;
}
