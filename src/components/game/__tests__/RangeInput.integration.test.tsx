import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { RangeInput } from "../RangeInput";
import { GAME_CONFIG } from "@/lib/constants";
import { SCORING_CONSTANTS } from "@/lib/scoring";

// Mock EraToggle to simplify testing
vi.mock("@/components/ui/EraToggle", () => ({
  EraToggle: ({ value, onChange }: { value: string; onChange: (era: "BC" | "AD") => void }) => (
    <div data-testid={`era-toggle-${value}`}>
      <button data-testid={`toggle-bc-${value}`} onClick={() => onChange("BC")}>
        BC
      </button>
      <button data-testid={`toggle-ad-${value}`} onClick={() => onChange("AD")}>
        AD
      </button>
    </div>
  ),
}));

describe("RangeInput", () => {
  const renderRangeInput = (overrides: Partial<Parameters<typeof RangeInput>[0]> = {}) =>
    render(
      <RangeInput
        onCommit={vi.fn()}
        minYear={GAME_CONFIG.MIN_YEAR}
        maxYear={GAME_CONFIG.MAX_YEAR}
        {...overrides}
      />,
    );

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("Default State", () => {
    it("defaults to full timeline range (3000 BC - 2025 AD)", () => {
      renderRangeInput();

      // Should display default years in inputs
      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      // Default start is 3000 BC, end is 2025 AD
      expect(startInput).toHaveValue("3000");
      expect(endInput).toHaveValue(String(new Date().getFullYear()));
    });

    it("disables submit button until range is modified", () => {
      renderRangeInput();

      const commitButton = screen.getByRole("button", { name: /submit range/i });
      expect(commitButton).toBeDisabled();
    });

    it("shows width error when range exceeds maximum", () => {
      renderRangeInput();
      // Default range spans full timeline which exceeds max, so error should be visible
      const defaultWidth = GAME_CONFIG.MAX_YEAR - GAME_CONFIG.MIN_YEAR + 1;
      expect(screen.getByText(/exceeds limit/i)).toBeInTheDocument();
      // New format shows formatted width and max value: "X of 250 years"
      expect(
        screen.getByText(
          new RegExp(
            `${defaultWidth.toLocaleString()}.*of.*${SCORING_CONSTANTS.W_MAX.toLocaleString()}.*years`,
          ),
        ),
      ).toBeInTheDocument();
    });
  });

  describe("BC/AD Era Toggles", () => {
    it("renders era toggles for both start and end years", () => {
      renderRangeInput();

      // Initially both should be BC for start (3000 BC) and AD for end (2025 AD)
      expect(screen.getByTestId("era-toggle-BC")).toBeInTheDocument();
      expect(screen.getByTestId("era-toggle-AD")).toBeInTheDocument();
    });

    it("toggles era correctly when within bounds", () => {
      renderRangeInput();

      const commitButton = screen.getByRole("button", { name: /submit range/i });
      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      expect(commitButton).toBeDisabled();

      // Set to a valid narrow range: 1900-1950 AD (51 years)
      // Toggle start to AD first
      const startAdToggle = screen.getByTestId("toggle-ad-BC");
      fireEvent.click(startAdToggle);

      fireEvent.change(startInput, { target: { value: "1900" } });
      fireEvent.blur(startInput);

      fireEvent.change(endInput, { target: { value: "1950" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // After changing to valid narrow range, button should be enabled
      expect(commitButton).toBeEnabled();

      // Toggle start from AD back to BC - this creates invalid range (1900 BC is before 1950 AD but too wide)
      // Both toggles now show AD, so both have toggle-bc-AD buttons - get the first one (start)
      const bcButtons = screen.getAllByTestId("toggle-bc-AD");
      fireEvent.click(bcButtons[0]); // Click the start toggle's BC button

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Button should be disabled (range now too wide: 1900 BC to 1950 AD = 3851 years)
      expect(commitButton).toBeDisabled();
    });
  });

  describe("Year Input", () => {
    it("accepts positive year values", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);

      // Toggle to AD and change input
      fireEvent.click(screen.getAllByText("AD")[0]);
      fireEvent.change(startInput, { target: { value: "1900" } });
      fireEvent.blur(startInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Input should accept and display the value
      expect(startInput).toHaveValue("1900");
    });

    it("enables submit after modifying year input", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      // Initial state: button should be disabled (range not modified)
      const commitButton = screen.getByRole("button", { name: /submit range/i });
      expect(commitButton).toBeDisabled();

      // Change start to 1900 AD (toggle era first since default is BC)
      const startAdToggle = screen.getByTestId("toggle-ad-BC");
      fireEvent.click(startAdToggle); // Toggle start year from BC to AD
      fireEvent.change(startInput, { target: { value: "1900" } });
      fireEvent.blur(startInput);

      // Change end to 1950 AD (already AD by default)
      fireEvent.change(endInput, { target: { value: "1950" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // After modifying to valid range (51 years), button should be enabled
      expect(commitButton).toBeEnabled();
    });
  });

  describe("Controlled Mode", () => {
    const ControlledWrapper = () => {
      const [range, setRange] = React.useState<[number, number]>([
        GAME_CONFIG.MIN_YEAR,
        GAME_CONFIG.MAX_YEAR,
      ]);

      return (
        <RangeInput
          onCommit={vi.fn()}
          minYear={GAME_CONFIG.MIN_YEAR}
          maxYear={GAME_CONFIG.MAX_YEAR}
          value={range}
          onChange={setRange}
        />
      );
    };

    it("allows editing without resetting to defaults", async () => {
      render(<ControlledWrapper />);

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      // Toggle start to AD so a modern year is valid
      const startAdToggle = screen.getByTestId("toggle-ad-BC");
      fireEvent.click(startAdToggle);

      fireEvent.change(startInput, { target: { value: "1900" } });
      fireEvent.blur(startInput);

      fireEvent.change(endInput, { target: { value: "1950" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(startInput).toHaveValue("1900");
      expect(endInput).toHaveValue("1950");

      const commitButton = screen.getByRole("button", { name: /submit range/i });
      expect(commitButton).toBeEnabled();
    });
  });

  describe("Range Validation", () => {
    it("prevents committing when the range exceeds 250 years", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      // Set to range > 250 years within bounds (e.g., 1700 BC - 100 BC = 1601 years)
      // Start defaults to BC, so just change the values
      fireEvent.change(startInput, { target: { value: "1700" } });
      fireEvent.blur(startInput);

      fireEvent.change(endInput, { target: { value: "100" } });
      // Toggle end to BC to get BC-BC range
      fireEvent.click(screen.getByTestId("toggle-bc-AD"));
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Button should be disabled when range exceeds 250 years
      const commitButton = screen.getByRole("button", { name: /submit range/i });
      expect(commitButton).toBeDisabled();
    });
  });

  describe("Validation Error Messages", () => {
    it("shows error message when start year is out of valid range", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);

      // Enter a year way outside the valid range (e.g., 5000 BC when max is 3000 BC)
      fireEvent.change(startInput, { target: { value: "5000" } });
      fireEvent.blur(startInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should show error message with valid range
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/valid range/i)).toBeInTheDocument();
    });

    it("shows error message when end year is out of valid range", () => {
      renderRangeInput();

      const endInput = screen.getByLabelText(/to year/i);

      // Enter a year in the future (e.g., 3000 AD when max is 2025 AD)
      fireEvent.change(endInput, { target: { value: "3000" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should show error message with valid range
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/valid range/i)).toBeInTheDocument();
    });

    it("shows error message for invalid input (non-numeric)", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);

      // Enter non-numeric value
      fireEvent.change(startInput, { target: { value: "abc" } });
      fireEvent.blur(startInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should show error message
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/enter a valid year/i)).toBeInTheDocument();
    });

    it("clears error message when valid input is entered", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);

      // First, create an error
      fireEvent.change(startInput, { target: { value: "5000" } });
      fireEvent.blur(startInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Error should be visible
      expect(screen.getByRole("alert")).toBeInTheDocument();

      // Start typing - error should clear
      fireEvent.change(startInput, { target: { value: "1" } });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Error should be gone (cleared on change)
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sets aria-invalid attribute on invalid input", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);

      // Enter invalid value
      fireEvent.change(startInput, { target: { value: "5000" } });
      fireEvent.blur(startInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // aria-invalid should be true
      expect(startInput).toHaveAttribute("aria-invalid", "true");
    });

    it("preserves invalid input so user sees what they typed", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);

      // Enter out-of-range value
      fireEvent.change(startInput, { target: { value: "5000" } });
      fireEvent.blur(startInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Input should still show 5000, not reset to previous value
      expect(startInput).toHaveValue("5000");
    });
  });

  describe("Commit Functionality", () => {
    it("commits the current range and resets state", () => {
      const handleCommit = vi.fn();
      renderRangeInput({ onCommit: handleCommit });

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);
      const commitButton = screen.getByRole("button", { name: /submit range/i });

      // Initially button is disabled (default range, not modified)
      expect(commitButton).toBeDisabled();

      // Set valid range: 1900-1950 AD (51 years)
      // Toggle start to AD first (default is BC)
      const startAdToggle = screen.getByTestId("toggle-ad-BC");
      fireEvent.click(startAdToggle);

      fireEvent.change(startInput, { target: { value: "1900" } });
      fireEvent.blur(startInput);

      fireEvent.change(endInput, { target: { value: "1950" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // After modification, button should be enabled
      expect(commitButton).toBeEnabled();

      // Click commit
      act(() => {
        fireEvent.click(commitButton);
      });

      act(() => {
        vi.runOnlyPendingTimers();
      });

      // Should have called the handler
      expect(handleCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          start: 1900,
          end: 1950,
        }),
      );

      // After commit, advance timers for state updates
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should reset to disabled state (range reset to default, hasBeenModified = false)
      expect(commitButton).toBeDisabled();
    });

    it("passes hintsUsed to commit handler", () => {
      const handleCommit = vi.fn();
      renderRangeInput({ onCommit: handleCommit, hintsUsed: 2 });

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      // Set valid narrow range (1900-1920 AD = 21 years)
      // Toggle start to AD first
      const startAdToggle = screen.getByTestId("toggle-ad-BC");
      fireEvent.click(startAdToggle);
      fireEvent.change(startInput, { target: { value: "1900" } });
      fireEvent.blur(startInput);

      fireEvent.change(endInput, { target: { value: "1920" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const commitButton = screen.getByRole("button", { name: /submit range/i });

      // After modification, button should be enabled
      expect(commitButton).toBeEnabled();

      act(() => {
        fireEvent.click(commitButton);
      });

      act(() => {
        vi.runOnlyPendingTimers();
      });

      expect(handleCommit).toHaveBeenCalledWith(expect.objectContaining({ hintsUsed: 2 }));
    });
  });
});
