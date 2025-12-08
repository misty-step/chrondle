import { defineConfig } from "vitest/config";
import path from "path";

// Base configuration shared by unit and integration tests
const baseConfig = {
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    pool: "threads" as const,
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 2,
      },
    },
    // Use edge-runtime for Convex function tests (convex-test)
    environmentMatchGlobs: [
      ["convex/**/*.convex.test.ts", "edge-runtime"] as [string, "edge-runtime"],
      ["**", "jsdom"] as [string, "jsdom"],
    ],
    // Inline convex-test to enable import.meta.glob transform
    server: { deps: { inline: ["convex-test"] } },
    // Prevent tests from hanging
    testTimeout: 10000, // 10 second timeout per test
    hookTimeout: 10000, // 10 second timeout for hooks
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/e2e/**",
      "**/.{idea,git,cache,output,temp}/**",
      "src/lib/__tests__/performance.integration.test.ts",
    ],
    coverage: {
      provider: "v8" as const,
      reporter: ["text", "json", "html", "json-summary"],
      reportOnFailure: true,
      exclude: [
        // Standard exclusions
        "node_modules/**",
        "src/test/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/test-*.{ts,tsx}",
        "**/*.config.{ts,js}",
        "**/*.d.ts",
        ".next/**",
        "convex/_generated/**",
        "convex/migrations/**",
        "convex/test.setup.ts",

        // Pure type definitions (no runtime code)
        "src/types/game.ts",
        "src/types/range.ts",
        "src/types/orderGameState.ts",
        // NOTE: Keep puzzle.ts and gameState.ts - they have type guards

        // Third-party UI libraries
        "src/components/ui/**",
        "src/components/magicui/**",

        // Bootstrap/infrastructure
        "src/lib/env.ts",
        "src/instrumentation.ts",
        "src/middleware.ts",
        "src/components/providers.tsx",
        "src/components/providers/**",

        // Convex config/schema
        "convex/auth.config.ts",
        "convex/schema.ts",

        // Root config files
        ".lintstagedrc.js",
        ".size-limit.mjs",
        "sentry.*.mjs",
        "tailwind.config.mjs",
        "postcss.config.mjs",
        "lefthook.yml",
        "next.config.ts",
      ],
      // Coverage thresholds - ratcheted to current levels
      thresholds: {
        lines: 39,
        functions: 69,
        branches: 79,
        statements: 39,
      },
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Explicitly map the specific convex package subpaths to node_modules
      // to avoid being shadowed by the local convex/ folder alias
      {
        find: /^convex\/(values|server|react|browser|nextjs|react-clerk|react-auth0)$/,
        replacement: path.resolve(__dirname, "./node_modules/convex/$1"),
      },
      // Map everything else in convex/ to the local directory (e.g. convex/_generated)
      { find: /^convex\/(.*)$/, replacement: path.resolve(__dirname, "./convex/$1") },
    ],
  },
};

// Default config runs all tests
export default defineConfig(baseConfig);
