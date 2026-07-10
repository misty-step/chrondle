import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const CANONICAL_CANARY_ENDPOINT = "https://canary.mistystep.io";
const RETIRED_PROVIDER_HOSTS = [
  "https://canary-obs.fly.dev",
  "https://canary-obs-3jzhr.ondigitalocean.app",
];

const sources = {
  "scope verification": readFileSync(
    join(process.cwd(), "scripts/verify-canary-key-scope.mjs"),
    "utf8",
  ),
  "production deploy workflow": readFileSync(
    join(process.cwd(), ".github/workflows/deploy.yml"),
    "utf8",
  ),
};

describe("canonical Canary endpoint contract", () => {
  for (const [name, source] of Object.entries(sources)) {
    test(`${name} falls back only to the stable canonical host`, () => {
      expect(source).toContain(CANONICAL_CANARY_ENDPOINT);
      for (const retiredHost of RETIRED_PROVIDER_HOSTS) {
        expect(source).not.toContain(retiredHost);
      }
    });
  }
});
