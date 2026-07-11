#!/usr/bin/env node

/**
 * Comprehensive provider-neutral deployment readiness check.
 * Verifies all requirements are met before attempting deployment.
 */

import { existsSync, readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkDeploymentReadiness() {
  log("\n🚀 Deployment Readiness Check", colors.cyan);
  log("═".repeat(50), colors.cyan);

  const issues = [];
  const warnings = [];
  let checksRun = 0;
  let checksPassed = 0;

  // Check 1: Convex generated files
  log("\n📁 Checking Convex generated files...", colors.blue);
  checksRun++;

  const convexFiles = [
    "convex/_generated/api.d.ts",
    "convex/_generated/api.js",
    "convex/_generated/dataModel.d.ts",
    "convex/_generated/server.d.ts",
    "convex/_generated/server.js",
  ];

  const missingConvexFiles = convexFiles.filter((file) => !existsSync(file));
  if (missingConvexFiles.length > 0) {
    issues.push(`Missing Convex files: ${missingConvexFiles.join(", ")}`);
    log("   ❌ Some files missing", colors.red);
  } else {
    checksPassed++;
    log("   ✅ All files present", colors.green);
  }

  // Check 2: Verify files are in Git
  log("\n📊 Checking Git status...", colors.blue);
  checksRun++;

  try {
    const { stdout } = await execAsync("git ls-tree HEAD convex/_generated/");
    const filesInGit = stdout.split("\n").filter((line) => line.trim()).length;

    if (filesInGit < 5) {
      issues.push(`Only ${filesInGit}/5 Convex files committed to Git`);
      log(`   ❌ Missing files in Git (${filesInGit}/5)`, colors.red);
    } else {
      checksPassed++;
      log("   ✅ All files committed", colors.green);
    }
  } catch (error) {
    warnings.push("Could not check Git status");
    log("   ⚠️  Could not verify Git status", colors.yellow);
  }

  // Check 3: production hosting doctor
  log("\n⚙️  Checking production hosting doctor...", colors.blue);
  checksRun++;

  if (existsSync("scripts/verify-hosting-parity.mjs")) {
    checksPassed++;
    log("   ✅ Hosting parity doctor is present", colors.green);
  } else {
    issues.push("Missing scripts/verify-hosting-parity.mjs");
    log("   ❌ Hosting parity doctor is missing", colors.red);
  }

  // Check 4: Environment variables documentation
  log("\n🔐 Checking environment setup...", colors.blue);
  checksRun++;

  const hasEnvExample = existsSync(".env.example");
  const hasEnvLocal = existsSync(".env.local");

  if (!hasEnvExample) {
    warnings.push("Missing .env.example file for reference");
    log("   ⚠️  No .env.example found", colors.yellow);
  } else {
    checksPassed++;
    log("   ✅ Environment template exists", colors.green);
  }

  if (!hasEnvLocal) {
    log("   ℹ️  No .env.local (OK for CI/CD)", colors.cyan);
  }

  // Check 5: TypeScript compilation
  log("\n📝 Checking TypeScript...", colors.blue);
  checksRun++;

  try {
    const { stderr } = await execAsync("npx tsc --noEmit");
    if (stderr) {
      issues.push("TypeScript compilation errors");
      log("   ❌ Compilation errors found", colors.red);
    } else {
      checksPassed++;
      log("   ✅ No type errors", colors.green);
    }
  } catch (error) {
    // tsc returns non-zero exit code if there are errors
    issues.push("TypeScript compilation failed");
    log("   ❌ Type checking failed", colors.red);
  }

  // Check 6: Package.json scripts
  log("\n📦 Checking build scripts...", colors.blue);
  checksRun++;

  try {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    if (!packageJson.scripts?.build) {
      issues.push('Missing "build" script in package.json');
      log("   ❌ No build script", colors.red);
    } else {
      checksPassed++;
      log("   ✅ Build script exists", colors.green);
    }
  } catch (error) {
    issues.push("Could not read package.json");
    log("   ❌ Cannot read package.json", colors.red);
  }

  // Results summary
  log("\n" + "═".repeat(50), colors.cyan);
  log("📊 RESULTS SUMMARY", colors.cyan);
  log("─".repeat(50));

  log(`\nChecks: ${checksPassed}/${checksRun} passed`);

  if (warnings.length > 0) {
    log("\n⚠️  Warnings:", colors.yellow);
    warnings.forEach((warning) => log(`   • ${warning}`, colors.yellow));
  }

  if (issues.length > 0) {
    log("\n❌ Critical Issues:", colors.red);
    issues.forEach((issue) => log(`   • ${issue}`, colors.red));

    log("\n💡 Recommended Fixes:", colors.cyan);
    log("   1. Run `bunx convex codegen` to generate missing files");
    log("   2. Stage and commit: `git add convex/_generated/`");
    log("   3. Restore the production hosting parity doctor");
    log("   4. Fix any TypeScript errors");
    log("\n📖 See scripts/verify-convex-files.mjs for related verification details");

    log("\n❌ DEPLOYMENT NOT READY", colors.red);
    process.exit(1);
  } else {
    log("\n✅ DEPLOYMENT READY", colors.green);

    log("\n📝 Deployment Checklist:", colors.cyan);
    log("   ✓ All Convex files present and committed");
    log("   ✓ Production hosting doctor present");
    log("   ✓ TypeScript compiles without errors");
    log("   ✓ Build script available");

    log("\n🚀 Ready for the DigitalOcean App Platform deployment!", colors.green);

    if (warnings.length > 0) {
      log("\n⚠️  Note: Review warnings above for best practices", colors.yellow);
    }
  }
}

// Run the check
checkDeploymentReadiness().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});
