import { NextResponse } from "next/server";
import { api } from "convex/_generated/api";
import { getConvexClient } from "@/lib/convexServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const convexClient = getConvexClient();

  if (!convexClient) {
    return NextResponse.json(
      { status: "error", error: "Missing NEXT_PUBLIC_CONVEX_URL" },
      { status: 500 }
    );
  }

  try {
    const convexStatus = await convexClient.query(api.health.systemCheck);
    if (convexStatus !== "ok") {
        throw new Error("Convex system check failed");
    }

    return NextResponse.json({ status: "ok", convex: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", error: "Convex connectivity failed" },
      { status: 503 }
    );
  }
}

export async function HEAD() {
  const convexClient = getConvexClient();

  if (!convexClient) {
    return new NextResponse(null, { status: 500 });
  }

  try {
    const convexStatus = await convexClient.query(api.health.systemCheck);
    if (convexStatus !== "ok") {
        return new NextResponse(null, { status: 503 });
    }
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
