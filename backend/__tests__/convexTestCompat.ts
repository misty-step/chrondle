/**
 * Drop-in replacement for the parts of `convex-test` used by convex/__tests__,
 * backed by the Cloudflare host engine. backend/vitest.parity.config.ts aliases
 * `convex-test` to this module so the repo's existing Convex suites exercise
 * the new runtime unchanged.
 */
import { getFunctionName, mutationGeneric } from "convex/server";
import type { Value } from "convex/values";
import { Engine, type Identity, type Modules } from "../src/engine/engine";
import { memorySql } from "./sqlite";

type Schema = { export(): string };
type ModuleLoaders = Record<string, () => Promise<Record<string, unknown>>>;

async function loadModules(loaders: ModuleLoaders): Promise<Modules> {
  const generated = Object.keys(loaders).find((path) => path.includes("_generated"));
  const root = generated ? generated.split("_generated")[0] : "./";
  const modules: Modules = {};
  for (const [path, load] of Object.entries(loaders)) {
    if (path.includes("_generated") || !path.startsWith(root)) continue;
    modules[path.slice(root.length).replace(/\.[^.]+$/, "")] = await load();
  }
  return modules;
}

let runCounter = 0;

export function convexTest(schema: Schema, loaders: ModuleLoaders) {
  let ready: Promise<{ engine: Engine; modules: Modules }> | null = null;
  const boot = () =>
    (ready ??= loadModules(loaders).then((modules) => ({
      modules,
      engine: new Engine({
        sql: memorySql(),
        schemaExport: schema.export(),
        modules,
        exposeErrors: true,
      }),
    })));

  const api = (identity: Identity | null) => ({
    query: async (ref: unknown, args: Record<string, Value> = {}) =>
      (await boot()).engine.runQuery(getFunctionName(ref as never), args, identity, {
        visibility: "internal",
      }),
    mutation: async (ref: unknown, args: Record<string, Value> = {}) =>
      (
        await (
          await boot()
        ).engine.runMutation(getFunctionName(ref as never), args, identity, {
          visibility: "internal",
        })
      ).value,
    action: async (ref: unknown, args: Record<string, Value> = {}) =>
      (await boot()).engine.runAction(getFunctionName(ref as never), args, identity, {
        visibility: "internal",
      }),
    run: async <T>(handler: (ctx: never) => Promise<T>): Promise<T> => {
      const { engine, modules } = await boot();
      const name = `run${runCounter++}`;
      modules["__convexTestRun"] = {
        ...(modules["__convexTestRun"] ?? {}),
        [name]: mutationGeneric({ handler: handler as never }),
      };
      try {
        return (
          await engine.runMutation(`__convexTestRun:${name}`, {}, identity, {
            visibility: "internal",
          })
        ).value as T;
      } finally {
        delete modules["__convexTestRun"][name];
      }
    },
  });

  return {
    ...api(null),
    withIdentity(attributes: Record<string, Value>) {
      const issuer = (attributes.issuer as string) ?? "https://convex.test";
      const subject = (attributes.subject as string) ?? "test-subject";
      return api({
        ...attributes,
        issuer,
        subject,
        tokenIdentifier: `${issuer}|${subject}`,
      } as Identity);
    },
  };
}
