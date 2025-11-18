"use node";

// Convex Action for Historical Context Generation
// Handles external API calls to OpenRouter for AI-generated historical narratives
// This action is called during puzzle generation to create context server-side

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  ErrorWithStatus,
  createSanitizedError,
  sanitizeErrorForLogging,
} from "../lib/errorSanitization";

// Response type for OpenRouter Responses API
interface APIResponse {
  output_text: string;
  reasoning_tokens?: number;
}

/**
 * Enforces BC/AD date format in historical context text
 * Replaces any BCE/CE occurrences with BC/AD
 */
function enforceADBC(text: string): string {
  return text
    .replace(/\bBCE\b/g, "BC")
    .replace(/\bCE\b/g, "AD")
    .replace(/\b(\d+)\s*BCE\b/gi, "$1 BC")
    .replace(/\b(\d+)\s*CE\b/gi, "$1 AD");
}

/**
 * Enhances the generated historical context with post-processing
 * Applies BC/AD enforcement and formatting improvements
 */
function enhanceHistoricalContext(text: string): string {
  // 1. Enforce BC/AD format
  let enhanced = enforceADBC(text);

  // 2. Ensure proper paragraph spacing for readability
  enhanced = enhanced.replace(/\n{3,}/g, "\n\n"); // Remove excessive line breaks

  // 3. Trim any trailing whitespace
  enhanced = enhanced.trim();

  return enhanced;
}

/**
 * Builds OpenRouter Responses API request configuration
 *
 * Uses the Responses API Alpha endpoint with reasoning controls for high-quality
 * narrative generation. This function combines prompts and maps parameters to the
 * Responses API format.
 *
 * @param args - Configuration object
 * @param args.model - OpenRouter model identifier (e.g., "openai/gpt-5")
 * @param args.prompt - User prompt describing the historical narrative task
 * @param args.systemPrompt - System-level instructions for the historian persona
 * @param args.temperature - Sampling temperature for response variability (0.0-2.0)
 * @param args.maxTokens - Maximum tokens to generate in the response
 *
 * @returns Responses API request body with:
 *   - input: Combined system and user prompts
 *   - reasoning: Low effort reasoning with automatic summaries
 *   - text: Low verbosity plain text output (175-225 word target)
 *   - temperature: Controls response creativity
 *   - max_output_tokens: Output length limit
 *
 * @see https://openrouter.ai/docs/responses-api
 */
function buildAPIConfig(args: {
  model: string;
  prompt: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}) {
  return {
    model: args.model,
    input: `${args.systemPrompt}\n\n${args.prompt}`,
    reasoning: {
      effort: "low",
      summary: "auto",
    },
    text: {
      verbosity: "low",
      format: { type: "text" },
    },
    temperature: args.temperature,
    max_output_tokens: args.maxTokens,
  };
}

/**
 * Internal action to generate historical context for a puzzle
 *
 * Called by the puzzle generation cron job after creating a new puzzle.
 * Makes external API call to OpenRouter's Responses API Alpha endpoint
 * with GPT-5 reasoning controls for high-quality narrative generation.
 *
 * Features:
 * - Low reasoning effort and verbosity for concise 175-225 word narratives
 * - Automatic BC/AD format enforcement (replaces BCE/CE)
 * - Exponential backoff retry logic with GPT-5 → GPT-5-mini fallback
 * - Cost estimation logging (~$0.015-0.018 per puzzle with reasoning tokens)
 *
 * @param puzzleId - ID of the puzzle to generate context for
 * @param year - Target year for the historical narrative
 * @param events - Array of 6 historical events to weave into the narrative
 */
export const generateHistoricalContext = internalAction({
  args: {
    puzzleId: v.id("puzzles"),
    year: v.number(),
    events: v.array(v.string()),
  },
  handler: async (ctx: ActionCtx, args): Promise<void> => {
    const { puzzleId, year } = args;

    console.error(`[HistoricalContext] Starting generation for puzzle ${puzzleId}, year ${year}`);

    try {
      // Check if GPT-5 is enabled (allows quick rollback to Gemini if needed)
      const gpt5Enabled = process.env.OPENAI_GPT5_ENABLED !== "false";

      // Get API key from environment
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY not found in environment variables");
      }

      // Prepare prompt using template from constants
      const eventsText = args.events.join("\n");
      const prompt = `Write a concise historical overview of ${year}.

Structure your response in two parts:
1. First, describe the ERA - what was happening in the world at this time? What were the defining forces, tensions, or transformations of this period?
2. Then, narrow to the YEAR - what made ${year} specifically significant within that broader context?

Some events that occurred this year (for reference - use only if they enhance your narrative):
${eventsText}

Don't force these events into your response if they don't fit naturally. Focus on telling a clear, factual story about why this year mattered. Include concrete details that help readers understand the period.

Keep your response direct and focused. Aim for 175-225 words.`;

      // Helper functions for retry logic
      const sleep = (ms: number): Promise<void> => {
        return new Promise((resolve) => setTimeout(resolve, ms));
      };

      const calculateBackoffDelay = (attempt: number): number => {
        const baseDelay = 1000; // 1 second base delay
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.5 + 0.75; // ±25% jitter
        return Math.floor(exponentialDelay * jitter);
      };

      const shouldRetry = (error: ErrorWithStatus | Error): boolean => {
        // Check if error has status property (type guard)
        const errorWithStatus = error as ErrorWithStatus;

        // Don't retry client errors (4xx) or rate limits
        if (
          errorWithStatus.status &&
          errorWithStatus.status >= 400 &&
          errorWithStatus.status < 500
        ) {
          return false;
        }

        // Retry server errors (5xx) and network failures
        const message = error.message?.toLowerCase() || "";
        return (
          message.includes("network") ||
          message.includes("server error") ||
          message.includes("timeout") ||
          message.includes("fetch") ||
          message.includes("500") ||
          message.includes("502") ||
          message.includes("503") ||
          message.includes("504") ||
          message.includes("failed to fetch") ||
          message.includes("request failed") ||
          (errorWithStatus.status !== undefined && errorWithStatus.status >= 500)
        );
      };

      // System prompt for historian persona
      const systemPrompt = `You are a knowledgeable historian providing clear, concise historical context.

Write factual narratives that explain what made a year historically significant. Use straightforward language and concrete details.

Use BC/AD dating exclusively. Aim for 175-225 words.`;

      // Retry loop with exponential backoff (max 3 attempts)
      const maxAttempts = 3;
      let lastError: Error = new Error("Unknown error occurred during context generation");
      let generatedContext: string | undefined;
      let currentModel = gpt5Enabled ? "openai/gpt-5" : "google/gemini-2.5-flash";
      let hasHitRateLimit = false;

      console.error("[HistoricalContext] Using model:", currentModel, "for puzzle:", puzzleId);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          console.error(
            `[HistoricalContext] Attempt ${attempt + 1}/${maxAttempts} for puzzle ${puzzleId}, year ${year}`,
          );

          // Build API request config
          const apiConfig = buildAPIConfig({
            model: currentModel,
            prompt,
            systemPrompt,
            temperature: 1.0,
            maxTokens: 8000,
          });

          // Make fetch call to OpenRouter Responses API
          const response = await fetch("https://openrouter.ai/api/alpha/responses", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://chrondle.com",
              "X-Title": "Chrondle Historical Context",
            },
            body: JSON.stringify(apiConfig),
          });

          // Check if request was successful
          if (!response.ok) {
            const errorText = await response.text();
            const isGPT5Error = currentModel.includes("gpt-5");
            const errorPrefix = isGPT5Error ? "GPT-5 API" : "OpenRouter API";
            const error: ErrorWithStatus = new Error(
              `${errorPrefix} request failed: ${response.status} ${response.statusText}${isGPT5Error && response.status === 429 ? " (rate limited)" : ""}`,
            );
            error.status = response.status;
            console.error(
              `[HistoricalContext] Attempt ${attempt + 1} failed - ${errorPrefix} error: ${response.status}`,
            );
            console.error(`[HistoricalContext] Error text: ${sanitizeErrorForLogging(errorText)}`);
            throw createSanitizedError(error);
          }

          // Parse Responses API response
          const responseData = (await response.json()) as APIResponse;
          generatedContext = responseData.output_text;

          if (!generatedContext || typeof generatedContext !== "string") {
            console.error(
              `[HistoricalContext] Attempt ${attempt + 1} failed - Invalid response structure from Responses API`,
            );
            throw new Error("Invalid response from Responses API");
          }

          // Log reasoning tokens if present
          if (responseData.reasoning_tokens) {
            console.error(
              `[HistoricalContext] Reasoning tokens used: ${responseData.reasoning_tokens}`,
            );
          }

          // Cost estimation for GPT-5 ($0.01/1K input + $0.03/1K output)
          if (currentModel.includes("gpt-5")) {
            const inputTokens = Math.ceil(prompt.length / 4);
            const outputTokens = Math.ceil(generatedContext.length / 4);
            const reasoningTokens = responseData.reasoning_tokens || 0;
            const costEstimate = inputTokens * 0.00001 + (outputTokens + reasoningTokens) * 0.00003;
            console.error(
              `[HistoricalContext] Cost estimate: $${costEstimate.toFixed(4)} (${inputTokens} input, ${outputTokens} output, ${reasoningTokens} reasoning)`,
            );
          }

          // Success! Break out of retry loop
          console.error(
            `[HistoricalContext] Attempt ${attempt + 1} succeeded - Generated ${generatedContext.length} characters for year ${year}`,
          );
          break;
        } catch (error) {
          lastError = error as Error;
          const errorWithStatus = error as ErrorWithStatus;
          console.error(
            `[HistoricalContext] Attempt ${attempt + 1}/${maxAttempts} failed for puzzle ${puzzleId}:`,
            sanitizeErrorForLogging(error),
          );

          // Check for rate limit (429) and switch to GPT-5-mini if not already using it
          if (
            errorWithStatus.status === 429 &&
            !hasHitRateLimit &&
            currentModel === "openai/gpt-5"
          ) {
            console.error(
              `[HistoricalContext] Rate limit hit with GPT-5, switching to GPT-5-mini for retry`,
            );
            currentModel = "openai/gpt-5-mini";
            hasHitRateLimit = true;
            // Continue to next iteration to retry with GPT-5-mini
            await sleep(calculateBackoffDelay(attempt));
            continue;
          }

          // Check if we should retry this error
          if (!shouldRetry(error as Error) || attempt === maxAttempts - 1) {
            // Don't retry, or this was the last attempt
            console.error(
              `[HistoricalContext] Not retrying error for puzzle ${puzzleId}:`,
              sanitizeErrorForLogging(error),
            );
            throw createSanitizedError(error);
          }

          // Calculate delay and sleep before next attempt
          const delay = calculateBackoffDelay(attempt);
          console.error(`[HistoricalContext] Retrying in ${delay}ms for puzzle ${puzzleId}...`);
          await sleep(delay);
        }
      }

      if (!generatedContext) {
        throw lastError || new Error("Failed to generate historical context after all retries");
      }

      console.error(
        `[HistoricalContext] Generated ${generatedContext.length} characters of context for year ${year}`,
      );

      // Apply post-processing to enhance the generated context
      const enhancedContext = enhanceHistoricalContext(generatedContext);
      console.error(
        `[HistoricalContext] Enhanced context to ${enhancedContext.length} characters after post-processing`,
      );

      // Call internal mutation to update puzzle with enhanced context
      const updateResult = await ctx.runMutation(internal.puzzles.updateHistoricalContext, {
        puzzleId,
        context: enhancedContext,
      });

      // Verify the update was successful using the returned puzzle data
      if (
        !updateResult.success ||
        !updateResult.updatedPuzzle ||
        !updateResult.updatedPuzzle.historicalContext
      ) {
        throw new Error(
          `Failed to verify historical context update for puzzle ${puzzleId}. ` +
            `Update result: success=${updateResult.success}, ` +
            `puzzle=${updateResult.updatedPuzzle ? "exists" : "null"}, ` +
            `context=${updateResult.updatedPuzzle?.historicalContext ? "present" : "missing"}`,
        );
      }

      console.error(
        `[HistoricalContext] Successfully persisted and verified context to database for puzzle ${puzzleId}`,
      );

      console.error(`[HistoricalContext] Successfully generated context for puzzle ${puzzleId}`);
    } catch (error) {
      console.error(
        `[HistoricalContext] Failed to generate context for puzzle ${puzzleId}:`,
        sanitizeErrorForLogging(error),
      );
      throw createSanitizedError(error);
    }
  },
});
