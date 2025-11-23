import { describe, it, expect } from "vitest";

import { api, getConvexClient } from "@/lib/convexServer";

describe("convexServer helpers", () => {
  it("exposes api object", () => {
    expect(api).toBeDefined();
  });

  it("throws clear error when convex URL missing", () => {
    const original = process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    expect(() => getConvexClient()).toThrow(/NEXT_PUBLIC_CONVEX_URL/);
    if (original) process.env.NEXT_PUBLIC_CONVEX_URL = original;
  });
});
