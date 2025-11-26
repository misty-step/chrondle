import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { HintsDisplay } from "../HintsDisplay";
import { validateHintsDisplayProps } from "@/lib/propValidation";

const mockValidate = vi.mocked(validateHintsDisplayProps);

// Mock child components to isolate HintsDisplay testing
vi.mock("@/components/ui/Separator", () => ({
  Separator: () => <hr data-testid="separator" />,
}));

vi.mock("lucide-react", () => ({
  Check: () => <span data-testid="check-icon">✓</span>,
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLProps<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    p: ({ children, ...props }: React.HTMLProps<HTMLParagraphElement>) => (
      <p {...props}>{children}</p>
    ),
    span: ({ children, ...props }: React.HTMLProps<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

// Mock prop validation to track calls
vi.mock("@/lib/propValidation", () => ({
  validateHintsDisplayProps: vi.fn(),
}));

describe("HintsDisplay Component Interface", () => {
  const createDefaultProps = () => ({
    events: [
      "First lunar landing by Apollo 11",
      "Vietnam War escalation continues",
      "Woodstock music festival occurs",
      "ARPANET first connection established",
      "Nixon becomes president",
      "Beatles release Abbey Road album",
    ],
    guesses: [] as number[],
    targetYear: 1969,
    isGameComplete: false,
    error: null as string | null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Required Props", () => {
    it("renders past hints for each guess", () => {
      const props = createDefaultProps();
      props.guesses = [1970];

      render(<HintsDisplay {...props} />);

      expect(screen.getByText(props.events[0])).toBeTruthy();
    });

    it("validates props on render", () => {
      const props = createDefaultProps();
      render(<HintsDisplay {...props} />);

      expect(mockValidate).toHaveBeenCalledWith(props);
    });

    it("shows future hints only when game is complete", () => {
      const props = createDefaultProps();
      props.guesses = [1970, 1968, 1969];
      props.isGameComplete = true;

      render(<HintsDisplay {...props} />);

      // Past hints present
      expect(screen.getByText(props.events[0])).toBeTruthy();
      expect(screen.getByText(props.events[1])).toBeTruthy();
      expect(screen.getByText(props.events[2])).toBeTruthy();
      // Future hints section header appears
      expect(screen.getByText(/Additional hints/i)).toBeTruthy();
    });

    it("handles empty guesses array (no past hints)", () => {
      const props = createDefaultProps();
      props.guesses = [];

      render(<HintsDisplay {...props} />);

      // No past hint text visible
      expect(screen.queryByText(props.events[0])).toBe(null);
    });
  });

  describe("Optional Props", () => {
    it("accepts className prop", () => {
      const props = createDefaultProps();
      const { container } = render(<HintsDisplay {...props} className="custom-class" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("custom-class");
    });
  });

  describe("Loading and Error States", () => {
    it("shows loading state when events are empty", () => {
      const props = createDefaultProps();
      props.events = [];

      render(<HintsDisplay {...props} />);

      expect(screen.getByText("Preparing your puzzle...")).toBeTruthy();
    });

    it("shows error message when error is present", () => {
      const props = { ...createDefaultProps(), error: "Failed to load hints" };

      render(<HintsDisplay {...props} />);

      expect(screen.getByText(/Unable to Load Puzzle/i)).toBeTruthy();
    });

    it("prioritizes error over loading state", () => {
      const props = createDefaultProps();
      props.events = [];
      props.error = "Error occurred";

      render(<HintsDisplay {...props} />);

      expect(screen.getByText(/Unable to Load Puzzle/i)).toBeTruthy();
      expect(screen.queryByText("Loading puzzle events...")).toBe(null);
    });
  });

  describe("Hint Progression", () => {
    it("shows hints up to the number of guesses", () => {
      const props = createDefaultProps();
      props.guesses = [1970, 1968];

      render(<HintsDisplay {...props} />);

      // Should show hints 0 and 1
      expect(screen.getByText(props.events[0])).toBeTruthy();
      expect(screen.getByText(props.events[1])).toBeTruthy();
      // Should not show later hints
      expect(screen.queryByText(props.events[2])).toBe(null);
    });

    it("shows check marks for correct guesses", () => {
      const props = createDefaultProps();
      props.targetYear = 1969;
      props.guesses = [1970, 1969, 1971]; // Second guess is correct

      render(<HintsDisplay {...props} />);

      // Should have check mark only for the correct guess
      const checkIcons = screen.getAllByText("✓");
      expect(checkIcons.length).toBe(1);
    });

    it("formats guessed years correctly (BC)", () => {
      const props = createDefaultProps();
      props.targetYear = 0; // arbitrary
      props.guesses = [-776];

      render(<HintsDisplay {...props} />);

      // formatYear should convert -776 to "776 BC"
      const yearText = screen.getByText(/776 BC/);
      expect(yearText).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty events array", () => {
      const props = createDefaultProps();
      props.events = [];

      render(<HintsDisplay {...props} />);

      // Empty events show loading state with archival messaging
      expect(screen.getByText("Preparing your puzzle...")).toBeTruthy();
    });

    it("handles wrong number of events (len=2)", () => {
      const props = createDefaultProps();
      props.events = ["Event 1", "Event 2"]; // Only 2 events
      props.guesses = [1970];

      render(<HintsDisplay {...props} />);
      // Should show the first event as a past hint
      expect(screen.getByText("Event 1")).toBeTruthy();
    });

    it("handles more guesses than events", () => {
      const props = createDefaultProps();
      props.guesses = [1970, 1968, 1971, 1967, 1966, 1965, 1964];

      render(<HintsDisplay {...props} />);

      // Should not crash; missing hint text becomes [DATA MISSING]
      expect(screen.getAllByText(/Hint #/i).length).toBeGreaterThan(0);
    });
  });

  describe("Type Safety", () => {
    it("accepts all valid props", () => {
      const props = {
        events: ["E1", "E2", "E3", "E4", "E5", "E6"],
        guesses: [1970, 1969],
        targetYear: 1969,
        isGameComplete: true,
        error: null,
        className: "test-class",
      };

      // This should compile without TypeScript errors
      render(<HintsDisplay {...props} />);
      expect(screen.getByText("E2")).toBeTruthy();
    });

    it("validates prop types at runtime", () => {
      const invalidProps = {
        events: "not an array" as unknown as string[],
        guesses: "not an array" as unknown as number[],
        targetYear: "not a number" as unknown as number,
        error: 123 as unknown as string | null,
      };

      // Should still render but validation should catch these
      render(<HintsDisplay {...invalidProps} />);

      expect(mockValidate).toHaveBeenCalledWith(invalidProps);
    });
  });

  describe("Accessibility", () => {
    it("provides proximity aria-labels on past hints", () => {
      const props = createDefaultProps();
      props.targetYear = 1969;
      props.guesses = [1968];

      render(<HintsDisplay {...props} />);

      // Proximity indicator has a role and aria-label
      const emoji = screen.getByRole("img", {
        name: /Very close|Close|Warm|Cold|Very cold|Perfect/i,
      });
      expect(emoji).toBeTruthy();
    });
  });
});
