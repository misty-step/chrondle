"use node";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ErrorWithStatus,
  createSanitizedError,
  sanitizeErrorForLogging,
} from "./errorSanitization";

type ZodSchema<T> = z.ZodSchema<T>;

type Role = "system" | "user";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  inputUsd: number;
  outputUsd: number;
  reasoningUsd: number;
  cacheSavingsUsd: number;
  totalUsd: number;
}

export interface GenerationMetadata {
  model: string;
  latencyMs: number;
  cacheHit: boolean;
  cacheKey?: string;
  requestId: string;
  cacheStatus?: string | null;
  fallbackFrom?: string;
}

export interface LLMGenerationResult<T> {
  data: T;
  rawText: string;
  usage: TokenUsage;
  cost: CostBreakdown;
  metadata: GenerationMetadata;
}

export interface Gemini3ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  model?: "google/gemini-3-pro-preview" | "google/gemini-3-flash-preview" | string;
  fallbackModel?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinking_level?: "low" | "medium" | "high";
  cache_system_prompt?: boolean;
  cache_ttl_seconds?: number;
  structured_outputs?: boolean;
  stage?: string;
  maxAttempts?: number;
  backoffBaseMs?: number;
  maxBackoffMs?: number;
  jitterRatio?: number;
  sleepFn?: (ms: number) => Promise<void>;
  logger?: Pick<typeof console, "log" | "error">;
}

export interface Gemini3GenerateOptions<T> {
  system: string;
  user?: string;
  prompt?: string; // Optional alias for user content when system prompt already provided
  schema?: ZodSchema<T>;
  metadata?: Record<string, string | number | boolean | undefined>;
  options?: Partial<Gemini3ClientOptions>;
}

export interface Gemini3Client {
  generate<T>(
    prompt: string,
    schema?: ZodSchema<T>,
    options?: Partial<Gemini3ClientOptions>,
  ): Promise<LLMGenerationResult<T>>;
  generate<T>(options: Gemini3GenerateOptions<T>): Promise<LLMGenerationResult<T>>;
}

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://chrondle.com",
  "X-Title": "Chrondle Gemini3 Client",
} as const;

const DEFAULT_MODEL = "google/gemini-3-pro-preview";
const DEFAULT_FALLBACK_MODEL = "openai/gpt-5-mini";

const GEMINI_PRICING = {
  inputPer1M: 2, // $2 per 1M input tokens
  outputPer1M: 12, // $12 per 1M output tokens
  reasoningPer1M: 0, // Reasoning tokens are ~free
};

const DEFAULTS: Required<Omit<Gemini3ClientOptions, "apiKey" | "headers">> = {
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
  fallbackModel: DEFAULT_FALLBACK_MODEL,
  temperature: 0.35,
  maxOutputTokens: 6_000,
  thinking_level: "medium",
  cache_system_prompt: true,
  cache_ttl_seconds: 86_400,
  structured_outputs: true,
  maxAttempts: 3,
  backoffBaseMs: 1_000,
  maxBackoffMs: 15_000,
  jitterRatio: 0.25,
  sleepFn: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  logger: console,
  stage: "gemini3",
};

function resolveOptions(options: Gemini3ClientOptions = {}): Required<Gemini3ClientOptions> {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  return {
    apiKey,
    baseUrl: options.baseUrl ?? DEFAULTS.baseUrl,
    headers: { ...DEFAULT_HEADERS, ...(options.headers ?? {}) },
    model: options.model ?? DEFAULTS.model,
    fallbackModel: options.fallbackModel ?? DEFAULTS.fallbackModel,
    temperature: options.temperature ?? DEFAULTS.temperature,
    maxOutputTokens: options.maxOutputTokens ?? DEFAULTS.maxOutputTokens,
    thinking_level: options.thinking_level ?? DEFAULTS.thinking_level,
    cache_system_prompt: options.cache_system_prompt ?? DEFAULTS.cache_system_prompt,
    cache_ttl_seconds: options.cache_ttl_seconds ?? DEFAULTS.cache_ttl_seconds,
    structured_outputs: options.structured_outputs ?? DEFAULTS.structured_outputs,
    maxAttempts: options.maxAttempts ?? DEFAULTS.maxAttempts,
    backoffBaseMs: options.backoffBaseMs ?? DEFAULTS.backoffBaseMs,
    maxBackoffMs: options.maxBackoffMs ?? DEFAULTS.maxBackoffMs,
    jitterRatio: options.jitterRatio ?? DEFAULTS.jitterRatio,
    sleepFn: options.sleepFn ?? DEFAULTS.sleepFn,
    logger: options.logger ?? DEFAULTS.logger,
    stage: options.stage ?? DEFAULTS.stage,
  } as Required<Gemini3ClientOptions>;
}

function isGenerateOptions<T>(value: unknown): value is Gemini3GenerateOptions<T> {
  return Boolean(value && typeof value === "object" && (value as Gemini3GenerateOptions<T>).system);
}

function createRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `llm_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000)}`;
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function calculateBackoffDelay(
  attempt: number,
  baseMs: number,
  maxMs: number,
  jitterRatio: number,
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = 1 + (Math.random() * 2 - 1) * jitterRatio;
  return Math.min(Math.floor(exponential * jitter), maxMs);
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

function mapThinkingLevel(level: "low" | "medium" | "high") {
  const budget = level === "high" ? 1024 : level === "medium" ? 512 : 256;
  return {
    effort: level,
    budget_tokens: budget,
  };
}

type JsonSchema = Record<string, unknown>;

function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def: any = schema.def ?? schema._def;
  const type = schema.type ?? def.type;

  switch (type) {
    case "object": {
      const shape = (def.shape as Record<string, z.ZodTypeAny>) ?? {};
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        // In Zod 4, optional fields have type "optional"
        if (value.type !== "optional") {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        additionalProperties: false,
        ...(required.length ? { required } : {}),
      };
    }
    case "array":
      return {
        type: "array",
        items: zodToJsonSchema(def.element ?? def.type),
      };
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "literal":
      return { const: def.value };
    case "enum":
      return { type: "string", enum: def.values };
    case "optional":
      return zodToJsonSchema(def.innerType);
    case "nullable": {
      const inner = zodToJsonSchema(def.innerType);
      const innerType = Array.isArray(inner.type) ? inner.type : [inner.type].filter(Boolean);
      return { ...inner, type: [...innerType, "null"] };
    }
    case "transform":
      return zodToJsonSchema(def.schema);
    default:
      throw new Error(`Unsupported Zod type for JSON schema: ${type}`);
  }
}

interface NormalizedRequest<T> {
  systemPrompt: string;
  userPrompt: string;
  schema?: ZodSchema<T>;
  metadata?: Record<string, string | number | boolean | undefined>;
  options: Required<Gemini3ClientOptions>;
}

function normalizeArgs<T>(
  prompt: string | Gemini3GenerateOptions<T>,
  schema?: ZodSchema<T>,
  options?: Partial<Gemini3ClientOptions>,
  base?: Required<Gemini3ClientOptions>,
): NormalizedRequest<T> {
  const baseOptions = base ?? resolveOptions();

  if (isGenerateOptions<T>(prompt)) {
    const stage = prompt.metadata?.stage as string | undefined;
    const mergedOptions = resolveOptions({
      ...baseOptions,
      ...(prompt.options ?? {}),
      ...(options ?? {}),
      stage,
    });
    const systemPrompt = prompt.system?.trim();
    if (!systemPrompt) {
      throw new Error("system prompt is required");
    }
    return {
      systemPrompt,
      userPrompt: prompt.user ?? prompt.prompt ?? "",
      schema: prompt.schema ?? schema,
      metadata: prompt.metadata,
      options: mergedOptions,
    };
  }

  const mergedOptions = resolveOptions({ ...baseOptions, ...(options ?? {}) });
  const systemPrompt = (prompt as string)?.trim();
  if (!systemPrompt) {
    throw new Error("prompt must be a non-empty string");
  }

  return {
    systemPrompt,
    userPrompt: "",
    schema,
    metadata: undefined,
    options: mergedOptions,
  };
}

function buildMessages(system: string, user: string): Array<{ role: Role; content: string }> {
  const messages: Array<{ role: Role; content: string }> = [{ role: "system", content: system }];

  if (user.trim().length > 0) {
    messages.push({ role: "user", content: user });
  }

  return messages;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromChatResponse(payload: any): { rawText: string; reasoningText?: string } {
  // Gemini 3 via OpenRouter may return either chat.completions shape or responses output shape.
  const choice = payload?.choices?.[0];
  if (choice?.message) {
    const message = choice.message as {
      content?: string | Array<{ text?: string }>;
      reasoning_content?: Array<{ text?: string }>;
    };
    const content = message.content;
    const reasoningContent = message.reasoning_content;

    const rawText = Array.isArray(content)
      ? content.map((c) => c.text ?? "").join("")
      : typeof content === "string"
        ? content
        : "";

    const reasoningText = Array.isArray(reasoningContent)
      ? reasoningContent.map((c) => c.text ?? "").join("\n")
      : undefined;

    if (rawText) {
      return { rawText, reasoningText };
    }
  }

  if (payload?.output) {
    const output = payload.output as Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
      summary?: string[];
    }>;
    const messageBlock = output.find((o) => o.type === "message");
    const reasoningBlock = output.find((o) => o.type === "reasoning");
    const rawText = messageBlock?.content?.find((c) => c.type === "output_text")?.text ?? "";
    const reasoningText = reasoningBlock?.summary?.join("\n");
    if (rawText) {
      return { rawText, reasoningText };
    }
  }

  if (typeof payload?.output_text === "string") {
    return { rawText: payload.output_text, reasoningText: undefined };
  }

  throw new Error("No message content found in Gemini 3 response");
}

function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("LLM response was empty");
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }

    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    }

    throw error;
  }
}

function computeUsage(
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  rawText: string,
  reasoningText: string | undefined,
  systemPrompt: string,
  userPrompt: string,
): TokenUsage {
  const usage = payload?.usage ?? {};

  const inputTokens =
    usage.prompt_tokens ?? usage.input_tokens ?? estimateTokens(`${systemPrompt}\n${userPrompt}`);
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? estimateTokens(rawText);
  const reasoningTokens =
    usage.reasoning_tokens ??
    usage?.output_tokens_details?.reasoning_tokens ??
    (reasoningText ? estimateTokens(reasoningText) : 0);

  return {
    inputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens: inputTokens + outputTokens + reasoningTokens,
  };
}

function computeCost(usage: TokenUsage, cacheHit: boolean): CostBreakdown {
  const effectiveInputTokens = cacheHit ? Math.ceil(usage.inputTokens * 0.1) : usage.inputTokens;
  const inputUsd = (effectiveInputTokens / 1_000_000) * GEMINI_PRICING.inputPer1M;
  const outputUsd = (usage.outputTokens / 1_000_000) * GEMINI_PRICING.outputPer1M;
  const reasoningUsd = (usage.reasoningTokens / 1_000_000) * GEMINI_PRICING.reasoningPer1M;

  const totalUsd = Number((inputUsd + outputUsd + reasoningUsd).toFixed(6));
  const baselineInputUsd = (usage.inputTokens / 1_000_000) * GEMINI_PRICING.inputPer1M;
  const cacheSavingsUsd = cacheHit ? Number((baselineInputUsd - inputUsd).toFixed(6)) : 0;

  return {
    inputUsd: Number(inputUsd.toFixed(6)),
    outputUsd: Number(outputUsd.toFixed(6)),
    reasoningUsd: Number(reasoningUsd.toFixed(6)),
    cacheSavingsUsd,
    totalUsd,
  };
}

function shouldRetry(error: ErrorWithStatus): boolean {
  if (error.status !== undefined) {
    if (error.status === 429) return true;
    if (error.status >= 500) return true;
    if (error.status >= 400) return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("econnreset") ||
    message.includes("failed to fetch")
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildResponseFormat(
  schema?: ZodSchema<unknown>,
  structuredOutputs = true,
): any | undefined {
  if (!schema || !structuredOutputs) return undefined;

  const jsonSchema = zodToJsonSchema(schema);
  return {
    type: "json_schema",
    json_schema: {
      name: "Gemini3StructuredOutput",
      schema: jsonSchema,
      strict: true,
    },
  };
}

class Gemini3ClientImpl implements Gemini3Client {
  constructor(private readonly baseOptions: Required<Gemini3ClientOptions>) {}

  async generate<T>(
    prompt: string | Gemini3GenerateOptions<T>,
    schema?: ZodSchema<T>,
    options?: Partial<Gemini3ClientOptions>,
  ): Promise<LLMGenerationResult<T>> {
    const normalized = normalizeArgs(prompt, schema, options, this.baseOptions);
    const requestId = (normalized.metadata?.requestId as string | undefined) ?? createRequestId();

    try {
      return await this.executeWithRetry(normalized, requestId, normalized.options.model);
    } catch (error) {
      const fallbackModel = normalized.options.fallbackModel;
      normalized.options.logger.error(
        `[Gemini3] ${requestId} primary model failed: ${sanitizeErrorForLogging(error)}`,
      );

      if (!fallbackModel || fallbackModel === normalized.options.model) {
        throw error;
      }

      normalized.options.logger.log(
        `[Gemini3] ${requestId} falling back to ${fallbackModel} after failures`,
      );
      return this.executeWithRetry(normalized, requestId, fallbackModel, normalized.options.model);
    }
  }

  private async executeWithRetry<T>(
    normalized: NormalizedRequest<T>,
    requestId: string,
    model: string,
    fallbackFrom?: string,
  ): Promise<LLMGenerationResult<T>> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < normalized.options.maxAttempts) {
      const start = Date.now();
      try {
        const response = await this.executeOnce(normalized, model, requestId);
        const latencyMs = Date.now() - start;

        const cacheStatus =
          response.headers?.get?.("x-openrouter-cache") ??
          response.headers?.get?.("x-cache") ??
          response.headers?.get?.("x-cache-status") ??
          null;
        const cacheHit = normalized.options.cache_system_prompt
          ? Boolean(cacheStatus && cacheStatus.toLowerCase().includes("hit"))
          : false;

        const payload = await response.json();
        const { rawText, reasoningText } = extractTextFromChatResponse(payload);
        const parsed = normalized.schema ? extractJsonPayload(rawText) : rawText;
        const data = normalized.schema ? normalized.schema.parse(parsed) : (parsed as T);
        const usage = computeUsage(
          payload,
          rawText,
          reasoningText,
          normalized.systemPrompt,
          normalized.userPrompt,
        );
        const cost = computeCost(usage, cacheHit);

        return {
          data,
          rawText,
          usage,
          cost,
          metadata: {
            model: payload.model ?? model,
            latencyMs,
            cacheHit,
            cacheKey: normalized.options.cache_system_prompt
              ? buildCacheKey(normalized.systemPrompt, normalized.options.stage)
              : undefined,
            requestId,
            cacheStatus,
            fallbackFrom,
          },
        };
      } catch (error) {
        lastError = error as Error;
        const sanitized = createSanitizedError(error);
        const errorWithStatus = sanitized as ErrorWithStatus;
        normalized.options.logger.error(
          `[Gemini3] ${requestId} attempt ${attempt + 1}/${normalized.options.maxAttempts} failed: ${sanitized.message}`,
        );

        const isFinal = attempt === normalized.options.maxAttempts - 1;
        if (!shouldRetry(errorWithStatus) || isFinal) {
          throw sanitized;
        }

        const delay = calculateBackoffDelay(
          attempt,
          normalized.options.backoffBaseMs,
          normalized.options.maxBackoffMs,
          normalized.options.jitterRatio,
        );
        normalized.options.logger.log(`[Gemini3] ${requestId} retrying in ${delay}ms`);
        await normalized.options.sleepFn(delay);
      }

      attempt += 1;
    }

    throw lastError ?? new Error("Gemini3 request failed");
  }

  private async executeOnce<T>(
    normalized: NormalizedRequest<T>,
    model: string,
    requestId: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      ...normalized.options.headers,
      Authorization: `Bearer ${normalized.options.apiKey}`,
    };

    const cacheKey = normalized.options.cache_system_prompt
      ? buildCacheKey(normalized.systemPrompt, normalized.options.stage)
      : undefined;

    if (cacheKey) {
      headers["X-Cache-Key"] = cacheKey;
      headers["X-Cache-TTL"] = String(normalized.options.cache_ttl_seconds);
      headers["X-Cache-Enable"] = "true";
    }

    const responseFormat = buildResponseFormat(
      normalized.schema,
      normalized.options.structured_outputs,
    );

    const body = {
      model,
      messages: buildMessages(normalized.systemPrompt, normalized.userPrompt),
      temperature: normalized.options.temperature,
      max_output_tokens: normalized.options.maxOutputTokens,
      reasoning: mapThinkingLevel(normalized.options.thinking_level),
      response_format: responseFormat,
    };

    normalized.options.logger.log(
      `[Gemini3] ${requestId} calling ${model} messages=${body.messages.length} cacheKey=${cacheKey ?? "none"}`,
    );

    const response = await fetch(normalized.options.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const httpError: ErrorWithStatus = new Error(
        `Gemini3 request failed (${response.status} ${response.statusText})`,
      );
      httpError.status = response.status;
      normalized.options.logger.error(
        `[Gemini3] ${requestId} HTTP error ${response.status}: ${sanitizeErrorForLogging(errorText)}`,
      );
      throw httpError;
    }

    return response;
  }
}

export function buildCacheKey(systemPrompt: string, stage: string | undefined): string {
  const namespace = stage ?? "gemini3";
  return `chrondle:${namespace}:${hashPrompt(systemPrompt)}`;
}

export function createGemini3Client(options?: Gemini3ClientOptions): Gemini3Client {
  const resolved = resolveOptions(options);
  return new Gemini3ClientImpl(resolved);
}
