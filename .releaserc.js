/**
 * semantic-release configuration
 *
 * Deep module: simple config, complex release automation hidden inside.
 * On push to master with conventional commits → version bump, changelog, GitHub release.
 */
export default {
  branches: ["master"],
  plugins: [
    // Analyze commits to determine version bump (major/minor/patch)
    "@semantic-release/commit-analyzer",

    // Generate release notes from commits
    "@semantic-release/release-notes-generator",

    // Update CHANGELOG.md
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle:
          "# Changelog\n\nAll notable changes to Chrondle will be documented in this file.",
      },
    ],

    // Commit updated files back to repo
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],

    // Create GitHub release
    "@semantic-release/github",
  ],
};
