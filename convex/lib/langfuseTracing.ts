"use node";
/**
 * Langfuse Tracing Helpers (v4)
 *
 * Safe wrappers for creating traces/spans/generations using OpenTelemetry.
 * All helpers are non-throwing - pipeline output > observability.
 *
 * @module convex/lib/langfuseTracing
 */

import {
  startActiveObservation,
  startObservation,
  updateActiveObservation,
} from "@langfuse/tracing";
import { isLangfuseConfigured, initLangfuseOtel } from "./instrumentation";

/**
 * Trace configuration for event generation pipeline.
 */
export interface TraceConfig {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  tags?: string[];
  userId?: string;
  sessionId?: string;
}

/**
 * Span configuration for pipeline stages.
 */
export interface SpanConfig {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Generation configuration for LLM calls.
 */
export interface GenerationConfig {
  name: string;
  model: string;
  input?: unknown;
  output?: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
  promptName?: string;
  promptVersion?: string;
}

/**
 * Observation handle returned by startObservation in v4.
 */
interface ObservationHandle {
  update: (data: Record<string, unknown>) => ObservationHandle;
  end: () => void;
}

/**
 * Trace wrapper result containing helpers for creating spans.
 */
export interface TraceWrapper {
  trace: ObservationHandle | null;
  createSpan: (config: SpanConfig) => SpanWrapper;
  endTrace: (output?: unknown) => void;
}

/**
 * Span wrapper result containing helpers for creating generations.
 */
export interface SpanWrapper {
  span: ObservationHandle | null;
  createGeneration: (config: GenerationConfig) => void;
  endSpan: (output?: unknown) => void;
}

/**
 * Execute a function wrapped in a Langfuse trace.
 * Automatically handles trace creation and error handling.
 *
 * @example
 * const result = await withLangfuseTrace(
 *   { name: "year-event-generation", input: { year: 1969 }, tags: ["chrondle"] },
 *   async (wrapper) => {
 *     const { span, endSpan } = wrapper.createSpan({ name: "generator" });
 *     // ... do work ...
 *     endSpan({ candidates: 12 });
 *     wrapper.endTrace({ status: "success" });
 *     return result;
 *   }
 * );
 */
export async function withLangfuseTrace<T>(
  config: TraceConfig,
  fn: (wrapper: TraceWrapper) => Promise<T>,
): Promise<T> {
  // Ensure OTel is initialized
  initLangfuseOtel();

  if (!isLangfuseConfigured()) {
    return fn(createNoOpWrapper());
  }

  try {
    return await startActiveObservation(
      config.name,
      async () => {
        // Update the active observation with initial config
        updateActiveObservation({
          input: config.input,
          metadata: {
            ...config.metadata,
            tags: config.tags,
            userId: config.userId,
            sessionId: config.sessionId,
          },
        });

        const wrapper = createActiveWrapper();
        return fn(wrapper);
      },
      { asType: "span" },
    );
  } catch (error) {
    // If tracing setup fails, fall back to no-op
    console.warn(
      "[Langfuse] Trace failed, continuing without tracing:",
      error instanceof Error ? error.message : error,
    );
    return fn(createNoOpWrapper());
  }
}

/**
 * Create a trace wrapper that uses the active observation context.
 */
function createActiveWrapper(): TraceWrapper {
  return {
    trace: null, // v4 uses context-based tracing, no explicit handle
    createSpan: (config: SpanConfig) => createSpanWrapper(config),
    endTrace: (output?: unknown) => {
      try {
        updateActiveObservation({ output });
      } catch {
        // Ignore - non-throwing
      }
    },
  };
}

/**
 * Create a span wrapper using v4 startObservation.
 */
function createSpanWrapper(config: SpanConfig): SpanWrapper {
  let observation: ObservationHandle | null = null;

  try {
    observation = startObservation(config.name, {
      input: config.input,
      metadata: config.metadata,
    }) as ObservationHandle;
  } catch (error) {
    console.warn(
      "[Langfuse] Failed to create span:",
      error instanceof Error ? error.message : error,
    );
    return createNoOpSpanWrapper();
  }

  return {
    span: observation,
    createGeneration: (genConfig: GenerationConfig) => {
      try {
        // In v4, generations are created as child observations with asType: "generation"
        const gen = startObservation(
          genConfig.name,
          {
            input: genConfig.input,
            model: genConfig.model,
            metadata: {
              ...genConfig.metadata,
              promptName: genConfig.promptName,
              promptVersion: genConfig.promptVersion,
            },
          },
          { asType: "generation" },
        ) as ObservationHandle;

        // Update with output and usage if provided
        gen.update({
          output: genConfig.output,
          usageDetails: genConfig.usage
            ? {
                input: genConfig.usage.inputTokens,
                output: genConfig.usage.outputTokens,
                total: genConfig.usage.totalTokens,
              }
            : undefined,
        });

        gen.end();
      } catch {
        // Ignore generation creation failures
      }
    },
    endSpan: (output?: unknown) => {
      try {
        observation?.update({ output }).end();
      } catch {
        // Ignore
      }
    },
  };
}

/**
 * Create a no-op wrapper when Langfuse is not configured.
 */
function createNoOpWrapper(): TraceWrapper {
  return {
    trace: null,
    createSpan: () => createNoOpSpanWrapper(),
    endTrace: () => {},
  };
}

/**
 * Create a no-op span wrapper.
 */
function createNoOpSpanWrapper(): SpanWrapper {
  return {
    span: null,
    createGeneration: () => {},
    endSpan: () => {},
  };
}
