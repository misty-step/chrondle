"use node";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ErrorWithStatus,
  createSanitizedError,
  sanitizeErrorForLogging,
} from "./errorSanitization";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1/responses";
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://chrondle.com",
  "X-Title": "Chrondle Event Generation",
} as const;

const GPT5_DISABLED = process.env.OPENAI_GPT5_ENABLED === "false";
const DEFAULT_MODEL_PRIORITY = GPT5_DISABLED
  ? ["openai/gpt-4o-mini", "google/gemini-2.5-flash"]
  : ["openai/gpt-5-mini", "openai/gpt-4o-mini", "google/gemini-2.5-flash"];

type PromptPair = {
  system: string;
  user: string;
};

export type LLMMetadata = Record<string, string | number | boolean | undefined>;

export interface TokenPricing {
  inputCostPer1K?: number;
  outputCostPer1K?: number;
  reasoningCostPer1K?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd?: number;
}

export interface LLMGenerationResult<T> {
  data: T;
  rawText: string;
  model: string;
  usage: TokenUsage;
  requestId: string;
}

export interface GenerateOptions<T> {
  prompt: PromptPair;
  schema: z.ZodSchema<T>;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: LLMMetadata;
  preferredModel?: string;
  reasoning?: {
    effort?: "low" | "medium" | "high";
    summary?: "auto" | "detailed";
  };
  text?: {
    verbosity?: "low" | "medium" | "high";
  };
  /**
   * JSON format constraint: "object" requires root to be object, "array" allows arrays, "any" omits constraint
   * Default: "object"
   */
  jsonFormat?: "object" | "array" | "any";
}

export interface ResponsesClientOptions {
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  modelPriority?: string[];
  maxAttempts?: number;
  temperature?: number;
  maxOutputTokens?: number;
  backoffBaseMs?: number;
  maxBackoffMs?: number;
  jitterRatio?: number;
  sleepFn?: (ms: number) => Promise<void>;
  logger?: Pick<typeof console, "log" | "error">;
  pricing?: Record<string, TokenPricing>;
  circuitBreaker?: {
    failureThreshold?: number;
    cooldownMs?: number;
  };
  reasoning?: {
    effort?: "low" | "medium" | "high";
    summary?: "auto" | "detailed";
  };
  text?: {
    verbosity?: "low" | "medium" | "high";
  };
}

export interface ResponsesClient {
  generate<T>(prompt: PromptPair, schema: z.ZodSchema<T>): Promise<LLMGenerationResult<T>>;
  generate<T>(options: GenerateOptions<T>): Promise<LLMGenerationResult<T>>;
}

interface ResolvedOptions {
  apiKey: string;
  baseUrl: string;
  headers: Record<string, string>;
  modelPriority: string[];
  maxAttempts: number;
  temperature: number;
  maxOutputTokens: number;
  backoffBaseMs: number;
  maxBackoffMs: number;
  jitterRatio: number;
  sleepFn: (ms: number) => Promise<void>;
  logger: Pick<typeof console, "log" | "error">;
  pricing?: Record<string, TokenPricing>;
  circuitBreaker: {
    failureThreshold: number;
    cooldownMs: number;
  };
  reasoning: {
    effort: "low" | "medium" | "high";
    summary: "auto" | "detailed";
  };
  text: {
    verbosity: "low" | "medium" | "high";
  };
}

interface InputMessage {
  type: "message";
  role: "system" | "user" | "assistant";
  content: Array<{
    type: "input_text";
    text: string;
  }>;
}

interface OutputContent {
  type: "output_text";
  text: string;
  annotations?: unknown[];
}

interface OutputMessage {
  type: "message";
  role: "assistant";
  content: OutputContent[];
  status?: string;
  id?: string;
}

interface ReasoningOutput {
  type: "reasoning";
  summary?: string[];
  encrypted_content?: string;
}

interface ResponsesAPIResponse {
  id: string;
  object: string;
  created_at?: number;
  model?: string;
  output: Array<OutputMessage | ReasoningOutput>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    output_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
  status?: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveOptions(options: ResponsesClientOptions = {}): ResolvedOptions {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  return {
    apiKey,
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    headers: { ...DEFAULT_HEADERS, ...(options.headers ?? {}) },
    modelPriority:
      options.modelPriority && options.modelPriority.length > 0
        ? options.modelPriority
        : DEFAULT_MODEL_PRIORITY,
    maxAttempts: options.maxAttempts ?? 3,
    temperature: options.temperature ?? 0.2,
    maxOutputTokens: options.maxOutputTokens ?? 32_000, // Generous default for Responses API
    backoffBaseMs: options.backoffBaseMs ?? 1_000,
    maxBackoffMs: options.maxBackoffMs ?? 15_000,
    jitterRatio: options.jitterRatio ?? 0.25,
    sleepFn: options.sleepFn ?? defaultSleep,
    logger: options.logger ?? console,
    pricing: options.pricing,
    circuitBreaker: {
      failureThreshold: options.circuitBreaker?.failureThreshold ?? 5,
      cooldownMs: options.circuitBreaker?.cooldownMs ?? 5 * 60 * 1000,
    },
    reasoning: {
      effort: options.reasoning?.effort ?? "medium",
      summary: options.reasoning?.summary ?? "auto",
    },
    text: {
      verbosity: options.text?.verbosity ?? "medium",
    },
  };
}

function isGenerateOptions<T>(value: unknown): value is GenerateOptions<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "prompt" in value &&
      "schema" in value &&
      (value as GenerateOptions<T>).prompt,
  );
}

function flattenMetadata(metadata?: LLMMetadata): string {
  if (!metadata) {
    return "";
  }

  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return "";
  }

  const joined = entries
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : String(value)}`)
    .join(" ");
  return ` ${joined}`;
}

function transformToInputMessages(prompt: PromptPair): InputMessage[] {
  return [
    {
      type: "message" as const,
      role: "system" as const,
      content: [{ type: "input_text" as const, text: prompt.system }],
    },
    {
      type: "message" as const,
      role: "user" as const,
      content: [{ type: "input_text" as const, text: prompt.user }],
    },
  ];
}

function extractTextFromResponse(response: ResponsesAPIResponse): string {
  // Find the message output (not reasoning)
  const messageOutput = response.output.find((o) => o.type === "message") as
    | OutputMessage
    | undefined;

  if (!messageOutput) {
    throw new Error("No message output found in Responses API response");
  }

  // Find the text content
  const textContent = messageOutput.content.find((c) => c.type === "output_text");

  if (!textContent || !textContent.text) {
    throw new Error("No text content found in message output");
  }

  return textContent.text;
}

function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("LLM response was empty");
  }

  // Try to parse fenced JSON first
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return JSON.parse(fencedMatch[1].trim());
  }

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // Try to extract JSON object
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }

    // Try to extract JSON array
    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    }

    throw error;
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function computeUsage(
  response: ResponsesAPIResponse,
  rawText: string,
  prompt: PromptPair,
  model: string,
  pricing?: Record<string, TokenPricing>,
): TokenUsage {
  const usage = response.usage ?? {};
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;

  const resolvedInput = inputTokens || estimateTokens(`${prompt.system}\n${prompt.user}`);
  const resolvedOutput = outputTokens || estimateTokens(rawText);
  const resolvedReasoning = reasoningTokens;
  const resolvedTotal = totalTokens || resolvedInput + resolvedOutput + resolvedReasoning;

  const usageRecord: TokenUsage = {
    inputTokens: resolvedInput,
    outputTokens: resolvedOutput,
    reasoningTokens: resolvedReasoning,
    totalTokens: resolvedTotal,
  };

  const pricingForModel = pricing?.[model];
  if (pricingForModel) {
    const cost =
      (resolvedInput / 1000) * (pricingForModel.inputCostPer1K ?? 0) +
      (resolvedOutput / 1000) * (pricingForModel.outputCostPer1K ?? 0) +
      (resolvedReasoning / 1000) * (pricingForModel.reasoningCostPer1K ?? 0);
    usageRecord.costUsd = Number(cost.toFixed(6));
  }

  return usageRecord;
}

function shouldRetry(error: ErrorWithStatus): boolean {
  if (error.status !== undefined) {
    if (error.status === 429) {
      return true;
    }
    if (error.status >= 500) {
      return true;
    }
    if (error.status >= 400) {
      return false;
    }
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

function createRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `llm_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000)}`;
  }
}

class OpenRouterResponsesClient implements ResponsesClient {
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(private readonly options: ResolvedOptions) {}

  async generate<T>(
    prompt: PromptPair | GenerateOptions<T>,
    schema?: z.ZodSchema<T>,
  ): Promise<LLMGenerationResult<T>> {
    const normalized = this.normalizeArgs(prompt, schema);
    const requestId = (normalized.metadata?.requestId as string | undefined) ?? createRequestId();
    const logSuffix = flattenMetadata({ ...normalized.metadata, requestId });

    if (this.isCircuitOpen()) {
      throw new Error("LLM circuit breaker open - skipping request");
    }

    let attempt = 0;
    let modelIndex = this.resolveInitialModelIndex(normalized.preferredModel);
    let lastError: Error | null = null;

    while (attempt < this.options.maxAttempts) {
      const model =
        this.options.modelPriority[Math.min(modelIndex, this.options.modelPriority.length - 1)];
      this.options.logger.log(
        `[ResponsesAPI] ${requestId} attempt ${attempt + 1}/${this.options.maxAttempts} using ${model}${logSuffix}`,
      );

      try {
        // Determine JSON format constraint
        // "object" = json_object format (root must be object)
        // "array" or "any" = no format constraint (allows arrays)
        const jsonFormat = normalized.jsonFormat ?? "object";
        const textConfig = {
          ...(normalized.text ?? this.options.text),
          ...(jsonFormat === "object" ? { format: { type: "json_object" } } : {}),
        };

        const response = await fetch(this.options.baseUrl, {
          method: "POST",
          headers: {
            ...this.options.headers,
            Authorization: `Bearer ${this.options.apiKey}`,
          },
          body: JSON.stringify({
            model,
            input: transformToInputMessages(normalized.prompt),
            reasoning: normalized.reasoning ?? this.options.reasoning,
            text: textConfig,
            temperature: normalized.temperature ?? this.options.temperature,
            max_output_tokens: normalized.maxOutputTokens ?? this.options.maxOutputTokens,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const httpError: ErrorWithStatus = new Error(
            `Responses API request failed (${response.status} ${response.statusText})`,
          );
          httpError.status = response.status;
          this.options.logger.error(
            `[ResponsesAPI] ${requestId} HTTP error ${response.status}${logSuffix}: ${sanitizeErrorForLogging(errorText)}`,
          );
          throw httpError;
        }

        const payload = (await response.json()) as ResponsesAPIResponse;
        const rawText = extractTextFromResponse(payload);
        this.options.logger.log(
          `[ResponsesAPI] ${requestId} output length=${rawText.length} chars, status=${payload.status}, preview: ${rawText.substring(0, 150)}...`,
        );

        const parsed = extractJsonPayload(rawText);
        const data = normalized.schema.parse(parsed);
        const modelFromResponse = payload.model ?? model;
        const usage = computeUsage(
          payload,
          rawText,
          normalized.prompt,
          modelFromResponse,
          this.options.pricing,
        );

        this.options.logger.log(
          `[ResponsesAPI] ${requestId} success via ${modelFromResponse}${logSuffix} tokens=${usage.totalTokens} (input=${usage.inputTokens} output=${usage.outputTokens} reasoning=${usage.reasoningTokens})`,
        );

        this.resetCircuitBreaker();

        return {
          data,
          rawText,
          model: modelFromResponse,
          usage,
          requestId,
        };
      } catch (error) {
        lastError = error as Error;
        const sanitizedError = createSanitizedError(error);
        const errorWithStatus = sanitizedError as ErrorWithStatus;
        this.options.logger.error(
          `[ResponsesAPI] ${requestId} attempt ${attempt + 1} failed${logSuffix}: ${sanitizedError.message}`,
        );

        if (errorWithStatus.status === 429 && modelIndex < this.options.modelPriority.length - 1) {
          modelIndex += 1;
          this.options.logger.log(
            `[ResponsesAPI] ${requestId} switching to fallback model ${this.options.modelPriority[modelIndex]} after rate limit`,
          );
        }

        const isFinalAttempt = attempt === this.options.maxAttempts - 1;
        if (!shouldRetry(errorWithStatus) || isFinalAttempt) {
          this.recordFailure();
          throw sanitizedError;
        }

        this.recordFailure();

        const delay = calculateBackoffDelay(
          attempt,
          this.options.backoffBaseMs,
          this.options.maxBackoffMs,
          this.options.jitterRatio,
        );
        this.options.logger.log(`[ResponsesAPI] ${requestId} retrying in ${delay}ms`);
        await this.options.sleepFn(delay);
      }

      attempt += 1;
    }

    throw lastError ? createSanitizedError(lastError) : new Error("Responses API request failed");
  }

  private normalizeArgs<T>(
    prompt: PromptPair | GenerateOptions<T>,
    schema?: z.ZodSchema<T>,
  ): GenerateOptions<T> {
    if (isGenerateOptions<T>(prompt)) {
      return prompt;
    }

    if (!schema) {
      throw new Error("Schema argument is required when using positional generate signature");
    }

    return {
      prompt: prompt as PromptPair,
      schema,
    };
  }

  private resolveInitialModelIndex(preferredModel?: string): number {
    if (!preferredModel) {
      return 0;
    }

    const index = this.options.modelPriority.indexOf(preferredModel);
    return index === -1 ? 0 : index;
  }

  private isCircuitOpen(): boolean {
    if (this.circuitOpenedAt === null) {
      return false;
    }

    const elapsed = Date.now() - this.circuitOpenedAt;
    if (elapsed >= this.options.circuitBreaker.cooldownMs) {
      this.circuitOpenedAt = null;
      this.consecutiveFailures = 0;
      return false;
    }

    return true;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.circuitBreaker.failureThreshold) {
      this.circuitOpenedAt = Date.now();
      this.options.logger.error(
        `[ResponsesAPI] Circuit opened after ${this.consecutiveFailures} consecutive failures`,
      );
    }
  }

  private resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = null;
  }
}

export function createResponsesClient(options?: ResponsesClientOptions): ResponsesClient {
  return new OpenRouterResponsesClient(resolveOptions(options));
}
