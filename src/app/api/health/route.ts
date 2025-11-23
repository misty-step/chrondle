import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { getEnvVar } from "@/lib/env";
import packageInfo from "../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleHealthCheck();
}

export async function HEAD() {
  const response = await handleHealthCheck();
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

async function handleHealthCheck() {
  const convexUrl = getEnvVar("NEXT_PUBLIC_CONVEX_URL");

  if (!convexUrl) {
    return NextResponse.json(
      {
        status: "error",
        error: "Configuration error: NEXT_PUBLIC_CONVEX_URL missing",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }

  const client = new ConvexHttpClient(convexUrl);
  const timeoutMs = 5000;
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    const checkPromise = client.query(api.health.systemCheck);

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error("Timeout waiting for database response"));
        }, timeoutMs);
    });

    const result = await Promise.race([checkPromise, timeoutPromise]);

    if (!result || !result.ok) {
        throw new Error("Convex system check failed");
    }

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        dependencies: {
          database: "up",
        },
        version: packageInfo.version
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
     return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
           "Cache-Control": "no-cache, no-store, must-revalidate",
        }
      }
    );
  } finally {
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
  }
}
