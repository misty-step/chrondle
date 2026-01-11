import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { api, getConvexClient } from "@/lib/convexServer";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ClassicArchivePuzzleClient } from "@/components/classic/ClassicArchivePuzzleClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArchiveClassicPuzzlePage(props: PageProps) {
  const params = await props.params;
  const puzzleNumber = Number(params.id);

  // Only validate that the ID is a valid number format
  // Puzzle existence is validated client-side
  if (!Number.isInteger(puzzleNumber) || puzzleNumber < 1) {
    notFound();
  }

  // Server-side entitlement check
  const user = await currentUser();

  // If not logged in, redirect to sign-in then pricing
  if (!user) {
    redirect(`/sign-in?redirect_url=/pricing`);
  }

  // Check archive access via Convex
  const client = getConvexClient();
  if (client) {
    const hasAccess = await client.query(api.users.hasArchiveAccess, {
      clerkId: user.id,
    });

    if (!hasAccess) {
      redirect("/pricing");
    }
  }

  return (
    <ArchiveErrorBoundary>
      <ClassicArchivePuzzleClient puzzleNumber={puzzleNumber} />
    </ArchiveErrorBoundary>
  );
}
