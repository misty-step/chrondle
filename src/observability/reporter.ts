import { logger } from "@/lib/logger";
import { sanitizeErrorForLogging } from "../../convex/lib/errorSanitization";

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SENSITIVE_KEY_PATTERN =
  /^(?:authorization|cookie|set-cookie|password|token|secret|api[_-]?key|(?:access|refresh|id|auth)[_-]?token|client[_-]?secret)$/i;

export interface ErrorReportContext {
  tags?: Record<string, string | number | boolean>;
  extras?: Record<string, unknown>;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
}

export function captureClientException(error: unknown, context?: ErrorReportContext): void {
  captureException(error, context);
}

export async function captureServerException(
  error: unknown,
  context?: ErrorReportContext,
): Promise<void> {
  captureException(error, context);
}

export function setUserContext(userId?: string, authState?: "signed_in" | "anon"): void {
  logger.debug("[Observability] User context updated", { hasUserId: Boolean(userId), authState });
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  logger.debug(
    "[Observability] Breadcrumb",
    sanitizeValue({ message, data }, new WeakSet<object>()),
  );
}

function captureException(error: unknown, context?: ErrorReportContext): void {
  const normalized = normalizeError(error);
  const severity = toSeverity(context?.level);
  const report = JSON.stringify({
    service: "chrondle",
    environment: process.env.NODE_ENV || "production",
    error_class: sanitizeString(normalized.errorClass),
    message: sanitizeString(normalized.message),
    severity,
    stack_trace: normalized.stackTrace ? sanitizeString(normalized.stackTrace) : undefined,
    context: sanitizeValue(
      {
        tags: context?.tags,
        extras: context?.extras,
      },
      new WeakSet<object>(),
    ),
  });

  if (severity === "warning") {
    logger.warn("[Observability] Exception", report);
  } else if (severity === "info") {
    logger.info("[Observability] Exception", report);
  } else {
    logger.error("[Observability] Exception", report);
  }
}

function normalizeError(error: unknown): {
  errorClass: string;
  message: string;
  stackTrace?: string;
} {
  if (error instanceof Error) {
    return {
      errorClass: error.name || error.constructor.name || "Error",
      message: error.message || "Unknown error",
      stackTrace: error.stack,
    };
  }

  if (typeof error === "string") {
    return { errorClass: "StringError", message: error };
  }

  return {
    errorClass: "UnknownError",
    message: String(error),
  };
}

function sanitizeString(value: string): string {
  return sanitizeErrorForLogging(value).replace(EMAIL_PATTERN, "[EMAIL_REDACTED]");
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toJSON();
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.map((entry) => sanitizeValue(entry, seen));
    seen.delete(value);
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[sanitizeString(key)] = SENSITIVE_KEY_PATTERN.test(key)
      ? "[REDACTED]"
      : sanitizeValue(entry, seen);
  }

  seen.delete(value);
  return result;
}

function toSeverity(level: ErrorReportContext["level"]): "error" | "warning" | "info" {
  if (level === "warning") return "warning";
  if (level === "info" || level === "debug") return "info";
  return "error";
}
