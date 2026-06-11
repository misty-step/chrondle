import { NextRequest, NextResponse } from "next/server";
import { createTimeoutSignal } from "@/lib/fetch-utils";

/**
 * PostHog proxy Route Handler
 *
 * Strips sensitive headers (cookie, authorization) before forwarding requests
 * to PostHog. This ensures Clerk auth tokens never leave the application boundary.
 *
 * Routes:
 * - /ingest/static/* -> https://us-assets.i.posthog.com/static/*
 * - /ingest/decide -> https://us.i.posthog.com/decide
 * - /ingest/* -> https://us.i.posthog.com/*
 */

export const dynamic = "force-dynamic";

// Request headers that should never be forwarded to PostHog
const REQUEST_HEADERS_TO_STRIP = ["cookie", "authorization"];

// Response headers that should never be exposed back to the browser
const RESPONSE_HEADERS_TO_STRIP = ["set-cookie", "content-encoding", "content-length"];

// PostHog hosts
const POSTHOG_MAIN_HOST = "https://us.i.posthog.com";
const POSTHOG_ASSETS_HOST = "https://us-assets.i.posthog.com";
const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * Determine which PostHog host to use based on the path
 */
function getPostHogHost(path: string): string {
  if (path.startsWith("/static/")) {
    return POSTHOG_ASSETS_HOST;
  }
  return POSTHOG_MAIN_HOST;
}

/**
 * Strip configured headers from a header set
 */
function stripHeaders(headers: Headers, headersToStrip: readonly string[]): Headers {
  const cleanHeaders = new Headers();
  for (const [key, value] of headers.entries()) {
    if (!headersToStrip.includes(key.toLowerCase())) {
      cleanHeaders.set(key, value);
    }
  }
  return cleanHeaders;
}

/**
 * Forward a request to PostHog and return the response
 */
async function proxyToPostHog(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname.replace(/^\/ingest/, "") || "/";
  const host = getPostHogHost(path);

  // Build the target URL with query params
  const targetUrl = new URL(path, host);
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  // Prepare headers (strip auth-sensitive request headers)
  const cleanHeaders = stripHeaders(request.headers, REQUEST_HEADERS_TO_STRIP);
  const [signal, cleanup] = createTimeoutSignal(UPSTREAM_TIMEOUT_MS);

  try {
    // Forward the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: cleanHeaders,
      body:
        request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
      redirect: "follow",
      signal,
    });

    // Build response with PostHog headers (strip any set-cookie from upstream)
    const responseHeaders = stripHeaders(response.headers, RESPONSE_HEADERS_TO_STRIP);

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return buildUpstreamFailureResponse(request.method, error);
  } finally {
    cleanup();
  }
}

function buildUpstreamFailureResponse(method: string, error: unknown): NextResponse {
  const status = isAbortError(error) ? 504 : 502;

  if (method === "HEAD") {
    return new NextResponse(null, { status });
  }

  return NextResponse.json(
    {
      error:
        status === 504 ? "PostHog upstream request timed out" : "PostHog upstream request failed",
    },
    { status },
  );
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError" || error.name === "TimeoutError";
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyToPostHog(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyToPostHog(request);
}

export async function HEAD(request: NextRequest): Promise<NextResponse> {
  return proxyToPostHog(request);
}
