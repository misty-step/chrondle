import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTodaysPuzzle } from "@/hooks/useTodaysPuzzle";
import { useTodaysOrderPuzzle } from "@/hooks/useTodaysOrderPuzzle";
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

// The gallery must consume the SAME local-date daily hooks as the game pages
// (src/hooks/useTodaysPuzzle.ts / useTodaysOrderPuzzle.ts) so the homepage can
// never advertise a different puzzle than the one a player actually plays.
vi.mock("@/hooks/useTodaysPuzzle", () => ({
  useTodaysPuzzle: vi.fn(),
}));

vi.mock("@/hooks/useTodaysOrderPuzzle", () => ({
  useTodaysOrderPuzzle: vi.fn(),
}));

vi.mock("@/components/kit/icons", () => ({
  Crosshair: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="crosshair-icon" {...props} />
  ),
  Shuffle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="shuffle-icon" {...props} />,
  Sword: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="sword-icon" {...props} />,
}));

function mockClassic(puzzleNumber: number | null) {
  vi.mocked(useTodaysPuzzle).mockReturnValue({
    puzzle:
      puzzleNumber === null
        ? null
        : ({ puzzleNumber, date: "2026-07-06" } as ReturnType<typeof useTodaysPuzzle>["puzzle"]),
    isLoading: puzzleNumber === null,
    error: null,
    localDate: "2026-07-06",
    revalidate: vi.fn(),
  });
}

function mockOrder(puzzleNumber: number | null) {
  vi.mocked(useTodaysOrderPuzzle).mockReturnValue({
    puzzle:
      puzzleNumber === null
        ? null
        : ({ puzzleNumber, date: "2026-07-06" } as ReturnType<
            typeof useTodaysOrderPuzzle
          >["puzzle"]),
    isLoading: puzzleNumber === null,
    error: null,
    localDate: "2026-07-06",
    usedPreload: false,
    revalidate: vi.fn(),
  });
}

describe("GamesGallery", () => {
  beforeEach(() => {
    mockPush.mockClear();
    vi.mocked(useTodaysPuzzle).mockReset();
    vi.mocked(useTodaysOrderPuzzle).mockReset();
    mockClassic(328);
    mockOrder(239);
  });

  afterEach(() => {
    cleanup();
  });

  describe("Daily identity (one 'today' everywhere)", () => {
    it("shows the local-date daily puzzle numbers from the same hooks the game pages use", () => {
      mockClassic(328);
      mockOrder(239);

      render(<GamesGallery />);

      expect(screen.getByText("Puzzle #328")).toBeInTheDocument();
      expect(screen.getByText("Puzzle #239")).toBeInTheDocument();
    });

    it("shows a loading skeleton while a daily puzzle resolves", () => {
      mockClassic(null);
      mockOrder(239);

      render(<GamesGallery />);

      expect(screen.queryByText("Puzzle #328")).not.toBeInTheDocument();
      expect(screen.getByText("Puzzle #239")).toBeInTheDocument();
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
});
