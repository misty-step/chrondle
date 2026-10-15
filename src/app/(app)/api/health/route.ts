import { NextResponse } from "next/server";
import { api, getConvexClient } from "@/lib/convexServer";

export const dynamic = "force-dynamic";

type HealthChecks = {
  convex: "ok" | "missing" | "unhealthy";
};

type HealthResult =
  | { ok: true; checks: HealthChecks }
  | { ok: false; status: 500 | 503; error: string; checks: HealthChecks };

async function performHealthCheck(): Promise<HealthResult> {
  const convexClient = getConvexClient();
  const baseChecks: HealthChecks = {
    convex: "ok",
  };

  if (!convexClient) {
    return {
      ok: false,
      status: 500,
      error: "Missing NEXT_PUBLIC_CONVEX_URL",
      checks: { ...baseChecks, convex: "missing" },
    };
  }

  try {
    const convexStatus = await convexClient.query(api.health.systemCheck);
    if (convexStatus !== "ok") {
      return {
        ok: false,
        status: 503,
        error: "Convex system check failed",
        checks: { ...baseChecks, convex: "unhealthy" },
      };
    }
    return { ok: true, checks: baseChecks };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Convex connectivity failed",
      checks: { ...baseChecks, convex: "unhealthy" },
    };
  }
}

export async function GET() {
  const result = await performHealthCheck();
  const identity = {
    service: "chrondle",
    revision: process.env.CHRONDLE_REVISION || "development",
    version: process.env.NEXT_PUBLIC_APP_VERSION || "development",
  };

  if (!result.ok) {
    return NextResponse.json(
      { ...identity, status: "error", error: result.error, checks: result.checks },
      { status: result.status },
    );
  }

  return NextResponse.json(
    {
      ...identity,
      status: "ok",
      checks: result.checks,
    },
    { status: 200 },
  );
}

export async function HEAD() {
  const result = await performHealthCheck();
  return new NextResponse(null, { status: result.ok ? 200 : result.status });
}
