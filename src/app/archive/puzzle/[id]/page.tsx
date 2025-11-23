import { notFound } from "next/navigation";
import { fetchClassicPuzzleByNumber, getConvexClient } from "@/lib/convexServer";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ClassicArchivePuzzleClient } from "@/components/classic/ClassicArchivePuzzleClient";
import { logger } from "@/lib/logger";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArchiveClassicPuzzlePage(props: PageProps) {
  const params = await props.params;
  const puzzleNumber = Number(params.id);
  if (!Number.isFinite(puzzleNumber) || puzzleNumber < 1) {
    notFound();
  }

  const client = getConvexClient();
  const puzzle = await fetchClassicPuzzleByNumber(client, puzzleNumber);
  if (!puzzle) {
    logger.warn("[ArchiveClassicPuzzlePage] Puzzle not found", { puzzleNumber });
    notFound();
  }

  return (
    <ArchiveErrorBoundary>
      <ClassicArchivePuzzleClient puzzleNumber={puzzleNumber} initialPuzzle={puzzle} />
    </ArchiveErrorBoundary>
  );
}
