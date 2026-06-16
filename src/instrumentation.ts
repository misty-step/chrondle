/**
 * Next.js Instrumentation
 *
 * Bootstraps server-side observability for Next.js 15.
 * This file is automatically loaded by Next.js when present in src/.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Canary uses direct request-time capture and does not require SDK bootstrapping.
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

  const { captureServerException } = await import("./observability/reporter");

  await captureServerException(error, contextPayload);
}
