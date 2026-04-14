import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { preloadQueryMock, warnMock } = vi.hoisted(() => ({
  preloadQueryMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("convex/nextjs", () => ({
  preloadQuery: preloadQueryMock,
}));

vi.mock("@/lib/convexServer", () => ({
  api: {
    orderPuzzles: {
      getDailyOrderPuzzle: "order-query",
    },
  },
}));

vi.mock("@/components/order/OrderGameIsland", () => ({
  OrderGameIsland: ({ preloadedPuzzle }: { preloadedPuzzle: unknown }) => (
    <div data-testid="order-game-island">{preloadedPuzzle ? "loaded" : "missing"}</div>
  ),
}));

vi.mock("@/components/LoadingShell", () => ({
  LoadingShell: () => <div data-testid="loading-shell">loading</div>,
}));

vi.mock("@/components/GameModeUnavailableState", () => ({
  GameModeUnavailableState: ({ title }: { title: string }) => (
    <div data-testid="mode-unavailable-state">{title}</div>
  ),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: warnMock,
  },
}));

import OrderPage from "@/app/(app)/order/page";

describe("OrderPage", () => {
  beforeEach(() => {
    preloadQueryMock.mockReset();
    warnMock.mockReset();
  });

  it("renders the order island when preload succeeds", async () => {
    preloadQueryMock.mockResolvedValueOnce({ preloaded: true });

    render(await OrderPage());

    expect(screen.getByTestId("order-game-island")).toHaveTextContent("loaded");
    expect(screen.queryByTestId("mode-unavailable-state")).not.toBeInTheDocument();
  });

  it("renders the unavailable state when preload returns null", async () => {
    preloadQueryMock.mockResolvedValueOnce(null);

    render(await OrderPage());

    expect(screen.getByTestId("mode-unavailable-state")).toHaveTextContent("Order Is Unavailable");
    expect(warnMock).toHaveBeenCalledWith(
      "[OrderPage] Daily Order puzzle unavailable during preload",
    );
  });

  it("renders the unavailable state for known backend-unavailable errors", async () => {
    preloadQueryMock.mockRejectedValueOnce(
      new Error("Environment variable NEXT_PUBLIC_CONVEX_URL is not set."),
    );

    render(await OrderPage());

    expect(screen.getByTestId("mode-unavailable-state")).toHaveTextContent("Order Is Unavailable");
    expect(warnMock).toHaveBeenCalledWith("[OrderPage] Failed to preload Order puzzle", {
      error: expect.any(Error),
    });
  });

  it("rethrows unexpected preload failures", async () => {
    preloadQueryMock.mockRejectedValueOnce(new Error("boom"));

    await expect(OrderPage()).rejects.toThrow("boom");
  });
});
