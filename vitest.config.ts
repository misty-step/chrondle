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
        "node_modules/**",
        "src/test/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/test-*.{ts,tsx}",
        "**/*.config.{ts,js}",
        "**/*.d.ts",
        ".next/**",
        "convex/_generated/**",
        "convex/migrations/**", // One-time batch operations
        "convex/test.setup.ts", // Test infrastructure (import.meta.glob artifacts)
      ],
      // Coverage thresholds - ratcheted up from 30/58/75/30
      thresholds: {
        lines: 31, // Improved from 30% → 31%
        functions: 59, // Improved from 58% → 59%
        branches: 76, // Improved from 75% → 76%
        statements: 31, // Improved from 30% → 31%
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
