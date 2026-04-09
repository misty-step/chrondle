import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convexServer";
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

  const client = getConvexClient();
  if (!client) {
    notFound();
  }

  return (
    <ArchiveErrorBoundary>
      <ClassicArchivePuzzleClient puzzleNumber={puzzleNumber} />
    </ArchiveErrorBoundary>
  );
}
