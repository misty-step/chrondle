import { NextResponse } from "next/server";
import { api, getConvexClient } from "@/lib/convexServer";

export const dynamic = "force-dynamic";

type HealthChecks = {
  canary: "configured" | "missing";
  convex: "ok" | "missing" | "unhealthy";
};

type HealthResult =
  | { ok: true; checks: HealthChecks }
  | { ok: false; status: 500 | 503; error: string; checks: HealthChecks };

function hasCanaryWriteKey(): boolean {
  return Boolean(
    process.env.CANARY_API_KEY?.trim() || process.env.NEXT_PUBLIC_CANARY_API_KEY?.trim(),
  );
}

async function performHealthCheck(): Promise<HealthResult> {
  const convexClient = getConvexClient();
  const baseChecks: HealthChecks = {
    canary: hasCanaryWriteKey() ? "configured" : "missing",
    convex: "ok",
  };

  if (baseChecks.canary === "missing") {
    return {
      ok: false,
      status: 500,
      error: "Missing Canary write key",
      checks: { ...baseChecks, convex: convexClient ? "ok" : "missing" },
    };
  }

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

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.error, checks: result.checks },
      { status: result.status },
    );
  }

  return NextResponse.json(
    { status: "ok", service: "chrondle", checks: result.checks },
    { status: 200 },
  );
}

export async function HEAD() {
  const result = await performHealthCheck();
  return new NextResponse(null, { status: result.ok ? 200 : result.status });
}
