/**
 * Next.js Instrumentation
 *
 * Bootstraps server-side observability for Next.js 15.
 * This file is automatically loaded by Next.js when present in src/.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only initialize on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs" && isSentryConfigured()) {
    const { initSentryServer } = await import("./observability/sentry.server");
    initSentryServer();
  }
}

export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routePath?: string;
    routeType?: string;
  },
): Promise<void> {
  const contextPayload = {
    level: "error" as const,
    tags: {
      source: "nextjs.onRequestError",
      route_type: context.routeType ?? "unknown",
    },
    extras: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
    },
  };

  if (!isSentryConfigured()) {
    const { captureCanaryException } = await import("./observability/canary");
    await captureCanaryException(error, contextPayload);
    return;
  }

  const { captureServerException } = await import("./observability/sentry.server");

  await captureServerException(error, contextPayload);
}

function isSentryConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
}
