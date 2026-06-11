import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/components/AppHeader", () => ({
  AppHeader: () => null,
}));

vi.mock("@/components/Footer", () => ({
  Footer: () => null,
}));

vi.mock("@/app/(app)/admin/dashboard/components/AdminTabs", () => ({
  AdminTabs: () => null,
}));

import { dynamic } from "@/app/(app)/admin/dashboard/page";

describe("AdminDashboardPage module", () => {
  it("forces dynamic rendering to avoid build-time Clerk evaluation", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
