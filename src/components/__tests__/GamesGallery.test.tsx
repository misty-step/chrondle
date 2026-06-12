import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useQuery } from "convex/react";
import { GamesGallery } from "../GamesGallery";

// --- Mocks ---

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/modePreference", () => ({
  setModePreferenceCookie: vi.fn(),
}));

vi.mock("motion/react", () => ({
  motion: {
    button: ({ children, ...props }: React.ComponentProps<"button">) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@phosphor-icons/react", () => ({
  Crosshair: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="crosshair-icon" {...props} />
  ),
  Shuffle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="shuffle-icon" {...props} />,
  Sword: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="sword-icon" {...props} />,
}));

describe("GamesGallery", () => {
  beforeEach(() => {
    mockPush.mockClear();
    const mockUseQuery = vi.mocked(useQuery);
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({ puzzleNumber: 247 });
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders wordmark and tagline", () => {
      render(<GamesGallery />);

      expect(screen.getByRole("heading", { level: 1, name: "Chrondle" })).toBeInTheDocument();
      expect(screen.getByText("Daily history puzzles")).toBeInTheDocument();
    });

    it("renders all mode cards with copy, CTAs, and puzzle metadata", () => {
      render(<GamesGallery />);

      expect(screen.getByRole("button", { name: /classic/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /order/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /duel/i })).toBeInTheDocument();

      expect(screen.getByText("Pin the year from six historical clues.")).toBeInTheDocument();
      expect(screen.getByText("Drag six events into chronological order.")).toBeInTheDocument();
      expect(
        screen.getByText("Two events. Tap the one that happened first. How long can you last?"),
      ).toBeInTheDocument();

      expect(screen.getByText("Start Today's Classic")).toBeInTheDocument();
      expect(screen.getByText("Try Order Mode")).toBeInTheDocument();
      expect(screen.getByText("Start a Run")).toBeInTheDocument();

      expect(screen.getAllByText("New")).toHaveLength(2);
      expect(screen.getAllByText("Puzzle #247")).toHaveLength(2);
      expect(screen.getByText("Endless")).toBeInTheDocument();
    });

    it("renders mode icons", () => {
      render(<GamesGallery />);

      expect(screen.getByTestId("crosshair-icon")).toBeInTheDocument();
      expect(screen.getByTestId("shuffle-icon")).toBeInTheDocument();
      expect(screen.getByTestId("sword-icon")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("navigates to /classic when Classic card is clicked", () => {
      render(<GamesGallery />);

      fireEvent.click(screen.getByRole("button", { name: /classic/i }));

      expect(mockPush).toHaveBeenCalledWith("/classic");
    });

    it("navigates to /order when Order card is clicked", () => {
      render(<GamesGallery />);

      fireEvent.click(screen.getByRole("button", { name: /order/i }));

      expect(mockPush).toHaveBeenCalledWith("/order");
    });

    it("navigates to /duel when Duel card is clicked", () => {
      render(<GamesGallery />);

      fireEvent.click(screen.getByRole("button", { name: /duel/i }));

      expect(mockPush).toHaveBeenCalledWith("/duel");
    });
  });

  describe("Data fetching", () => {
    it("only requests puzzle numbers for deployed daily modes", () => {
      render(<GamesGallery />);

      expect(vi.mocked(useQuery)).toHaveBeenCalledTimes(2);
    });
  });

  describe("Accessibility", () => {
    it("uses a main landmark and heading hierarchy", () => {
      render(<GamesGallery />);

      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Chrondle" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Classic" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Order" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Duel" })).toBeInTheDocument();
    });

    it("exposes accessible buttons and hides icons from assistive tech", () => {
      render(<GamesGallery />);

      expect(screen.getAllByRole("button")).toHaveLength(3);
      expect(screen.getByTestId("crosshair-icon")).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByTestId("shuffle-icon")).toHaveAttribute("aria-hidden", "true");
    });
  });
});
