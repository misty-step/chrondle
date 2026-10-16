#!/usr/bin/env tsx

import { anyApi } from "convex/server";
import { getOperatorClient } from "./lib/operator-client";

const apiRef = anyApi;

const BATCH_SIZE = 50;
const MAX_BATCHES = 20;

async function backfill() {
  const convex = getOperatorClient();
  let processed = 0;
  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const result = await convex.action(apiRef.actions.metadataBackfill.triggerMetadataBackfill, {
      batchSize: BATCH_SIZE,
    });
    if (result.status === "complete") {
      console.log("✅ Metadata backfill complete");
      return;
    }
    processed += result.processed;
    console.log(`Batch ${i + 1}: updated ${result.updated}; processed ${processed}`);
    if (result.errors || result.mismatches) {
      throw new Error("Backfill had errors or unmatched events; fix them before retrying");
    }
  }
  console.log(`Stopped after ${processed} events; rerun to continue`);
}

backfill().catch((error) => {
  console.error("❌ Backfill failed:", error);
  process.exit(1);
});
