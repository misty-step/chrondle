"use node";

import { describe, it, expect } from "vitest";
import { requireAdmin, type AuthCtx, type AuthIdentity } from "../auth";
import { ConvexError } from "convex/values";

const makeCtx = (identity: AuthIdentity): AuthCtx => ({
  auth: {
    getUserIdentity: async () => identity,
  },
});

describe("requireAdmin", () => {
  it("throws when unauthenticated", async () => {
    const ctx = makeCtx(null);
    await expect(requireAdmin(ctx)).rejects.toThrow(ConvexError);
  });

  it("throws when role is not admin", async () => {
    const ctx = makeCtx({ publicMetadata: { role: "user" } });
    await expect(requireAdmin(ctx)).rejects.toThrow(/admin only/);
  });

  it("allows admin via publicMetadata.role", async () => {
    const identity = { subject: "user-1", publicMetadata: { role: "admin" } };
    const ctx = makeCtx(identity);
    await expect(requireAdmin(ctx)).resolves.toEqual(identity);
  });

  it("allows admin via metadata.role", async () => {
    const identity = { subject: "user-2", metadata: { role: "admin" } };
    const ctx = makeCtx(identity);
    await expect(requireAdmin(ctx)).resolves.toEqual(identity);
  });
});
