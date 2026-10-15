import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(__dirname, "..");

/**
 * Backend tests: the host's own suites (backend/__tests__) plus the repo's existing
 * Convex function tests, whose `convex-test` import is aliased to the
 * Cloudflare host engine so they double as the parity oracle.
 */
export default defineConfig({
  root,
  test: {
    name: "backend",
    // Also loaded as a project of the root config, where Vitest roots it at
    // backend/; scan from the repo root either way.
    dir: root,
    environment: "node",
    include: ["backend/__tests__/**/*.test.ts", "convex/**/*.convex.test.ts"],
    globalSetup: [path.resolve(__dirname, "scripts/generate-modules.mjs")],
    testTimeout: 20000,
  },
  resolve: {
    alias: [
      { find: /^convex-test$/, replacement: path.resolve(__dirname, "__tests__/convexTestCompat.ts") },
      {
        find: /^convex\/(values|server|react|browser|nextjs|react-clerk|react-auth0)$/,
        replacement: path.resolve(root, "node_modules/convex/$1"),
      },
      { find: /^convex\/(.*)$/, replacement: path.resolve(root, "convex/$1") },
      { find: "@", replacement: path.resolve(root, "src") },
    ],
  },
});
