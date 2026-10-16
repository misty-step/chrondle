import { logger } from "@/lib/logger";
import { sanitizeErrorForLogging } from "../../convex/lib/errorSanitization";
import type { BrowserClient } from "@sentry/browser";

let browserClient: BrowserClient | undefined;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SENSITIVE_KEY_PATTERN =
  /(?:authorization|cookie|password|token|secret|api[_-]?key|private[_-]?key|(?:user|player|clerk|account)[_-]?id)/i;

export interface ErrorReportContext {
  tags?: Record<string, string | number | boolean>;
  extras?: Record<string, unknown>;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
}

export function captureClientException(error: unknown, context?: ErrorReportContext): void {
  const report = captureException(error, context);
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  // Lazy, browser-only native transport: no duplicate global observers or server sink.
  void import("@sentry/browser")
    .then(({ BrowserClient, makeFetchTransport, defaultStackParser }) => {
      browserClient ??= new BrowserClient({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        release: process.env.CHRONDLE_REVISION,
        environment: process.env.NODE_ENV,
        transport: makeFetchTransport,
        transportOptions: { bufferSize: 10, fetchOptions: { credentials: "omit" } },
        stackParser: defaultStackParser,
        integrations: [],
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
        beforeSendLog: () => null,
        beforeSendMetric: () => null,
        sendClientReports: false,
        // Scope enrichment must not introduce identity, requests or breadcrumbs.
        beforeSend: (event) =>
          sanitizeValue(
            {
              event_id: event.event_id,
              timestamp: event.timestamp,
              platform: "javascript",
              release: process.env.CHRONDLE_REVISION,
              environment: process.env.NODE_ENV,
              level: event.level,
              exception: event.exception,
              tags: event.tags,
              extra: event.extra,
            },
            new WeakSet<object>(),
          ) as typeof event,
      });
      const source = context?.tags?.source;
      browserClient.captureEvent({
        level: report.severity,
        exception: {
          values: [
            {
              type: report.error_class,
              value: report.message,
              stacktrace: report.stack_trace
                ? { frames: defaultStackParser(report.stack_trace) }
                : undefined,
              mechanism: {
                type: typeof source === "string" ? source : "generic",
                handled: source !== "window.error" && source !== "window.unhandledrejection",
              },
            },
          ],
        },
        tags: report.context.tags as ErrorReportContext["tags"],
        extra: report.context.extras as ErrorReportContext["extras"],
      });
    })
    .catch(() => {
      // Loading/transport failure must never recurse into reporting or block play.
    });
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

function captureException(error: unknown, context?: ErrorReportContext) {
  const normalized = normalizeError(error);
  const severity = toSeverity(context?.level);
  const report = {
    service: "chrondle",
    environment: process.env.NODE_ENV || "production",
    error_class: sanitizeString(normalized.errorClass),
    message: sanitizeString(normalized.message),
    severity,
    stack_trace: normalized.stackTrace ? sanitizeString(normalized.stackTrace) : undefined,
    context: {
      tags: sanitizeValue(context?.tags, new WeakSet<object>()),
      extras: sanitizeValue(context?.extras, new WeakSet<object>()),
    },
  };
  const encoded = JSON.stringify(report);

  if (severity === "warning") {
    logger.warn("[Observability] Exception", encoded);
  } else if (severity === "info") {
    logger.info("[Observability] Exception", encoded);
  } else {
    logger.error("[Observability] Exception", encoded);
  }
  return report;
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
  const withoutPrivateUrls = value.replace(/https?:\/\/[^\s)]+/g, (raw) => {
    try {
      const url = new URL(raw);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "[URL_REDACTED]";
    }
  });
  return sanitizeErrorForLogging(withoutPrivateUrls).replace(EMAIL_PATTERN, "[EMAIL_REDACTED]");
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
