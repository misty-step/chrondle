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
    // Prevent tests from hanging
    testTimeout: 10000, // 10 second timeout per test
    hookTimeout: 10000, // 10 second timeout for hooks
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
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
      ],
      // Coverage thresholds - ratcheted up from 14/25/65/14
      thresholds: {
        lines: 28, // Improved from 14% → 28%
        functions: 55, // Improved from 25% → 55%
        branches: 74, // Improved from 65% → 74%
        statements: 28, // Improved from 14% → 28%
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
