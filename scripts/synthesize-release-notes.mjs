#!/usr/bin/env node
/**
 * Synthesize Release Notes
 *
 * Deep module: transforms technical changelogs into user-friendly release notes.
 * Hides GitHub API, LLM API, and prompt engineering complexity behind a simple CLI.
 *
 * Usage: node scripts/synthesize-release-notes.mjs <version>
 *
 * Environment:
 *   GITHUB_TOKEN - Required for GitHub API access
 *   GEMINI_API_KEY - Required for LLM synthesis (skips gracefully if missing)
 */

const VERSION = process.argv[2];
const REPO = process.env.GITHUB_REPOSITORY || 'misty-step/chrondle';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

if (!VERSION) {
  console.error('Usage: node scripts/synthesize-release-notes.mjs <version>');
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable required');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.log('GEMINI_API_KEY not set - skipping LLM synthesis');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub API (information hiding: all GitHub complexity contained here)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRelease(tag) {
  const url = `https://api.github.com/repos/${REPO}/releases/tags/v${tag}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch release v${tag}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function updateRelease(releaseId, body) {
  const url = `https://api.github.com/repos/${REPO}/releases/${releaseId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update release: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM Synthesis (information hiding: prompt engineering contained here)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a release notes writer for Chrondle, a daily historical year-guessing game.

Transform technical changelogs into friendly, concise release notes that users will enjoy reading.

Guidelines:
- Lead with what users care about (new features, fixes to annoying bugs)
- Use plain language, avoid technical jargon
- Be concise - 2-4 bullet points max
- Add a brief one-liner summary at the top
- Group related changes
- Skip internal refactoring unless it improves performance
- Use emojis sparingly for visual interest

Example output format:
## What's New in v1.2.0

A smoother puzzle experience with faster animations!

- 🎯 **Smarter hints** - Hints now avoid repetitive themes
- ⚡ **Faster animations** - Reduced lag on older devices
- 🐛 **Fixed** score not updating after correct guess`;

async function synthesize(changelog) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Transform this technical changelog into user-friendly release notes:\n\n${changelog}`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${error}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main (orchestration only - no business logic here)
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Synthesizing release notes for v${VERSION}...`);

  // Fetch existing release
  const release = await fetchRelease(VERSION);
  console.log(`Found release: ${release.name}`);

  // Skip if already synthesized (idempotency)
  if (release.body?.includes("What's New")) {
    console.log('Release notes already synthesized - skipping');
    return;
  }

  // Guard against empty release body
  const technicalNotes = (release.body ?? '').trim();
  if (!technicalNotes) {
    console.error('Release body is empty; cannot synthesize notes');
    process.exit(1);
  }

  // Synthesize user-friendly notes
  const userNotes = await synthesize(technicalNotes);
  if (!userNotes) {
    console.error('LLM returned empty response');
    process.exit(1);
  }

  // Combine: user-friendly summary + original technical notes
  const enhancedBody = `${userNotes}

<details>
<summary>Technical Changelog</summary>

${technicalNotes}
</details>`;

  // Update release
  await updateRelease(release.id, enhancedBody);
  console.log(`✓ Updated release v${VERSION} with user-friendly notes`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
