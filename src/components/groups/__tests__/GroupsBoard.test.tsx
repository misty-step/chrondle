import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupsBoard } from "@/components/groups/GroupsBoard";
import type { ReadyState } from "@/types/groupsGameState";

function makeGameState(overrides: Partial<ReadyState> = {}): ReadyState {
  const board = Array.from({ length: 16 }, (_, index) => ({
    id: `event-${index + 1}`,
    text: `Historical event ${index + 1} with enough detail to wrap across multiple lines`,
  }));

  return {
    status: "ready",
    puzzle: {
      id: "groups-puzzle-1" as never,
      date: "2026-04-10",
      puzzleNumber: 12,
      board,
      groups: [
        {
          id: "group-1",
          year: 1066,
          tier: "easy",
          eventIds: ["event-1", "event-2", "event-3", "event-4"],
        },
        {
          id: "group-2",
          year: 1776,
          tier: "medium",
          eventIds: ["event-5", "event-6", "event-7", "event-8"],
        },
        {
          id: "group-3",
          year: 1914,
          tier: "hard",
          eventIds: ["event-9", "event-10", "event-11", "event-12"],
        },
        {
          id: "group-4",
          year: 1989,
          tier: "very hard",
          eventIds: ["event-13", "event-14", "event-15", "event-16"],
        },
      ],
      seed: "seed-1",
    },
    activeCards: board,
    selectedIds: [],
    solvedGroupIds: [],
    mistakes: 0,
    remainingMistakes: 4,
    submissions: [],
    revealedGroups: [],
    ...overrides,
  };
}

describe("GroupsBoard", () => {
  it("renders the board grid, inline controls, and empty selection slots", () => {
    render(
      <GroupsBoard
        gameState={makeGameState()}
        toggleSelection={vi.fn()}
        clearSelection={vi.fn()}
        shuffleBoard={vi.fn()}
        submitSelection={vi.fn()}
        isSubmitting={false}
        lastError={null}
      />,
    );

    expect(screen.getByRole("group", { name: "Groups board" })).toBeInTheDocument();
    expect(screen.getByText("Current Selection")).toBeInTheDocument();
    expect(screen.getAllByText("Empty slot")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deselect All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Group" })).toBeDisabled();
  });

  it("mirrors selected cards into the selection tray and enables submit with four cards", () => {
    const gameState = makeGameState({
      selectedIds: ["event-1", "event-2", "event-3", "event-4"],
    });

    render(
      <GroupsBoard
        gameState={gameState}
        toggleSelection={vi.fn()}
        clearSelection={vi.fn()}
        shuffleBoard={vi.fn()}
        submitSelection={vi.fn()}
        isSubmitting={false}
        lastError={null}
      />,
    );

    const selectionTray = screen.getByLabelText("Current selection");
    expect(
      within(selectionTray).getByText(
        "Historical event 1 with enough detail to wrap across multiple lines",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Historical event 1 with enough detail to wrap across multiple lines",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Submit Group" })).toBeEnabled();
  });

  it("renders solved groups as revealed rows inside the board", () => {
    const baseState = makeGameState();
    render(
      <GroupsBoard
        gameState={{
          ...baseState,
          activeCards: baseState.activeCards.slice(4),
          solvedGroupIds: ["group-1"],
          revealedGroups: [baseState.puzzle.groups[0]],
        }}
        toggleSelection={vi.fn()}
        clearSelection={vi.fn()}
        shuffleBoard={vi.fn()}
        submitSelection={vi.fn()}
        isSubmitting={false}
        lastError={null}
      />,
    );

    expect(screen.getByText("Solved Group")).toBeInTheDocument();
    expect(screen.getByText("1066 AD")).toBeInTheDocument();
    expect(screen.getByText("easy")).toBeInTheDocument();
    expect(
      screen.getAllByText("Historical event 1 with enough detail to wrap across multiple lines"),
    ).toHaveLength(1);
  });
});
