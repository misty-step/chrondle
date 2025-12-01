import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import { buildCacheKey, createGemini3Client } from "../gemini3Client";

const noopSleep = async () => undefined;

describe("gemini3Client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses structured output, tracks usage, cost, and cache metadata", async () => {
    const payload = {
      choices: [
        {
          message: {
            content: JSON.stringify({ value: 7, items: ["a", "b"] }),
            reasoning_content: [{ text: "thoughts" }],
          },
        },
      ],
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        output_tokens_details: {
          reasoning_tokens: 100,
        },
      },
      model: "google/gemini-3-pro-preview",
    };

    const headers = {
      get: (key: string) => (key.toLowerCase() === "x-openrouter-cache" ? "HIT" : null),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers,
      json: vi.fn().mockResolvedValue(payload),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createGemini3Client({
      apiKey: "test-key",
      sleepFn: noopSleep,
      cache_system_prompt: true,
      jitterRatio: 0,
    });

    const schema = z.object({ value: z.number(), items: z.array(z.string()) });

    const result = await client.generate({
      system: "You are structured",
      user: "Return JSON",
      schema,
      metadata: { stage: "generator" },
    });

    expect(result.data.value).toBe(7);
    expect(result.usage.reasoningTokens).toBe(100);
    expect(result.metadata.cacheHit).toBe(true);

    const expectedCacheKey = buildCacheKey("You are structured", "generator");
    const callHeaders = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders["X-Cache-Key"]).toBe(expectedCacheKey);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.response_format.json_schema.schema.properties.value.type).toBe("number");
    expect(body.reasoning.budget_tokens).toBeGreaterThan(0);

    // Cost: cache hit reduces input tokens to 10% (100 tokens -> $0.0002)
    expect(result.cost.inputUsd).toBeCloseTo(0.0002, 6);
    expect(result.cost.cacheSavingsUsd).toBeCloseTo(0.0018, 4);
    expect(result.cost.totalUsd).toBeGreaterThan(0);
  });

  it("retries with backoff on retryable errors", async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: vi.fn().mockResolvedValue("rate limit"),
    } as unknown as Response;

    const successResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: "google/gemini-3-pro-preview",
      }),
    } as unknown as Response;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);
    vi.stubGlobal("fetch", fetchMock);

    const sleepSpy = vi.fn();

    const client = createGemini3Client({
      apiKey: "test-key",
      maxAttempts: 2,
      backoffBaseMs: 1000,
      jitterRatio: 0,
      sleepFn: sleepSpy,
      cache_system_prompt: false,
    });

    const schema = z.object({ ok: z.boolean() });
    const result = await client.generate({ system: "system", user: "do it", schema });

    expect(result.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(1000);
  });

  it("falls back to GPT-5-mini after exhausting attempts", async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      statusText: "Server Error",
      text: vi.fn().mockResolvedValue("boom"),
    } as unknown as Response;

    const successPayload = {
      choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      usage: { input_tokens: 80, output_tokens: 40 },
      model: "openai/gpt-5-mini",
    };

    const successResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      json: vi.fn().mockResolvedValue(successPayload),
    } as unknown as Response;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(successResponse);
    vi.stubGlobal("fetch", fetchMock);

    const client = createGemini3Client({
      apiKey: "test-key",
      maxAttempts: 2,
      jitterRatio: 0,
      sleepFn: noopSleep,
    });

    const schema = z.object({ ok: z.boolean() });
    const result = await client.generate("system", schema);

    expect(result.data.ok).toBe(true);
    expect(result.metadata.model).toBe("openai/gpt-5-mini");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("builds deterministic cache keys", () => {
    const key1 = buildCacheKey("same prompt", "stageA");
    const key2 = buildCacheKey("same prompt", "stageA");
    const key3 = buildCacheKey("different", "stageA");

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1.startsWith("chrondle:stageA:")).toBe(true);
  });
});
