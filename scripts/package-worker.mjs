// Resolve/bundle once without credentials. Promotion uses no_bundle and these bytes.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { unstable_readConfig } from "wrangler";

const config = unstable_readConfig({ config: "wrangler.jsonc", env: "production" });
rmSync(".release", { recursive: true, force: true });
mkdirSync(".release/worker", { recursive: true });
const result = spawnSync("bun", ["x", "--no-install", "wrangler", "deploy", "--env", "production", "--dry-run", "--outdir", ".release/worker"], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
const main = readdirSync(".release/worker").filter((file) => /\.(mjs|js)$/.test(file));
if (main.length !== 1) throw new Error("Expected one bundled Worker entrypoint");
cpSync(resolve(config.assets.directory), ".release/assets", { recursive: true });
writeFileSync(".release/wrangler.json", JSON.stringify({
  name: config.name,
  account_id: config.account_id,
  main: `worker/${main[0]}`,
  no_bundle: true,
  find_additional_modules: true,
  rules: [{ type: "CompiledWasm", globs: ["**/*.wasm"], fallthrough: true }],
  compatibility_date: config.compatibility_date,
  compatibility_flags: config.compatibility_flags,
  workers_dev: config.workers_dev,
  preview_urls: config.preview_urls,
  routes: config.routes,
  observability: config.observability,
  send_metrics: false,
  assets: { ...config.assets, directory: "assets" },
  vars: { ...config.vars, NEXT_PUBLIC_CONVEX_URL: JSON.parse(readFileSync("web/production.json", "utf8")).NEXT_PUBLIC_CONVEX_URL },
}, null, 2) + "\n");
