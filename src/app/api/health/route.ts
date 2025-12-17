import { NextResponse } from "next/server";
import { api } from "convex/_generated/api";
import { getConvexClient } from "@/lib/convexServer";

export const dynamic = "force-dynamic";

type HealthResult = { ok: true } | { ok: false; status: 500 | 503; error: string };

async function performHealthCheck(): Promise<HealthResult> {
  const convexClient = getConvexClient();

  if (!convexClient) {
    return { ok: false, status: 500, error: "Missing NEXT_PUBLIC_CONVEX_URL" };
  }

  try {
    const convexStatus = await convexClient.query(api.health.systemCheck);
    if (convexStatus !== "ok") {
      return { ok: false, status: 503, error: "Convex system check failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 503, error: "Convex connectivity failed" };
  }
}

export async function GET() {
  const result = await performHealthCheck();

  if (!result.ok) {
    return NextResponse.json({ status: "error", error: result.error }, { status: result.status });
  }

  return NextResponse.json({ status: "ok", convex: "ok" }, { status: 200 });
}

export async function HEAD() {
  const result = await performHealthCheck();
  return new NextResponse(null, { status: result.ok ? 200 : result.status });
}
