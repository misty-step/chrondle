import Link from "next/link";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { LayoutContainer } from "@/components/LayoutContainer";
import { InlineMarkdown } from "@/components/ui/InlineMarkdown";
import { loadAllReleases } from "@/lib/releases/loader";
import { CHANGE_TYPE_LABELS, CHANGE_TYPE_ORDER } from "@/lib/releases/types";
import type { ChangeType } from "@/lib/releases/types";

export const metadata: Metadata = {
  title: "Releases | Chrondle",
  description: "See what's new in Chrondle - the daily history game.",
};

function getChangeCounts(changes: { type: ChangeType }[]) {
  const counts = new Map<ChangeType, number>();
  for (const change of changes) {
    counts.set(change.type, (counts.get(change.type) ?? 0) + 1);
  }
  return counts;
}

export default function ReleasesPage() {
  const releases = loadAllReleases();

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 py-10 sm:py-12">
        <LayoutContainer className="max-w-3xl">
          <header className="mb-8">
            <h1 className="font-heading text-foreground text-3xl font-bold sm:text-4xl">
              Releases
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              See what&apos;s new in Chrondle. We ship improvements regularly.
            </p>
          </header>

          {releases.length === 0 ? (
            <p className="text-muted-foreground">No releases yet. Check back soon!</p>
          ) : (
            <div className="space-y-6">
              {releases.map((release) => {
                const counts = getChangeCounts(release.changes);
                const preview = release.productNotes.split("\n\n")[0] ?? "";

                return (
                  <Link
                    key={release.version}
                    href={`/releases/${release.version}`}
                    className="border-border hover:border-foreground/20 block rounded-lg border px-5 py-4 transition-colors"
                  >
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                      <h2 className="font-heading text-xl font-semibold">v{release.version}</h2>
                      <time className="text-muted-foreground text-sm">
                        {new Date(release.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </div>

                    {preview ? (
                      <div className="prose dark:prose-invert prose-sm max-w-none">
                        <InlineMarkdown>{preview}</InlineMarkdown>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {CHANGE_TYPE_ORDER.map((type) => {
                        const count = counts.get(type);
                        if (!count) return null;

                        return (
                          <span
                            key={type}
                            className="border-border text-muted-foreground rounded-full border px-3 py-1 text-xs"
                          >
                            {count} {CHANGE_TYPE_LABELS[type]}
                          </span>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </LayoutContainer>
      </main>

      <Footer />
    </div>
  );
}
