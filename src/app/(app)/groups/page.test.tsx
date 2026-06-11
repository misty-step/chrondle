import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    groupsPuzzles: {
      getDailyGroupsPuzzle: "groups-query",
    },
  },
}));

vi.mock("@/components/groups/GroupsGameIsland", () => ({
  GroupsGameIsland: ({ preloadedPuzzle }: { preloadedPuzzle: unknown }) => (
    <div data-testid="groups-game-island">{preloadedPuzzle ? "loaded" : "missing"}</div>
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

import GroupsPage from "@/app/(app)/groups/page";

describe("GroupsPage", () => {
  beforeEach(() => {
    preloadQueryMock.mockReset();
    warnMock.mockReset();
  });

  it("renders the groups island when preload succeeds", async () => {
    preloadQueryMock.mockResolvedValueOnce({ preloaded: true });

    render(await GroupsPage());

    expect(screen.getByTestId("groups-game-island")).toHaveTextContent("loaded");
    expect(screen.queryByTestId("mode-unavailable-state")).not.toBeInTheDocument();
  });

  it("renders the unavailable state when preload returns null", async () => {
    preloadQueryMock.mockResolvedValueOnce(null);

    render(await GroupsPage());

    expect(screen.getByTestId("mode-unavailable-state")).toHaveTextContent("Groups Is Unavailable");
    expect(warnMock).toHaveBeenCalledWith(
      "[GroupsPage] Daily Groups puzzle unavailable during preload",
    );
  });

  it("renders the unavailable state for known backend-unavailable errors", async () => {
    preloadQueryMock.mockRejectedValueOnce(
      new Error("Environment variable NEXT_PUBLIC_CONVEX_URL is not set."),
    );

    render(await GroupsPage());

    expect(screen.getByTestId("mode-unavailable-state")).toHaveTextContent("Groups Is Unavailable");
    expect(warnMock).toHaveBeenCalledWith("[GroupsPage] Failed to preload Groups puzzle", {
      error: expect.any(Error),
    });
  });

  it("rethrows unexpected preload failures", async () => {
    preloadQueryMock.mockRejectedValueOnce(new Error("boom"));

    await expect(GroupsPage()).rejects.toThrow("boom");
  });
});
