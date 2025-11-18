import { sanitizeErrorForLogging } from "./errorSanitization";

export function logStageSuccess(stage: string, message: string, ...args: unknown[]): void {
  console.log(`[${stage}] ${message}`, ...args);
}

export function logStageError(
  stage: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const base = `[${stage}] ${sanitizeErrorForLogging(error)}`;
  if (context) {
    console.error(base, JSON.stringify(context));
  } else {
    console.error(base);
  }
}

export function logStageWarn(
  stage: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (context) {
    console.warn(`[${stage}] ${message}`, JSON.stringify(context));
  } else {
    console.warn(`[${stage}] ${message}`);
  }
}
