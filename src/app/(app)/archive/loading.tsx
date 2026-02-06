import { Skeleton } from "@/components/ui/Skeleton";

export function ArchiveLoadingSkeleton() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-outline-default/30 border-b">
        <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
          <Skeleton className="h-7 w-40 sm:h-8 sm:w-48" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-grow px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-9 w-56 sm:h-10 sm:w-64" />
          <Skeleton className="h-5 w-72" />
        </div>

        <div className="mb-6 flex gap-2 border-b pb-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>

        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="border-outline-default/30 bg-card flex h-36 flex-col gap-2 rounded border p-3 sm:h-[10rem] sm:p-4"
            >
              <Skeleton className="h-5 w-12" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="mt-auto h-3 w-20" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse p-4">
      <ArchiveLoadingSkeleton />
    </div>
  );
}
