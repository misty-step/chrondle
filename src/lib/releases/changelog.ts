/** Read semantic-release's generated Markdown; never decide a version or author notes. */
export function parseChangelog(markdown: string) {
  const releases: { version: string; date: string; notes: string }[] = [];
  let current: (typeof releases)[number] | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^#{1,2} /.test(line)) {
      const heading =
        /^#{1,2} \[?(\d+\.\d+\.\d+)\]?(?:\(https:\/\/[^\s)]+\))? \((\d{4}-\d{2}-\d{2})\)$/.exec(
          line,
        );
      current = heading ? { version: heading[1], date: heading[2], notes: "" } : undefined;
      if (current) releases.push(current);
    } else if (current) {
      current.notes += `${line}\n`;
    }
  }

  if (!releases.length) throw new Error("CHANGELOG.md contains no generated releases");
  return releases.map((release) => ({ ...release, notes: release.notes.trim() }));
}
