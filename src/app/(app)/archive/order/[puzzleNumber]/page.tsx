import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ArchiveOrderPuzzleClient } from "@/components/order/ArchiveOrderPuzzleClient";
import { logger } from "@/lib/logger";
import { api, fetchOrderPuzzleByNumber, getConvexClient } from "@/lib/convexServer";

interface ArchiveOrderPuzzlePageProps {
  params: Promise<{ puzzleNumber: string }>;
}

export default async function ArchiveOrderPuzzlePage(props: ArchiveOrderPuzzlePageProps) {
  const params = await props.params;
  const parsedNumber = Number(params.puzzleNumber);
  if (!Number.isFinite(parsedNumber)) {
    notFound();
  }

  // Server-side entitlement check
  const user = await currentUser();

  // If not logged in, redirect to sign-in then back to this puzzle
  if (!user) {
    redirect(`/sign-in?redirect_url=/archive/order/${parsedNumber}`);
  }

  const client = getConvexClient();

  // If Convex client unavailable (missing env var), let client-side handle it
  if (!client) {
    logger.warn(
      "[ArchiveOrderPuzzlePage] Convex client unavailable - missing NEXT_PUBLIC_CONVEX_URL",
    );
    notFound();
  }

  // Check archive access via Convex
  let hasAccess = false;
  try {
    hasAccess = await client.query(api.users.hasArchiveAccess, {
      clerkId: user.id,
    });
  } catch (error) {
    logger.warn("[ArchiveOrderPuzzle] hasArchiveAccess check failed:", error);
  }

  if (!hasAccess) {
    redirect("/pricing");
  }

  const convexPuzzle = await fetchOrderPuzzleByNumber(client, parsedNumber);

  if (!convexPuzzle) {
    logger.warn("[ArchiveOrderPuzzlePage] Puzzle not found", { puzzleNumber: parsedNumber });
    notFound();
  }

  return (
    <ArchiveErrorBoundary>
      <ArchiveOrderPuzzleClient puzzleNumber={parsedNumber} initialPuzzle={convexPuzzle} />
    </ArchiveErrorBoundary>
  );
}

export const metadata = {
  title: "Chrondle - Order Archive",
};
