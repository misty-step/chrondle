import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { RangeInput } from "../RangeInput";
import { GAME_CONFIG } from "@/lib/constants";

// Mock EraToggle to simplify testing
vi.mock("@/components/kit/EraToggle", () => ({
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

// jsdom lays every element out at 0×0 - stub a fixed, non-zero track rect so
// the timeline bar's pointer-position math is deterministic.
function mockTrackRect() {
  vi.spyOn(HTMLDivElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 1000,
    width: 1000,
    top: 0,
    bottom: 40,
    height: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

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
    it("starts with empty exact-year fields, not a fake year", () => {
      renderRangeInput();

      // No range exists yet - regression guard for the old "0 AD - 0 AD"
      // default, a year that does not exist historically.
      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      expect(startInput).toHaveValue("");
      expect(endInput).toHaveValue("");
      expect(screen.getByText(/not set yet/i)).toBeInTheDocument();
    });

    it("teaches the one-shot mechanic before the first lock-in", () => {
      renderRangeInput({ isOneGuessMode: true });

      expect(screen.getByText(/one guess.*drag/i)).toBeInTheDocument();
    });

    it("disables submit button until range is modified", () => {
      renderRangeInput();

      const commitButton = screen.getByRole("button", { name: /submit range/i });
      expect(commitButton).toBeDisabled();
    });

    it("shows width error when range exceeds maximum after modification", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      // Default [0, 0] should NOT show error (1 year range)
      expect(screen.queryByText(/exceeds limit/i)).not.toBeInTheDocument();

      // Set to range > 250 years: 1000 BC - 100 AD = 1101 years
      fireEvent.change(startInput, { target: { value: "1000" } });
      // Toggle start to BC
      const bcButtons = screen.getAllByTestId("toggle-bc-AD");
      fireEvent.click(bcButtons[0]);
      fireEvent.blur(startInput);

      fireEvent.change(endInput, { target: { value: "100" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Now should show error
      expect(screen.getByText(/exceeds limit/i)).toBeInTheDocument();
    });

    it("uses the entered end year as both bounds when end year is entered first", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      fireEvent.change(endInput, { target: { value: "1950" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(startInput).toHaveValue("1950");
      expect(endInput).toHaveValue("1950");
      expect(screen.queryByText("0 AD", { exact: true })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /submit range/i })).toBeEnabled();
    });

    it("does not expand a first BC start edit against the unset sentinel", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      fireEvent.change(startInput, { target: { value: "500" } });
      fireEvent.click(screen.getAllByTestId("toggle-bc-AD")[0]);
      fireEvent.blur(startInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(startInput).toHaveValue("500");
      expect(endInput).toHaveValue("500");
      expect(screen.queryByText("0 AD", { exact: true })).not.toBeInTheDocument();
      expect(screen.queryByText(/exceeds limit/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /submit range/i })).toBeEnabled();
    });
  });

  describe("BC/AD Era Toggles", () => {
    it("renders era toggles for both start and end years", () => {
      renderRangeInput();

      // Initially both era choices default to AD, even though the year fields are empty.
      const adToggles = screen.getAllByTestId("era-toggle-AD");
      expect(adToggles).toHaveLength(2);
    });

    it("toggles era correctly when within bounds", () => {
      renderRangeInput();

      const commitButton = screen.getByRole("button", { name: /submit range/i });
      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      expect(commitButton).toBeDisabled();

      // Set to a valid narrow range: 1900-1950 AD (51 years)
      // Both default to AD now, so just change the values
      fireEvent.change(startInput, { target: { value: "1900" } });
      fireEvent.blur(startInput);

      fireEvent.change(endInput, { target: { value: "1950" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // After changing to valid narrow range, button should be enabled
      expect(commitButton).toBeEnabled();

      // Toggle start from AD to BC - this creates invalid range (1900 BC to 1950 AD = 3851 years)
      // Both toggles show AD, so both have toggle-bc-AD buttons - get the first one (start)
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
      const [range, setRange] = React.useState<[number, number]>([0, 0]);

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
      // Start defaults to AD, toggle to BC first
      fireEvent.change(startInput, { target: { value: "1700" } });
      const bcButtons = screen.getAllByTestId("toggle-bc-AD");
      fireEvent.click(bcButtons[0]);
      fireEvent.blur(startInput);

      fireEvent.change(endInput, { target: { value: "100" } });
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

      // Enter a year beyond the configured maximum.
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

  describe("Potential Score Preview", () => {
    const setRange = (startYear: string, endYear: string) => {
      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      fireEvent.change(startInput, { target: { value: startYear } });
      fireEvent.blur(startInput);
      fireEvent.change(endInput, { target: { value: endYear } });
      fireEvent.blur(endInput);

      // The preview swaps via AnimatePresence mode="wait"; let the exit and
      // enter animations finish under fake timers.
      act(() => {
        vi.advanceTimersByTime(1500);
      });
    };

    it("is hidden until the range is modified", () => {
      renderRangeInput();
      expect(screen.queryByText(/pts if right/i)).not.toBeInTheDocument();
    });

    it("shows the real quadratic-curve score for the current width", () => {
      renderRangeInput();

      // Width 50, 0 hints: quadratic curve pays 96 (the old linear UI math
      // would have claimed 80 - regression guard).
      setRange("1900", "1949");

      expect(screen.getByText(/pts if right/i)).toBeInTheDocument();
      expect(screen.getByText("96")).toBeInTheDocument();
    });

    it("shows the full 100 for a one-year range", () => {
      renderRangeInput();
      setRange("1969", "1969");
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("accounts for hints already taken", () => {
      renderRangeInput({ hintsUsed: 3 });

      // Width 50 at hint tier 3 (max 55): floor(55 × 0.9628…) = 52.
      setRange("1900", "1949");
      expect(screen.getByText("52")).toBeInTheDocument();
    });

    it("yields to the width error when the range is too wide", () => {
      renderRangeInput();
      setRange("1000", "1500");

      expect(screen.getByText(/exceeds limit/i)).toBeInTheDocument();
      expect(screen.queryByText(/pts if right/i)).not.toBeInTheDocument();
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

  describe("Timeline Bar (primary one-gesture path)", () => {
    beforeEach(() => {
      mockTrackRect();
    });

    it("drawing a range on the bar syncs the exact-year fallback fields and enables submit", () => {
      const handleCommit = vi.fn();
      renderRangeInput({ onCommit: handleCommit });

      const track = screen.getByTestId("timeline-range-track");
      const commitButton = screen.getByRole("button", { name: /submit range/i });
      expect(commitButton).toBeDisabled();

      // GAME_CONFIG span is MIN_YEAR..MAX_YEAR; drag from the midpoint out
      // to a later point to draw a real (non-trivial) range.
      fireEvent.pointerDown(track, { clientX: 500, pointerId: 1 });
      fireEvent.pointerMove(track, { clientX: 520, pointerId: 1 });
      fireEvent.pointerUp(track, { clientX: 520, pointerId: 1 });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // The fallback numeric fields should reflect exactly what was drawn -
      // both paths share the same underlying range state.
      const startInput = screen.getByLabelText(/from year/i) as HTMLInputElement;
      const endInput = screen.getByLabelText(/to year/i) as HTMLInputElement;
      expect(startInput.value).not.toBe("");
      expect(endInput.value).not.toBe("");
      expect(commitButton).toBeEnabled();

      act(() => {
        fireEvent.click(commitButton);
      });
      act(() => {
        vi.runOnlyPendingTimers();
      });

      expect(handleCommit).toHaveBeenCalled();
    });

    it("typing exact years syncs the bar's live value (bidirectional)", () => {
      renderRangeInput();

      const startInput = screen.getByLabelText(/from year/i);
      const endInput = screen.getByLabelText(/to year/i);

      fireEvent.change(startInput, { target: { value: "1900" } });
      fireEvent.blur(startInput);
      fireEvent.change(endInput, { target: { value: "1950" } });
      fireEvent.blur(endInput);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const startHandle = screen.getByTestId("timeline-handle-start");
      const endHandle = screen.getByTestId("timeline-handle-end");
      expect(startHandle).toHaveAttribute("aria-valuetext", "1900 AD");
      expect(endHandle).toHaveAttribute("aria-valuetext", "1950 AD");
    });

    it("renders no handles and a neutral placeholder before any range is drawn", () => {
      renderRangeInput();

      expect(screen.queryByTestId("timeline-handle-start")).not.toBeInTheDocument();
      expect(screen.queryByTestId("timeline-handle-end")).not.toBeInTheDocument();
      expect(screen.getByText(/not set yet/i)).toBeInTheDocument();
    });
  });
});
