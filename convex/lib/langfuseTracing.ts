"use node";
/**
 * Langfuse Tracing Helpers
 *
 * Safe wrappers for creating traces/spans/generations without coupling
 * pipeline code to SDK quirks. All helpers are non-throwing.
 *
 * @module convex/lib/langfuseTracing
 */

import type { LangfuseTraceClient, LangfuseSpanClient } from "langfuse";
import { isLangfuseConfigured, getLangfuse, flushLangfuse } from "./langfuse";

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
 * Trace wrapper result containing trace client and helpers.
 */
export interface TraceWrapper {
  trace: LangfuseTraceClient | null;
  createSpan: (config: SpanConfig) => SpanWrapper;
  endTrace: (output?: unknown) => void;
}

/**
 * Span wrapper result containing span client and helpers.
 */
export interface SpanWrapper {
  span: LangfuseSpanClient | null;
  createGeneration: (config: GenerationConfig) => void;
  endSpan: (output?: unknown) => void;
}

/**
 * Execute a function wrapped in a Langfuse trace.
 * Automatically handles trace creation, flushing, and error handling.
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
  const wrapper = createTraceWrapper(config);

  try {
    return await fn(wrapper);
  } catch (error) {
    // Record error in trace if available
    if (wrapper.trace) {
      try {
        wrapper.trace.update({
          metadata: {
            ...config.metadata,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch {
        // Ignore trace update failures
      }
    }
    throw error;
  } finally {
    await flushLangfuse();
  }
}

/**
 * Create a trace wrapper without executing a function.
 * Use when you need more control over trace lifecycle.
 */
export function createTraceWrapper(config: TraceConfig): TraceWrapper {
  if (!isLangfuseConfigured()) {
    return createNoOpWrapper();
  }

  let trace: LangfuseTraceClient | null = null;

  try {
    const langfuse = getLangfuse();
    trace = langfuse.trace({
      name: config.name,
      input: config.input,
      metadata: config.metadata,
      tags: config.tags,
      userId: config.userId,
      sessionId: config.sessionId,
    });
  } catch (error) {
    console.warn(
      "[Langfuse] Failed to create trace:",
      error instanceof Error ? error.message : error,
    );
    return createNoOpWrapper();
  }

  return {
    trace,
    createSpan: (spanConfig: SpanConfig) => createSpanWrapper(trace!, spanConfig),
    endTrace: (output?: unknown) => {
      try {
        trace?.update({ output });
      } catch {
        // Ignore
      }
    },
  };
}

/**
 * Create a span wrapper from a parent trace or span.
 */
function createSpanWrapper(
  parent: LangfuseTraceClient | LangfuseSpanClient,
  config: SpanConfig,
): SpanWrapper {
  let span: LangfuseSpanClient | null = null;

  try {
    span = parent.span({
      name: config.name,
      input: config.input,
      metadata: config.metadata,
    });
  } catch (error) {
    console.warn(
      "[Langfuse] Failed to create span:",
      error instanceof Error ? error.message : error,
    );
    return createNoOpSpanWrapper();
  }

  return {
    span,
    createGeneration: (genConfig: GenerationConfig) => {
      try {
        span?.generation({
          name: genConfig.name,
          model: genConfig.model,
          input: genConfig.input,
          output: genConfig.output,
          usage: genConfig.usage
            ? {
                input: genConfig.usage.inputTokens,
                output: genConfig.usage.outputTokens,
                total: genConfig.usage.totalTokens,
              }
            : undefined,
          metadata: {
            ...genConfig.metadata,
            ...(genConfig.promptName ? { promptName: genConfig.promptName } : {}),
            ...(genConfig.promptVersion ? { promptVersion: genConfig.promptVersion } : {}),
          },
        });
      } catch {
        // Ignore generation creation failures
      }
    },
    endSpan: (output?: unknown) => {
      try {
        span?.end({ output });
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
