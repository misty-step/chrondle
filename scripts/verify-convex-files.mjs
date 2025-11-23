#!/usr/bin/env node

/**
 * Verifies that required Convex generated files are present and not staged for deletion.
 * This prevents accidental deletion of files needed for Vercel deployments.
 */

import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// These files MUST exist and be committed for Vercel deployments
const REQUIRED_FILES = [
  "convex/_generated/api.d.ts",
  "convex/_generated/api.js",
  "convex/_generated/dataModel.d.ts",
  "convex/_generated/server.d.ts",
  "convex/_generated/server.js",
];

async function verifyConvexFiles() {
  console.log("🔍 Verifying Convex generated files...");

  let hasErrors = false;

  // Step 1: Check if files exist locally
  console.log("\nChecking file existence...");
  const missingFiles = REQUIRED_FILES.filter((file) => !existsSync(file));

  if (missingFiles.length > 0) {
    console.error("\n❌ Missing required Convex files:");
    missingFiles.forEach((file) => console.error(`   - ${file}`));
    console.error("\n💡 Fix: Run `npx convex codegen` to generate them");
    hasErrors = true;
  } else {
    console.log("✅ All required files exist locally");
  }

  // Step 2: Check if files are staged for deletion
  try {
    console.log("\nChecking Git staging area...");
    const { stdout } = await execAsync("git diff --cached --name-status");

    const stagedChanges = stdout.split("\n").filter((line) => line.trim());
    const deletedFiles = stagedChanges
      .filter((line) => line.startsWith("D"))
      .map((line) => line.split("\t")[1])
      .filter((file) => REQUIRED_FILES.includes(file));

    if (deletedFiles.length > 0) {
      console.error("\n❌ ERROR: Attempting to delete required Convex files!");
      console.error("\nFiles marked for deletion:");
      deletedFiles.forEach((file) => console.error(`   - ${file}`));
      console.error("\n⚠️  These files MUST remain in Git for Vercel deployments to work.");
      console.error("💡 If you need to update them:");
      console.error("   1. Run `npx convex codegen` to regenerate");
      console.error("   2. Stage the updated files with `git add convex/_generated/`");
      console.error("\nSee convex/_generated/README.md for more information.");
      hasErrors = true;
    } else {
      console.log("✅ No required files staged for deletion");
    }

    // Step 3: Check if files are tracked in Git
    console.log("\nChecking Git tracking...");
    const { stdout: trackedFiles } = await execAsync("git ls-files convex/_generated/");
    const trackedList = trackedFiles.split("\n").filter((line) => line.trim());

    const untrackedRequired = REQUIRED_FILES.filter((file) => !trackedList.includes(file));

    if (untrackedRequired.length > 0) {
      console.warn("\n⚠️  Warning: Some required files are not tracked in Git:");
      untrackedRequired.forEach((file) => console.warn(`   - ${file}`));
      console.warn("\n💡 Fix: Stage them with `git add convex/_generated/`");
      // This is a warning, not an error, as they might be newly generated
    } else {
      console.log("✅ All required files are tracked in Git");
    }
  } catch (error) {
    console.warn("⚠️  Could not verify Git status:", error.message);
    console.warn("   Make sure you are in a Git repository");
  }

  // Final result
  console.log("\n" + "─".repeat(50));
  if (hasErrors) {
    console.error("❌ Convex file verification FAILED");
    console.error("\nPlease fix the issues above before proceeding.");
    process.exit(1);
  } else {
    console.log("✅ Convex file verification PASSED");
    console.log("\nAll required files are present and properly tracked.");
  }
}

// Run verification
verifyConvexFiles().catch((error) => {
  console.error("❌ Unexpected error during verification:", error);
  process.exit(1);
});
