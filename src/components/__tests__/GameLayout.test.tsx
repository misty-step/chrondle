import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameLayout, type GameLayoutProps } from "../GameLayout";
import { validateGameLayoutProps } from "@/lib/propValidation";

const mockValidate = vi.mocked(validateGameLayoutProps);

vi.mock("@/components/GameInstructions", () => ({
  GameInstructions: () => <div data-testid="game-instructions">Game Instructions</div>,
}));

vi.mock("@/components/game/RangeInput", () => ({
  RangeInput: ({
    disabled,
    onCommit,
    value,
    onChange,
  }: {
    disabled: boolean;
    onCommit: (payload: { start: number; end: number; hintsUsed: number }) => void;
    value?: [number, number];
    onChange?: (range: [number, number]) => void;
    minYear?: number;
    maxYear?: number;
    className?: string;
    hintsUsed?: number;
    isOneGuessMode?: boolean;
  }) => (
    <div data-testid="range-input-container">
      <input
        aria-label="Start year"
        disabled={disabled}
        value={value?.[0] ?? 0}
        onChange={(e) => {
          const newValue = parseInt(e.target.value);
          if (onChange && value) {
            onChange([newValue, value[1]]);
          }
        }}
      />
      <input
        aria-label="End year"
        disabled={disabled}
        value={value?.[1] ?? 0}
        onChange={(e) => {
          const newValue = parseInt(e.target.value);
          if (onChange && value) {
            onChange([value[0], newValue]);
          }
        }}
      />
      <button
        data-testid="range-input"
        data-disabled={String(disabled)}
        onClick={() => onCommit({ start: 1900, end: 1950, hintsUsed: 0 })}
      >
        Range Input
      </button>
    </div>
  ),
}));

vi.mock("@/components/game/HintIndicator", () => ({
  HintIndicator: () => <div data-testid="hint-indicator">Hint Indicator</div>,
}));

vi.mock("@/components/modals/GameComplete", () => ({
  GameComplete: () => <div data-testid="game-complete">Game Complete</div>,
}));

vi.mock("@/components/magicui/confetti", () => ({
  Confetti: () => <div data-testid="confetti">Confetti</div>,
  ConfettiRef: {},
}));

vi.mock("@/lib/propValidation", () => ({
  validateGameLayoutProps: vi.fn(),
}));

describe("GameLayout", () => {
  const mockOnRangeCommit = vi.fn();

  const createDefaultProps = (): GameLayoutProps => ({
    gameState: {
      puzzle: {
        year: 1969,
        events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
      },
      guesses: [],
      ranges: [],
      isGameOver: false,
      totalScore: 0,
    },
    isGameComplete: false,
    hasWon: false,
    isLoading: false,
    error: null,
    onRangeCommit: mockOnRangeCommit,
    remainingAttempts: 6,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("required props", () => {
    it("renders primary sections", () => {
      const props = createDefaultProps();
      render(<GameLayout {...props} />);

      expect(screen.getByTestId("game-instructions")).toBeTruthy();
      expect(screen.getByTestId("range-input")).toBeTruthy();
      expect(screen.getByTestId("hint-indicator")).toBeTruthy();
    });

    it("validates props", () => {
      const props = createDefaultProps();
      render(<GameLayout {...props} />);

      expect(mockValidate).toHaveBeenCalledWith(props);
    });

    it("renders when puzzle missing", () => {
      const props = createDefaultProps();
      props.gameState.puzzle = null;

      render(<GameLayout {...props} />);
      // RangeInput should still be present (check for input fields)
      expect(screen.getByLabelText(/start year/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end year/i)).toBeInTheDocument();
    });
  });

  describe("range input behavior", () => {
    it("hides range input when game complete", () => {
      const props = createDefaultProps();
      props.isGameComplete = true;

      render(<GameLayout {...props} />);

      // RangeInput should not be rendered when game is complete
      expect(screen.queryByLabelText(/start year/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/end year/i)).not.toBeInTheDocument();
    });

    it("disables inputs while loading", () => {
      const props = createDefaultProps();
      props.isLoading = true;

      render(<GameLayout {...props} />);

      // Input fields should be disabled when loading
      const startInput = screen.getByLabelText(/start year/i);
      const endInput = screen.getByLabelText(/end year/i);
      expect(startInput).toBeDisabled();
      expect(endInput).toBeDisabled();
    });

    it("invokes commit callback", () => {
      const props = createDefaultProps();
      render(<GameLayout {...props} />);

      fireEvent.click(screen.getByTestId("range-input"));
      expect(mockOnRangeCommit).toHaveBeenCalledWith({ start: 1900, end: 1950, hintsUsed: 0 });
    });
  });

  describe("optional props", () => {
    it("renders header/footer", () => {
      const props = createDefaultProps();
      props.headerContent = <div data-testid="header">Header</div>;
      props.footerContent = <div data-testid="footer">Footer</div>;

      render(<GameLayout {...props} />);
      expect(screen.getByTestId("header")).toBeTruthy();
      expect(screen.getByTestId("footer")).toBeTruthy();
    });

    it("renders confetti when ref provided", () => {
      const props = createDefaultProps();
      props.confettiRef = { current: null };

      render(<GameLayout {...props} />);
      expect(screen.getByTestId("confetti")).toBeTruthy();
    });
  });

  describe("game complete state", () => {
    it("renders summary panel and hides current hint", () => {
      const props = createDefaultProps();
      props.isGameComplete = true;

      render(<GameLayout {...props} />);
      expect(screen.getByTestId("game-complete")).toBeTruthy();
      expect(screen.queryByTestId("current-hint")).toBeNull();
    });
  });

  describe("type safety", () => {
    it("accepts full props object", () => {
      const props: GameLayoutProps = {
        gameState: {
          puzzle: { year: 1969, events: ["E1", "E2", "E3", "E4", "E5", "E6"] },
          guesses: [1970, 1968],
          ranges: [
            { start: 1960, end: 1970, hintsUsed: 0, score: 30, timestamp: 1 },
            { start: 1940, end: 1950, hintsUsed: 1, score: 15, timestamp: 2 },
          ],
          isGameOver: false,
          totalScore: 45,
        },
        isGameComplete: false,
        hasWon: false,
        isLoading: false,
        error: null,
        onRangeCommit: () => {},
        remainingAttempts: 4,
        headerContent: <div>Header</div>,
        footerContent: <div>Footer</div>,
        confettiRef: { current: null },
      };

      render(<GameLayout {...props} />);
      expect(screen.getByTestId("game-instructions")).toBeTruthy();
    });
  });
});
