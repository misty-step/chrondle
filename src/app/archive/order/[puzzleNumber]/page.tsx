import { notFound } from "next/navigation";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ArchiveOrderPuzzleClient } from "@/components/order/ArchiveOrderPuzzleClient";
import { logger } from "@/lib/logger";
import { fetchOrderPuzzleByNumber, getConvexClient } from "@/lib/convexServer";

interface ArchiveOrderPuzzlePageProps {
  params: Promise<{ puzzleNumber: string }>;
}

export default async function ArchiveOrderPuzzlePage(props: ArchiveOrderPuzzlePageProps) {
  const params = await props.params;
  const parsedNumber = Number(params.puzzleNumber);
  if (!Number.isFinite(parsedNumber)) {
    notFound();
  }

  const client = getConvexClient();
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
