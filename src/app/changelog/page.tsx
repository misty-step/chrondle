import type { Metadata } from "next";
import Markdown from "react-markdown";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { LayoutContainer } from "@/components/LayoutContainer";

export const metadata: Metadata = {
  title: "Changelog | Chrondle",
  description: "See what's new in Chrondle - the daily history game.",
};

// Revalidate every hour (releases don't happen that often)
export const revalidate = 3600;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Release {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface GroupedReleases {
  minor: string;
  releases: Release[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Fetching (information hiding: GitHub API complexity contained here)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchReleases(): Promise<Release[]> {
  const repo = process.env.GITHUB_REPOSITORY || "misty-step/chrondle";
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    // Fail gracefully - return empty array, page will show "No releases yet"
    return [];
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping Logic (information hiding: version parsing contained here)
// ─────────────────────────────────────────────────────────────────────────────

function groupByMinorVersion(releases: Release[]): GroupedReleases[] {
  const groups = new Map<string, Release[]>();

  for (const release of releases) {
    // Extract minor version: v1.2.3 -> 1.2
    const match = release.tag_name.match(/^v?(\d+)\.(\d+)/);
    if (!match) continue;

    const minor = `${match[1]}.${match[2]}`;
    const existing = groups.get(minor) || [];
    groups.set(minor, [...existing, release]);
  }

  // Sort by minor version descending
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const [aMajor, aMinor] = a.split(".").map(Number);
      const [bMajor, bMinor] = b.split(".").map(Number);
      if (bMajor !== aMajor) return bMajor - aMajor;
      return bMinor - aMinor;
    })
    .map(([minor, releases]) => ({ minor, releases }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function ReleaseCard({ release }: { release: Release }) {
  const date = new Date(release.published_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Extract user-friendly notes (before <details>) or use full body
  const userNotes = release.body?.split("<details>")?.[0]?.trim() || release.body;

  return (
    <article className="border-border border-b py-6 last:border-b-0">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-semibold">
          <a
            href={release.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            {release.name || release.tag_name}
          </a>
        </h3>
        <time className="text-muted-foreground text-sm whitespace-nowrap">{date}</time>
      </header>
      {userNotes && (
        <div className="prose-sm dark:prose-invert prose-headings:text-base prose-headings:font-medium">
          <Markdown
            components={{
              a: ({ children, href }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {userNotes}
          </Markdown>
        </div>
      )}
    </article>
  );
}

function VersionGroup({ group }: { group: GroupedReleases }) {
  return (
    <section className="mb-12">
      <h2 className="border-border text-muted-foreground mb-4 border-b pb-2 text-sm font-medium tracking-wider uppercase">
        Version {group.minor}
      </h2>
      <div>
        {group.releases.map((release) => (
          <ReleaseCard key={release.tag_name} release={release} />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function ChangelogPage() {
  const releases = await fetchReleases();
  const grouped = groupByMinorVersion(releases);

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader currentStreak={0} />
      <main className="flex-1 py-12">
        <LayoutContainer className="max-w-2xl">
          <header className="mb-8">
            <h1 className="text-3xl font-bold">Changelog</h1>
            <p className="text-muted-foreground mt-2">
              See what&apos;s new in Chrondle. We ship improvements regularly.
            </p>
          </header>

          {grouped.length === 0 ? (
            <p className="text-muted-foreground">No releases yet. Check back soon!</p>
          ) : (
            grouped.map((group) => <VersionGroup key={group.minor} group={group} />)
          )}
        </LayoutContainer>
      </main>
      <Footer />
    </div>
  );
}
