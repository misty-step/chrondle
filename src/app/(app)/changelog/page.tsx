import Link from "next/link";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { LayoutContainer } from "@/components/LayoutContainer";
import { ReleaseNotes } from "@/components/ReleaseNotes";
import { loadAllReleases } from "@/lib/releases/loader";

export const metadata: Metadata = {
  title: "Changelog | Chrondle",
  description: "New features and fixes included in this Chrondle build.",
};

export default function ChangelogPage() {
  const [latest, ...older] = loadAllReleases();
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1 py-10 sm:py-12">
        <LayoutContainer className="max-w-3xl">
          <header className="mb-10">
            <h1 className="font-heading text-3xl font-bold sm:text-4xl">Changelog</h1>
            <p className="text-muted-foreground mt-2">Features and fixes included in this build.</p>
          </header>
          <article aria-label={`Release ${latest.version}`}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <Link
                href={`/releases/${latest.version}`}
                className="font-heading inline-flex min-h-11 items-center text-2xl font-semibold underline underline-offset-4"
              >
                v{latest.version}
              </Link>
              <time dateTime={latest.date} className="text-muted-foreground">
                {latest.date}
              </time>
            </div>
            <ReleaseNotes notes={latest.notes} />
          </article>
          <section aria-labelledby="earlier-releases" className="mt-12">
            <h2 id="earlier-releases" className="font-heading mb-4 text-xl font-semibold">
              Earlier releases
            </h2>
            <ul className="space-y-2">
              {older.map((release) => (
                <li key={release.version}>
                  <Link
                    href={`/releases/${release.version}`}
                    className="hover:text-foreground text-muted-foreground flex min-h-11 items-center justify-between gap-4 rounded-sm underline underline-offset-4 focus-visible:outline-2"
                  >
                    <span>v{release.version}</span>
                    <time dateTime={release.date}>{release.date}</time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </LayoutContainer>
      </main>
      <Footer />
    </div>
  );
}
