import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateConvexClient } from "../convexAuth";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe("request-scoped backend authentication", () => {
  it("requests the Convex JWT template and sets only that request's client", async () => {
    const getToken = vi.fn().mockResolvedValue("synthetic-session-a");
    vi.mocked(auth).mockResolvedValue({ getToken } as never);
    const a = new ConvexHttpClient("https://backend.example.invalid");
    const b = new ConvexHttpClient("https://backend.example.invalid");
    const setA = vi.spyOn(a, "setAuth");
    const setB = vi.spyOn(b, "setAuth");
    await authenticateConvexClient(a);
    expect(getToken).toHaveBeenCalledWith({ template: "convex" });
    expect(setA).toHaveBeenCalledWith("synthetic-session-a");
    expect(setB).not.toHaveBeenCalled();
  });

  it("refuses a missing verified token before setting client authentication", async () => {
    vi.mocked(auth).mockResolvedValue({ getToken: vi.fn().mockResolvedValue(null) } as never);
    const client = new ConvexHttpClient("https://backend.example.invalid");
    const setAuth = vi.spyOn(client, "setAuth");
    await expect(authenticateConvexClient(client)).rejects.toThrow(
      "Authenticated backend token unavailable",
    );
    expect(setAuth).not.toHaveBeenCalled();
  });
});
