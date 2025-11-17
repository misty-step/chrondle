import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createLLMClient } from "../llmClient";

const schema = z.object({ ok: z.boolean() });
const PROMPT = { system: "system", user: "user" };

describe("LLM circuit breaker", () => {
  it("opens circuit after consecutive failures and recovers after cooldown", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failed"))
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({ ok: true }),
              },
            },
          ],
          usage: {},
          model: "openai/gpt-4o-mini",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createLLMClient({
      apiKey: "test",
      modelPriority: ["openai/gpt-4o-mini"],
      maxAttempts: 1,
      circuitBreaker: {
        failureThreshold: 2,
        cooldownMs: 50,
      },
    });

    await expect(client.generate(PROMPT, schema)).rejects.toThrow();
    await expect(client.generate(PROMPT, schema)).rejects.toThrow();

    await expect(client.generate(PROMPT, schema)).rejects.toThrow(/circuit breaker/);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const result = await client.generate(PROMPT, schema);
    expect(result.data.ok).toBe(true);
  });
});
