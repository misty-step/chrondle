import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { LayoutContainer } from "@/components/LayoutContainer";
import { ReleaseNotes } from "@/components/ReleaseNotes";
import { loadRelease, getAllVersions } from "@/lib/releases/loader";

type PageProps = { params: Promise<{ version: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllVersions().map((version) => ({ version }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { version } = await params;
  const release = loadRelease(version);
  return { title: release ? `v${release.version} | Chrondle changelog` : "Release not found" };
}

export default async function ReleasePage({ params }: PageProps) {
  const { version } = await params;
  const release = loadRelease(version);
  if (!release) notFound();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1 py-10 sm:py-12">
        <LayoutContainer className="max-w-3xl">
          <Link
            href="/changelog"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            ← Changelog
          </Link>
          <header className="mt-6 mb-8">
            <h1 className="font-heading text-3xl font-bold sm:text-4xl">v{release.version}</h1>
            <time dateTime={release.date} className="text-muted-foreground mt-2 block">
              {release.date}
            </time>
          </header>
          <ReleaseNotes notes={release.notes} />
          <a
            href={`https://github.com/misty-step/chrondle/releases/tag/v${release.version}`}
            className="mt-8 inline-flex min-h-11 items-center underline underline-offset-4"
          >
            View on GitHub
          </a>
        </LayoutContainer>
      </main>
      <Footer />
    </div>
  );
}
