import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { siteConfig, siteMetadata } from "@/lib/site";

const LOCKED_PITCH =
  "A daily history puzzle: read the clues, guess the year. One real event per day, free at chrondle.app.";

describe("site identity copy", () => {
  it("uses the locked one-liner as the site description", () => {
    expect(siteConfig.description).toBe(LOCKED_PITCH);
    expect(siteMetadata.description).toBe(LOCKED_PITCH);
  });

  it("carries the locked one-liner through OG and twitter descriptions", () => {
    expect(siteMetadata.openGraph).toMatchObject({
      description: LOCKED_PITCH,
    });
    expect(siteMetadata.twitter).toMatchObject({
      description: LOCKED_PITCH,
    });
  });

  it("carries the locked one-liner through the web app manifest", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "public/site.webmanifest"), "utf8"),
    ) as { description?: string };

    expect(manifest.description).toBe(LOCKED_PITCH);
  });
});
