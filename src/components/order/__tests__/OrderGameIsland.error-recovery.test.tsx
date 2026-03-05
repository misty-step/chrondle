/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderGameIsland } from "../OrderGameIsland";

vi.mock("convex/react", () => ({
  usePreloadedQuery: () => ({}),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/hooks/useWebShare", () => ({
  useWebShare: () => ({ share: vi.fn(), shareMethod: "clipboard" }),
}));

vi.mock("@/hooks/useOrderGame", () => ({
  useOrderGame: () => ({
    gameState: {
      status: "error",
      error: "Network timeout while loading order puzzle",
    },
    reorderEvents: vi.fn(),
    submitAttempt: vi.fn(),
    isSubmitting: false,
    lastError: null,
  }),
}));

vi.mock("@/components/order/OrderReveal", () => ({
  OrderReveal: () => <div />,
}));

vi.mock("@/components/order/OrderGameBoard", () => ({
  OrderGameBoard: () => <div />,
}));

vi.mock("@/components/GameModeLayout", () => ({
  GameModeLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/LayoutContainer", () => ({
  LayoutContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("OrderGameIsland error recovery", () => {
  it("shows a retry action on recoverable load errors", () => {
    render(<OrderGameIsland preloadedPuzzle={{} as never} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
