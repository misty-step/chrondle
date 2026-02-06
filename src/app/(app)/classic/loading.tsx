import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse p-4">
      <div className="bg-background flex min-h-screen flex-col">
        <header className="border-outline-default/30 border-b">
          <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
            <Skeleton className="h-7 w-40 sm:h-8 sm:w-48" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-grow px-4 py-6 sm:px-6 sm:py-8">
          <Skeleton className="mb-6 h-10 w-48" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </main>
      </div>
    </div>
  );
}
