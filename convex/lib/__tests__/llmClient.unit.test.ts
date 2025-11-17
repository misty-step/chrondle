import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import { createLLMClient } from "../llmClient";

const BASE_PROMPT = {
  system: "You are a test harness",
  user: "Return JSON",
};

const noopSleep = async () => undefined;

describe("llmClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses JSON output and validates against schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                value: 42,
                items: ["a", "b"],
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 80,
          total_tokens: 200,
        },
        model: "openai/gpt-4o-mini",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createLLMClient({
      apiKey: "test-key",
      modelPriority: ["openai/gpt-4o-mini"],
      sleepFn: noopSleep,
    });

    const schema = z.object({
      value: z.number(),
      items: z.array(z.string()),
    });

    const result = await client.generate(BASE_PROMPT, schema);

    expect(result.data.value).toBe(42);
    expect(result.data.items).toEqual(["a", "b"]);
    expect(result.model).toBe("openai/gpt-4o-mini");
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when schema validation fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ value: "not-a-number" }),
            },
          },
        ],
        usage: {},
        model: "openai/gpt-4o-mini",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createLLMClient({
      apiKey: "test-key",
      modelPriority: ["openai/gpt-4o-mini"],
      sleepFn: noopSleep,
    });

    const schema = z.object({ value: z.number() });

    await expect(client.generate(BASE_PROMPT, schema)).rejects.toThrow(/number/i);
  });

  it("switches to fallback model after rate limit", async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: vi.fn().mockResolvedValue("rate limit"),
    };

    const successPayload = {
      choices: [
        {
          message: {
            content: JSON.stringify({ ok: true }),
          },
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 25,
        total_tokens: 75,
      },
      model: "google/gemini-2.5-flash",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimitResponse as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue(successPayload),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createLLMClient({
      apiKey: "test-key",
      modelPriority: ["openai/gpt-4o-mini", "google/gemini-2.5-flash"],
      sleepFn: noopSleep,
    });

    const schema = z.object({ ok: z.boolean() });
    const result = await client.generate({
      prompt: BASE_PROMPT,
      schema,
      metadata: { stage: "generator" },
    });

    expect(result.data.ok).toBe(true);
    expect(result.model).toBe("google/gemini-2.5-flash");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstModel = JSON.parse(fetchMock.mock.calls[0][1].body).model;
    const secondModel = JSON.parse(fetchMock.mock.calls[1][1].body).model;
    expect(firstModel).toBe("openai/gpt-4o-mini");
    expect(secondModel).toBe("google/gemini-2.5-flash");
  });
});
