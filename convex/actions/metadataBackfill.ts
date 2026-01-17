"use node";

import { v } from "convex/values";
import { z } from "zod";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createGemini3Client, type Gemini3Client } from "../lib/gemini3Client";
import { logStageError, logStageSuccess } from "../lib/logging";

/**
 * Metadata Backfill Action
 *
 * Uses LLM to categorize and tag existing events that lack metadata.
 * Critical for enabling diversity-aware puzzle selection on legacy events.
 */

const BACKFILL_SYSTEM_PROMPT = `You are ChronBot Tagger, categorizing historical events for a trivia game.

For each event, provide:
1. difficulty (1-5): How obscure is this event?
   - 1: Everyone knows (Moon landing, WWII end)
   - 2: Most history buffs know
   - 3: Requires some knowledge
   - 4: Specialist knowledge
   - 5: Very obscure

2. category: Primary topic areas (1-3 from this list):
   - war: Military conflicts, battles, treaties
   - politics: Government, elections, laws, rulers
   - science: Discoveries, inventions, space
   - culture: Arts, entertainment, social movements
   - technology: Engineering, industrial advances
   - religion: Religious events, leaders, movements
   - economy: Trade, finance, economic events
   - sports: Athletic events, competitions
   - exploration: Geographic discoveries, expeditions
   - arts: Literature, music, visual arts

3. fame_level (1-5): How globally famous is this event?
   - 1: Regional/niche interest only
   - 2: Known in specific countries/fields
   - 3: Moderately well-known globally
   - 4: Famous historical event
   - 5: Iconic, everyone knows it

4. tags: 2-5 free-form descriptive tags (e.g., "europe", "industrial-revolution", "royalty")

5. era: "ancient" (<500 CE), "medieval" (500-1500 CE), "modern" (>1500 CE)

BE CONSISTENT. Similar events should get similar scores.`;

const MetadataSchema = z.object({
  difficulty: z.number().min(1).max(5),
  category: z.array(z.string()).min(1).max(3),
  fame_level: z.number().min(1).max(5),
  tags: z.array(z.string()).min(2).max(5),
  era: z.enum(["ancient", "medieval", "modern"]),
});

const BatchMetadataSchema = z.array(
  z.object({
    event_text: z.string(),
    metadata: MetadataSchema,
  }),
);

let cachedBackfillClient: Gemini3Client | null = null;

function getBackfillClient(): Gemini3Client {
  if (!cachedBackfillClient) {
    cachedBackfillClient = createGemini3Client({
      temperature: 0.2, // Low temperature for consistency
      maxOutputTokens: 16_000,
      thinking_level: "low",
      structured_outputs: true,
      cache_system_prompt: true,
      cache_ttl_seconds: 86_400,
      model: "google/gemini-3-flash-preview",
      fallbackModel: "openai/gpt-5-mini",
      stage: "metadata-backfill",
    });
  }
  return cachedBackfillClient;
}

interface EventToBackfill {
  _id: Id<"events">;
  year: number;
  event: string;
}

interface BackfillResult {
  status: string;
  message?: string;
  processed: number;
  updated?: number;
  errors?: number;
  mismatches?: number;
  costUsd?: number;
}

/**
 * Normalize text for comparison - lowercase and collapse whitespace
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

type MetadataResult = { event_text: string; metadata: z.infer<typeof MetadataSchema> };

/**
 * Find matching metadata result by event_text
 * Returns the matching result or undefined if no match found
 */
function findMatchingMetadata(
  eventText: string,
  responseData: MetadataResult[],
  usedIndices: Set<number>,
): { result: MetadataResult; index: number } | undefined {
  const normalizedTarget = normalizeText(eventText);

  // First pass: exact match after normalization
  for (let i = 0; i < responseData.length; i++) {
    if (usedIndices.has(i)) continue;

    const normalizedResponse = normalizeText(responseData[i].event_text);
    if (normalizedResponse === normalizedTarget) {
      return { result: responseData[i], index: i };
    }
  }

  // Second pass: substring containment (handles truncation/expansion by LLM)
  for (let i = 0; i < responseData.length; i++) {
    if (usedIndices.has(i)) continue;

    const normalizedResponse = normalizeText(responseData[i].event_text);
    if (
      normalizedResponse.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedResponse)
    ) {
      return { result: responseData[i], index: i };
    }
  }

  return undefined;
}

/**
 * Core backfill logic - processes a batch of events
 * Extracted to allow reuse without circular references
 */
async function runBackfillBatch(ctx: ActionCtx, batchSize: number): Promise<BackfillResult> {
  // Get events missing metadata
  const eventsToBackfill = (await ctx.runQuery(internal.events.getEventsMissingMetadata, {
    limit: batchSize,
  })) as EventToBackfill[];

  if (eventsToBackfill.length === 0) {
    return {
      status: "complete",
      message: "No events need metadata backfill",
      processed: 0,
    };
  }

  const client = getBackfillClient();

  // Build prompt with all events
  const eventList = eventsToBackfill
    .map((e, i) => `${i + 1}. [Year ${e.year}] "${e.event}"`)
    .join("\n");

  const userPrompt = `Categorize these ${eventsToBackfill.length} historical events:

${eventList}

Return a JSON array with one object per event, in the same order:
[
  {
    "event_text": "exact event text",
    "metadata": {
      "difficulty": 3,
      "category": ["politics", "war"],
      "fame_level": 4,
      "tags": ["europe", "royalty"],
      "era": "modern"
    }
  }
]`;

  try {
    const response = await client.generate({
      system: BACKFILL_SYSTEM_PROMPT,
      user: userPrompt,
      schema: BatchMetadataSchema,
      metadata: {
        stage: "metadata-backfill",
        batchSize: eventsToBackfill.length,
      },
      // Options configured in getBackfillClient() - no overrides needed
    });

    // Match responses to events by event_text, not array index
    // LLMs can reorder, omit, or duplicate entries - matching by content prevents silent data corruption
    let updated = 0;
    let errors = 0;
    let mismatches = 0;
    const usedIndices = new Set<number>();

    for (const eventToUpdate of eventsToBackfill) {
      const match = findMatchingMetadata(eventToUpdate.event, response.data, usedIndices);

      if (!match) {
        // No matching metadata found - log warning and skip to avoid applying wrong metadata
        logStageError("MetadataBackfill", new Error("No matching metadata in LLM response"), {
          eventId: eventToUpdate._id,
          event: eventToUpdate.event,
          responseCount: response.data.length,
          availableTexts: response.data
            .filter((_, i) => !usedIndices.has(i))
            .map((r) => r.event_text.slice(0, 50)),
        });
        mismatches++;
        continue;
      }

      // Mark this response index as used to prevent duplicate matches
      usedIndices.add(match.index);

      try {
        await ctx.runMutation(internal.events.updateEventMetadata, {
          eventId: eventToUpdate._id,
          metadata: match.result.metadata,
        });
        updated++;
      } catch (updateError) {
        logStageError("MetadataBackfill", updateError, {
          eventId: eventToUpdate._id,
          event: eventToUpdate.event,
        });
        errors++;
      }
    }

    logStageSuccess("MetadataBackfill", "Batch completed", {
      processed: eventsToBackfill.length,
      updated,
      errors,
      mismatches,
      costUsd: response.cost.totalUsd,
    });

    return {
      status: "success",
      processed: eventsToBackfill.length,
      updated,
      errors,
      mismatches,
      costUsd: response.cost.totalUsd,
    };
  } catch (error) {
    logStageError("MetadataBackfill", error, { batchSize: eventsToBackfill.length });
    throw error;
  }
}

/**
 * Backfill metadata for a batch of events
 * Processes up to 20 events at a time for efficiency
 */
export const backfillEventMetadata = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BackfillResult> => {
    const batchSize = Math.min(args.batchSize ?? 20, 50);
    return runBackfillBatch(ctx, batchSize);
  },
});

/**
 * Public action for manual backfill trigger
 * Useful for admin scripts and testing
 */
export const triggerMetadataBackfill = action({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BackfillResult> => {
    // Check how many events need backfill
    const eventsMissing = (await ctx.runQuery(internal.events.getEventsMissingMetadata, {
      limit: 1,
    })) as EventToBackfill[];

    if (eventsMissing.length === 0) {
      return {
        status: "complete",
        message: "All events have metadata",
        processed: 0,
      };
    }

    // Run backfill using shared logic
    const batchSize = Math.min(args.batchSize ?? 20, 50);
    return runBackfillBatch(ctx, batchSize);
  },
});

interface FullBackfillResult {
  status: string;
  batches: number;
  totalProcessed: number;
  totalUpdated: number;
  totalCostUsd: number;
}

/**
 * Run multiple backfill batches until all events are tagged
 * Use with caution - can be expensive for large event pools
 */
export const backfillAllEvents = internalAction({
  args: {
    maxBatches: v.optional(v.number()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<FullBackfillResult> => {
    const maxBatches = args.maxBatches ?? 10;
    const batchSize = Math.min(args.batchSize ?? 20, 50);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalCost = 0;
    let batchCount = 0;

    while (batchCount < maxBatches) {
      batchCount++;

      const result = await runBackfillBatch(ctx, batchSize);

      if (result.status === "complete") {
        break;
      }

      totalProcessed += result.processed ?? 0;
      totalUpdated += result.updated ?? 0;
      totalCost += result.costUsd ?? 0;

      // Small delay between batches to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logStageSuccess("MetadataBackfill", "Full backfill completed", {
      batches: batchCount,
      totalProcessed,
      totalUpdated,
      totalCostUsd: totalCost,
    });

    return {
      status: "success",
      batches: batchCount,
      totalProcessed,
      totalUpdated,
      totalCostUsd: totalCost,
    };
  },
});
