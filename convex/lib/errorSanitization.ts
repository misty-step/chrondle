/**
 * Shared helpers for redacting sensitive values from errors before logging.
 *
 * Convex automatically logs thrown errors, so we have to sanitize them before
 * rethrowing to avoid leaking API keys and authorization headers.
 */

export interface ErrorWithStatus extends Error {
  status?: number;
}

const OPENROUTER_API_KEY_PATTERN = /sk-or-v1-[a-zA-Z0-9]{32,}/g;
const OPENROUTER_BEARER_PATTERN = /Bearer\s+sk-or-v1-[a-zA-Z0-9]{32,}/gi;
const GENERIC_SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer ***REDACTED***"],
  [/sk_(live|test)_[A-Za-z0-9_-]{16,}/g, "sk_$1_***REDACTED***"],
  [/pk_(live|test)_[A-Za-z0-9_-]{16,}/g, "pk_$1_***REDACTED***"],
  [/whsec_[A-Za-z0-9_-]{16,}/g, "whsec_***REDACTED***"],
];

/**
 * Removes recognizable API key patterns from any error-like input.
 */
export function sanitizeErrorForLogging(error: unknown): string {
  let errorText = "";

  if (error instanceof Error) {
    errorText = `${error.message}\n${error.stack || ""}`;
  } else if (typeof error === "string") {
    errorText = error;
  } else {
    try {
      errorText = JSON.stringify(error);
    } catch {
      errorText = String(error);
    }
  }

  let sanitized = errorText
    .replace(OPENROUTER_BEARER_PATTERN, "Bearer sk-or-v1-***REDACTED***")
    .replace(OPENROUTER_API_KEY_PATTERN, "sk-or-v1-***REDACTED***");

  for (const [pattern, replacement] of GENERIC_SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

/**
 * Creates a new Error instance that is safe to throw/log downstream.
 */
export function createSanitizedError(error: unknown): ErrorWithStatus {
  const sanitizedMessage = sanitizeErrorForLogging(error);
  const sanitizedError = new Error(sanitizedMessage) as ErrorWithStatus;

  if (error && typeof error === "object" && "status" in error) {
    sanitizedError.status = (error as ErrorWithStatus).status;
  }

  return sanitizedError;
}
