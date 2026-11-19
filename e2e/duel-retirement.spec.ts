import { test, expect } from "@playwright/test";

test.describe("Retired Duel URLs", () => {
  for (const path of [
    "/duel",
    "/duel/old-run",
    "/duel?from=bookmark",
    "/duel/old-run?from=bookmark&return=%2Fclassic",
  ]) {
    test(`${path} permanently redirects home`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      const location = new URL(response.headers().location, response.url());
      expect(location.pathname).toBe("/");
      expect(location.search).toBe(path.includes("?") ? path.slice(path.indexOf("?")) : "");
    });
  }
});
