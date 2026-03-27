import { logger } from "@/lib/logger";

const DEFAULT_ENDPOINT = "https://canary-obs.fly.dev";
const REQUEST_TIMEOUT_MS = 2_000;
const SERVICE = "chrondle";
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

type CanaryLevel = "fatal" | "error" | "warning" | "info" | "debug";

export interface CanaryContext {
  tags?: Record<string, string | number | boolean>;
  extras?: Record<string, unknown>;
  level?: CanaryLevel;
}

export function isCanaryEnabled(): boolean {
  return getApiKey().length > 0;
}

export async function captureCanaryException(
  error: unknown,
  context?: CanaryContext,
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const normalized = normalizeError(error);

  try {
    const res = await fetch(`${getEndpoint().replace(/\/$/, "")}/api/v1/errors`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service: SERVICE,
        environment:
          process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
          process.env.SENTRY_ENVIRONMENT ||
          process.env.NODE_ENV ||
          "production",
        error_class: normalized.errorClass,
        message: sanitizeString(normalized.message),
        severity: toSeverity(context?.level),
        stack_trace: normalized.stackTrace ? sanitizeString(normalized.stackTrace) : undefined,
        context: sanitizeValue(
          {
            tags: context?.tags,
            extras: context?.extras,
          },
          new WeakSet<object>(),
        ),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok && process.env.NODE_ENV === "development") {
      logger.warn("[Canary] Failed to capture exception", { status: res.status });
    }
  } catch (captureError) {
    if (process.env.NODE_ENV === "development") {
      logger.warn("[Canary] Failed to capture exception", { captureError });
    }
  }
}

function getEndpoint(): string {
  return process.env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
}

function getApiKey(): string {
  return process.env.NEXT_PUBLIC_CANARY_API_KEY?.trim() || "";
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
  return value.replace(EMAIL_PATTERN, "[EMAIL_REDACTED]");
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = sanitizeValue(entry, seen);
  }

  return result;
}

function toSeverity(level: CanaryLevel | undefined): "error" | "warning" | "info" {
  if (level === "warning") return "warning";
  if (level === "info" || level === "debug") return "info";
  return "error";
}
