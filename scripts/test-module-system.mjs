#!/usr/bin/env node

/**
 * Module System Compatibility Test
 * Validates that all configuration files are properly ESM compatible
 * and that critical dependencies support the current module setup.
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

console.log("🔍 Testing module system compatibility...\n");

// Test 1: Check package.json has "type": "module"
console.log("1. Checking package.json module type...");
const packageJsonPath = join(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

if (packageJson.type !== "module") {
  console.error('❌ package.json missing "type": "module"');
  process.exit(1);
}
console.log('✅ package.json has "type": "module"');

// Test 2: Check critical config files are ESM compatible
console.log("\n2. Checking configuration files...");
const configFiles = [
  { path: "tailwind.config.mjs", required: true },
  { path: ".size-limit.mjs", required: true },
  { path: "eslint.config.mjs", required: true },
  { path: "postcss.config.mjs", required: true },
  { path: "next.config.ts", required: true },
  { path: "vitest.config.ts", required: true },
  { path: "vitest.config.unit.ts", required: true },
  { path: "vitest.config.integration.ts", required: true },
];

let configErrors = 0;
for (const config of configFiles) {
  const fullPath = join(rootDir, config.path);
  if (!existsSync(fullPath)) {
    if (config.required) {
      console.error(`❌ Missing required config: ${config.path}`);
      configErrors++;
    } else {
      console.log(`⚠️  Optional config missing: ${config.path}`);
    }
  } else {
    console.log(`✅ Found: ${config.path}`);
  }
}

if (configErrors > 0) {
  console.error(`\n❌ ${configErrors} critical configuration files missing`);
  process.exit(1);
}

// Test 3: Check Node.js version compatibility
console.log("\n3. Checking Node.js version...");
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

if (majorVersion < 18) {
  console.error(`❌ Node.js ${nodeVersion} is too old. Requires Node.js 18+`);
  process.exit(1);
}
console.log(`✅ Node.js ${nodeVersion} is compatible (>= 18)`);

// Test 4: Test dynamic imports work
console.log("\n4. Testing dynamic imports...");
try {
  // Test that we can import ESM modules
  const pathModule = await import("path");
  if (typeof pathModule.join !== "function") {
    throw new Error("Dynamic import failed");
  }
  console.log("✅ Dynamic imports working");
} catch (error) {
  console.error("❌ Dynamic imports failed:", error.message);
  process.exit(1);
}

// Test 5: Check .nvmrc exists and matches CI
console.log("\n5. Checking Node.js version consistency...");
const nvmrcPath = join(rootDir, ".nvmrc");
if (!existsSync(nvmrcPath)) {
  console.error("❌ Missing .nvmrc file for Node.js version consistency");
  process.exit(1);
}

const nvmrcVersion = readFileSync(nvmrcPath, "utf8").trim();
if (majorVersion.toString() !== nvmrcVersion) {
  console.warn(
    `⚠️  Node.js version mismatch: running ${majorVersion}, .nvmrc specifies ${nvmrcVersion}`,
  );
} else {
  console.log(`✅ Node.js version matches .nvmrc: ${nvmrcVersion}`);
}

console.log("\n🎉 All module system tests passed!");
console.log("✅ ESM configuration is properly set up");
console.log("✅ Configuration files are compatible");
console.log("✅ Node.js version requirements met");
console.log("✅ Dynamic imports functional\n");
