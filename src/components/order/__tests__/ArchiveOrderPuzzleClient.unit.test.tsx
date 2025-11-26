import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArchiveOrderPuzzleClient } from "../ArchiveOrderPuzzleClient";
import type { OrderPuzzle } from "@/types/orderGameState";

import type { Id } from "convex/_generated/dataModel";

const mockPuzzle: OrderPuzzle = {
  id: "order123" as Id<"orderPuzzles">,
  date: "2025-11-22",
  puzzleNumber: 12,
  seed: "seed",
  events: [
    { id: "a", year: -500, text: "Event A" },
    { id: "b", year: 1200, text: "Event B" },
  ],
};

vi.mock("@/hooks/useOrderGame", () => ({
  useOrderGame: () => ({
    gameState: {
      status: "ready",
      puzzle: mockPuzzle,
      currentOrder: mockPuzzle.events.map((e) => e.id),
      hints: [],
    },
    reorderEvents: vi.fn(),
    takeHint: vi.fn(),
    commitOrdering: vi.fn(),
  }),
}));

vi.mock("@/components/order/OrderGameBoard", () => ({
  OrderGameBoard: () => (
    <div data-testid="order-game-board">
      <div data-testid="doc-header">doc-header</div>
      <div data-testid="event-list">event-list</div>
      <div data-testid="hints">hints</div>
    </div>
  ),
}));
vi.mock("@/components/order/OrderReveal", () => ({
  OrderReveal: () => <div data-testid="reveal">reveal</div>,
}));
vi.mock("@/components/AppHeader", () => ({
  AppHeader: () => <div data-testid="app-header">app-header</div>,
}));
vi.mock("@/components/Footer", () => ({
  Footer: () => <div data-testid="footer">footer</div>,
}));
vi.mock("@/components/LayoutContainer", () => ({
  LayoutContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/LoadingScreen", () => ({
  LoadingScreen: () => <div data-testid="loading">loading</div>,
}));
vi.mock("@/components/ArchiveErrorBoundary", () => ({
  ArchiveErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ArchiveOrderPuzzleClient", () => {
  it("renders archive puzzle without not-found/loading flash", () => {
    render(<ArchiveOrderPuzzleClient puzzleNumber={12} initialPuzzle={mockPuzzle} />);

    expect(screen.queryByText(/Loading Order puzzle/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("doc-header")).toBeInTheDocument();
    expect(screen.getByTestId("event-list")).toBeInTheDocument();
  });
});
