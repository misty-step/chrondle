import { describe, it, expect } from "vitest";

import { api, getConvexClient } from "@/lib/convexServer";

describe("convexServer helpers", () => {
  it("exposes api object", () => {
    expect(api).toBeDefined();
  });

  it("returns null when convex URL missing", () => {
    const original = process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    expect(getConvexClient()).toBeNull();
    if (original) process.env.NEXT_PUBLIC_CONVEX_URL = original;
  });
});
