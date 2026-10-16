#!/usr/bin/env node
// Runtime-only secret bulk payload. Never run during installation or compilation.
import { accessConfig } from "../src/operatorConfig.ts";
import { validateEnvironment } from "../../src/lib/env.schema.ts";

const reserved = new Set([
  "BACKEND",
  "BACKUPS",
  "ENVIRONMENT",
  "EXPOSE_ERRORS",
  "REVISION",
  "BACKEND_OPERATOR_ACCESS",
  "BACKEND_ADMIN_TOKEN",
  "EXTRA_AUTH_PROVIDERS",
]);

try {
  const operator = process.env.BACKEND_PRODUCTION_OPERATOR_ACCESS;
  const settings = JSON.parse(process.env.BACKEND_PRODUCTION_ENV ?? "");
  accessConfig.parse(JSON.parse(operator ?? ""));
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error();
  const entries = Object.entries(settings);
  if (entries.length === 0) throw new Error();
  for (const [name, value] of entries) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || reserved.has(name) || typeof value !== "string") {
      throw new Error();
    }
  }
  if (!validateEnvironment("convex", settings).valid) throw new Error();
  if (!process.argv.includes("--check")) {
    process.stdout.write(JSON.stringify({ ...settings, BACKEND_OPERATOR_ACCESS: operator }));
  }
} catch {
  // Parsing and validation errors may contain private values; never print them.
  console.error("Invalid production backend bindings; no payload emitted");
  process.exitCode = 1;
}
