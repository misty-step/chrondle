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
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentryServer } = await import("./observability/sentry.server");
    initSentryServer();
  }
}
