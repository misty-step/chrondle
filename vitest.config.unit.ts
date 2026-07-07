import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "./vitest.config";

// Root cause (see chrondle-eng-convex-edge-tests): each project in
// `baseVitestConfig.test.projects` declares `extends: true`, which makes
// Vitest re-resolve THIS file as that project's "root" config and merge its
// root-level `test.include` into the project's own `include` via Vite's
// `mergeConfig` — which concatenates arrays instead of letting the more
// specific project-level `include` win. Previously this file set
// `test.include` at the top level, so the broad unit-test pattern below
// leaked into the `convex-edge` project (env `edge-runtime`, no `document`)
// on top of its intentionally narrow `convex/**/*.convex.test.ts` include,
// causing every DOM-rendering unit test to *also* run there and crash with
// "Cannot read properties of undefined (reading 'body')".
//
// Fix: never set `test.include` at the root of this file. Instead, apply
// the unit-test scoping directly to the individual project(s) that should
// be scoped to it, by rebuilding `test.projects` via plain object spread
// (not `mergeConfig`, which would concatenate rather than replace). The
// `convex-edge` project is left untouched so its include stays exclusive.
const UNIT_TEST_INCLUDE = ["**/*.unit.test.{ts,tsx}"];

const scopedProjects = baseVitestConfig.test.projects.map((project) =>
  project.test.name === "convex-edge"
    ? project
    : {
        ...project,
        test: { ...project.test, include: UNIT_TEST_INCLUDE },
      },
);

export default mergeConfig(
  {
    ...baseVitestConfig,
    test: {
      ...baseVitestConfig.test,
      projects: scopedProjects,
    },
  },
  defineConfig({
    test: {
      // Unit tests should be fast, reduce timeout
      testTimeout: 5000,
      hookTimeout: 5000,
    },
  }),
);
