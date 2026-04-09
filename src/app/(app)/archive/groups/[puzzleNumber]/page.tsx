import { notFound } from "next/navigation";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ArchiveGroupsPuzzleClient } from "@/components/groups/ArchiveGroupsPuzzleClient";
import { GroupsUnavailableState } from "@/components/groups/GroupsUnavailableState";
import { logger } from "@/lib/logger";
import { fetchGroupsPuzzleByNumber, getConvexClient } from "@/lib/convexServer";

interface ArchiveGroupsPuzzlePageProps {
  params: Promise<{ puzzleNumber: string }>;
}

export default async function ArchiveGroupsPuzzlePage(props: ArchiveGroupsPuzzlePageProps) {
  const params = await props.params;
  const parsedNumber = Number(params.puzzleNumber);
  if (!Number.isFinite(parsedNumber)) {
    notFound();
  }

  const client = getConvexClient();
  if (!client) {
    logger.warn(
      "[ArchiveGroupsPuzzlePage] Convex client unavailable - missing NEXT_PUBLIC_CONVEX_URL",
    );
    notFound();
  }

  let convexPuzzle = null;
  try {
    convexPuzzle = await fetchGroupsPuzzleByNumber(client, parsedNumber);
  } catch (error) {
    logger.error("[ArchiveGroupsPuzzlePage] Failed to load Groups puzzle", {
      puzzleNumber: parsedNumber,
      error,
    });
    return (
      <ArchiveErrorBoundary>
        <div className="bg-background flex min-h-screen items-center px-4 py-8">
          <GroupsUnavailableState
            title="This Groups Puzzle Is Unavailable"
            description="The archive detail query is not available on this backend yet. Try the homepage or the classic archive while the Convex deploy catches up."
            primaryHref="/"
            primaryLabel="Back to Home"
            secondaryHref="/archive/groups"
            secondaryLabel="Groups Archive"
          />
        </div>
      </ArchiveErrorBoundary>
    );
  }

  if (!convexPuzzle) {
    logger.warn("[ArchiveGroupsPuzzlePage] Puzzle not found", { puzzleNumber: parsedNumber });
    notFound();
  }

  return (
    <ArchiveErrorBoundary>
      <ArchiveGroupsPuzzleClient puzzleNumber={parsedNumber} initialPuzzle={convexPuzzle} />
    </ArchiveErrorBoundary>
  );
}

export const metadata = {
  title: "Chrondle - Groups Archive",
};
