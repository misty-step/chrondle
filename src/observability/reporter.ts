import { logger } from "@/lib/logger";
import { captureCanaryException, type CanaryContext } from "./canary";

export type ErrorReportContext = CanaryContext;

export function captureClientException(error: unknown, context?: ErrorReportContext): void {
  void captureCanaryException(error, context);
}

export async function captureServerException(
  error: unknown,
  context?: ErrorReportContext,
): Promise<void> {
  await captureCanaryException(error, context);
}

export function setUserContext(userId?: string, authState?: "signed_in" | "anon"): void {
  logger.debug("[Canary] User context updated", { hasUserId: Boolean(userId), authState });
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  logger.debug("[Canary] Breadcrumb", { message, data });
}
