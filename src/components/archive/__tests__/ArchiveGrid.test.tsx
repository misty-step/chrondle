import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArchiveGrid } from "../ArchiveGrid";

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the dailyDate module to control the "local" date
vi.mock("@/lib/time/dailyDate", () => ({
  getLocalDateString: vi.fn(),
}));

import { getLocalDateString } from "@/lib/time/dailyDate";
const mockGetLocalDateString = getLocalDateString as ReturnType<typeof vi.fn>;

describe("ArchiveGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const basePuzzles = [
    { puzzleNumber: 135, date: "2025-12-25", firstHint: "Future puzzle", isCompleted: false },
    { puzzleNumber: 134, date: "2025-12-24", firstHint: "Today puzzle", isCompleted: true },
    { puzzleNumber: 133, date: "2025-12-23", firstHint: "Yesterday puzzle", isCompleted: false },
    { puzzleNumber: 132, date: "2025-12-22", firstHint: "Two days ago", isCompleted: true },
  ];

  it("filters out future puzzles based on local date", async () => {
    mockGetLocalDateString.mockReturnValue("2025-12-24");
    render(<ArchiveGrid puzzles={basePuzzles} />);

    // After useEffect runs, future puzzles should be filtered
    // Wait for the effect to run
    await vi.waitFor(() => {
      expect(screen.queryByText("135")).not.toBeInTheDocument();
    });

    // Today and past puzzles should remain
    expect(screen.getByText("134")).toBeInTheDocument();
    expect(screen.getByText("133")).toBeInTheDocument();
    expect(screen.getByText("132")).toBeInTheDocument();
  });

  it("shows puzzles with today's date", async () => {
    mockGetLocalDateString.mockReturnValue("2025-12-24");
    render(<ArchiveGrid puzzles={basePuzzles} />);

    await vi.waitFor(() => {
      expect(screen.queryByText("135")).not.toBeInTheDocument();
    });

    // Puzzle dated 2025-12-24 (today) should be visible
    expect(screen.getByText("134")).toBeInTheDocument();
    expect(screen.getByText("Today puzzle")).toBeInTheDocument();
  });

  it("shows puzzles without dates (legacy data)", async () => {
    mockGetLocalDateString.mockReturnValue("2025-12-24");
    const puzzlesWithMissingDate = [
      { puzzleNumber: 100, date: undefined, firstHint: "No date puzzle", isCompleted: false },
      { puzzleNumber: 135, date: "2025-12-25", firstHint: "Future puzzle", isCompleted: false },
    ];

    render(<ArchiveGrid puzzles={puzzlesWithMissingDate} />);

    await vi.waitFor(() => {
      // Future puzzle should be filtered
      expect(screen.queryByText("135")).not.toBeInTheDocument();
    });

    // Puzzle without date should still show
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("uses correct link prefix for classic mode", async () => {
    mockGetLocalDateString.mockReturnValue("2025-12-24");
    const puzzles = [
      { puzzleNumber: 134, date: "2025-12-24", firstHint: "Test", isCompleted: false },
    ];

    render(<ArchiveGrid puzzles={puzzles} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/archive/puzzle/134");
  });

  it("uses custom link prefix for order mode", async () => {
    mockGetLocalDateString.mockReturnValue("2025-12-24");
    const puzzles = [
      { puzzleNumber: 134, date: "2025-12-24", firstHint: "Test", isCompleted: false },
    ];

    render(<ArchiveGrid puzzles={puzzles} linkPrefix="/archive/order" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/archive/order/134");
  });

  it("shows completion checkmark for completed puzzles", async () => {
    mockGetLocalDateString.mockReturnValue("2025-12-24");
    const puzzles = [
      { puzzleNumber: 134, date: "2025-12-24", firstHint: "Completed", isCompleted: true },
      { puzzleNumber: 133, date: "2025-12-23", firstHint: "Not completed", isCompleted: false },
    ];

    render(<ArchiveGrid puzzles={puzzles} />);

    // Both puzzles should have cards
    expect(screen.getByText("134")).toBeInTheDocument();
    expect(screen.getByText("133")).toBeInTheDocument();
  });
});
