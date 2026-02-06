import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { LayoutContainer } from "@/components/LayoutContainer";
import { loadRelease, getAllVersions, loadManifest } from "@/lib/releases/loader";
import { CHANGE_TYPE_LABELS, CHANGE_TYPE_ORDER } from "@/lib/releases/types";
import type { ChangeType } from "@/lib/releases/types";

interface PageProps {
  params: Promise<{ version: string }>;
}

export async function generateStaticParams() {
  const versions = getAllVersions();
  return versions.map((version) => ({ version }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { version } = await params;
  const release = loadRelease(version);
  if (!release) return { title: "Release Not Found | Chrondle" };

  return {
    title: `v${release.version} Release Notes | Chrondle`,
    description: release.productNotes.slice(0, 160),
  };
}

export default async function ReleasePage({ params }: PageProps) {
  const { version } = await params;
  const release = loadRelease(version);

  if (!release) {
    notFound();
  }

  const manifest = loadManifest();
  const versions = manifest?.versions || [];
  const currentIndex = versions.indexOf(release.version);
  const prevVersion = currentIndex < versions.length - 1 ? versions[currentIndex + 1] : null;
  const nextVersion = currentIndex > 0 ? versions[currentIndex - 1] : null;

  const changesByType = new Map<ChangeType, typeof release.changes>();
  for (const change of release.changes) {
    const existing = changesByType.get(change.type) || [];
    existing.push(change);
    changesByType.set(change.type, existing);
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 py-10 sm:py-12">
        <LayoutContainer className="max-w-3xl">
          <div className="mb-6">
            <Link
              href="/releases"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              ← All releases
            </Link>
          </div>

          <header className="mb-8">
            <h1 className="font-heading text-foreground text-3xl font-bold sm:text-4xl">
              v{release.version}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Released{" "}
              {new Date(release.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </header>

          <section className="mb-10">
            <h2 className="font-heading text-foreground text-xl font-semibold">What&apos;s New</h2>
            <div className="prose dark:prose-invert prose-sm mt-4 max-w-none">
              {release.productNotes
                .split("\n\n")
                .filter((paragraph) => paragraph.trim().length > 0)
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
            </div>
          </section>

          <section className="mb-10">
            <h2 className="font-heading text-foreground text-xl font-semibold">
              Technical Changelog
            </h2>

            <div className="mt-4 space-y-6">
              {CHANGE_TYPE_ORDER.map((type) => {
                const changes = changesByType.get(type);
                if (!changes?.length) return null;

                return (
                  <div key={type} className="border-border rounded-lg border p-4">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {CHANGE_TYPE_LABELS[type]}
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {changes.map((change, index) => (
                        <li key={index} className="text-foreground text-sm">
                          {change.breaking ? (
                            <span className="text-destructive mr-1 font-semibold">⚠</span>
                          ) : null}
                          {change.scope ? (
                            <span className="text-muted-foreground mr-2 text-xs uppercase">
                              [{change.scope}]
                            </span>
                          ) : null}
                          {change.description}
                          {change.pr ? (
                            <span className="text-muted-foreground ml-2 text-xs">
                              (#{change.pr})
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <nav className="border-border flex items-center justify-between border-t pt-6 text-sm">
            {prevVersion ? (
              <Link
                href={`/releases/${prevVersion}`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ← v{prevVersion}
              </Link>
            ) : (
              <span />
            )}

            {nextVersion ? (
              <Link
                href={`/releases/${nextVersion}`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                v{nextVersion} →
              </Link>
            ) : (
              <span className="text-muted-foreground text-xs">Latest release</span>
            )}
          </nav>
        </LayoutContainer>
      </main>

      <Footer />
    </div>
  );
}
