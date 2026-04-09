import { notFound } from "next/navigation";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ArchiveGroupsPuzzleClient } from "@/components/groups/ArchiveGroupsPuzzleClient";
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

  const convexPuzzle = await fetchGroupsPuzzleByNumber(client, parsedNumber);
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
