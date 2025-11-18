"use node";

/**
 * Shared helpers for redacting sensitive values from errors before logging.
 *
 * Convex automatically logs thrown errors, so we have to sanitize them before
 * rethrowing to avoid leaking API keys and authorization headers.
 */

export interface ErrorWithStatus extends Error {
  status?: number;
}

const API_KEY_PATTERN = /sk-or-v1-[a-zA-Z0-9]{32,}/g;
const BEARER_PATTERN = /Bearer\s+sk-or-v1-[a-zA-Z0-9]{32,}/gi;

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

  return errorText
    .replace(API_KEY_PATTERN, "sk-or-v1-***REDACTED***")
    .replace(BEARER_PATTERN, "Bearer sk-or-v1-***REDACTED***");
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
