import { defineConfig } from "vitest/config";
import type { UserConfig } from "vitest/config";
import path from "path";

const useForkPool = process.platform === "linux" && Boolean(process.versions.bun);

const sharedExclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/cypress/**",
  "**/e2e/**",
  "**/.{idea,git,cache,output,temp}/**",
  "src/lib/__tests__/performance.integration.test.ts",
] as const;

const coverageExclude = [
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

  // Generated CI/module code and operational scripts are validated separately
  "dagger/**",
  "scripts/**",
  "evals/**",
] as const;

// Base configuration shared by test projects
export const baseVitestConfig = {
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Bun on Linux exits early with thread pool + coverage; use forks in CI-like containers.
    pool: useForkPool ? ("forks" as const) : ("threads" as const),
    poolOptions: useForkPool
      ? {
          forks: {
            singleFork: false,
            maxForks: 4,
            minForks: 2,
          },
        }
      : {
          threads: {
            singleThread: false,
            maxThreads: 4,
            minThreads: 2,
          },
        },
    projects: [
      {
        extends: true as const,
        test: {
          name: "default",
          exclude: ["convex/**/*.convex.test.ts"],
        },
      },
      {
        extends: true as const,
        test: {
          name: "convex-edge",
          environment: "edge-runtime" as const,
          include: ["convex/**/*.convex.test.ts"],
        },
      },
    ],
    // Inline convex-test to enable import.meta.glob transform
    server: { deps: { inline: ["convex-test"] } },
    // Prevent tests from hanging
    testTimeout: 10000, // 10 second timeout per test
    hookTimeout: 10000, // 10 second timeout for hooks
    exclude: [...sharedExclude],
    coverage: {
      provider: "v8" as const,
      reporter: ["text", "json", "html", "json-summary"],
      reportsDirectory: "coverage",
      reportOnFailure: true,
      exclude: [...coverageExclude],
      // Coverage thresholds - ratcheted to current levels
      thresholds: {
        lines: 38,
        functions: 68, // lowered from 69 to accommodate Langfuse SDK wrappers
        branches: 79,
        statements: 38,
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
} satisfies UserConfig;

// Default config runs all tests
export default defineConfig(baseVitestConfig);
