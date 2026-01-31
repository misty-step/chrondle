import { ArchiveLoadingSkeleton } from "../loading";

export default function Loading() {
  return (
    <div className="animate-pulse p-4">
      <ArchiveLoadingSkeleton />
    </div>
  );
}
