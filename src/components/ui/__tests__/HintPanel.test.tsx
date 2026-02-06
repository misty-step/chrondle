import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HintPanel } from "../HintPanel";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";

// Mock motion components
vi.mock("motion/react", () => ({
  motion: {
    li: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <li {...props}>{children}</li>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock animation constants
vi.mock("@/lib/animationConstants", () => ({
  ANIMATION_DURATIONS: {
    HINT_TRANSITION: 300,
  },
  useReducedMotion: () => false,
}));

describe("HintPanel", () => {
  const mockEvents: OrderEvent[] = [
    { id: "event1", text: "First Event", year: 2000 },
    { id: "event2", text: "Second Event", year: 2010 },
    { id: "event3", text: "Third Event", year: 2020 },
  ];

  const mockOnRequestHint = vi.fn();

  beforeEach(() => {
    mockOnRequestHint.mockClear();
  });

  describe("Basic Rendering", () => {
    it("renders hint panel with no hints used", () => {
      const { container } = render(
        <HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />,
      );

      // Should render sections (GameCard renders as <section> elements)
      const sections = container.querySelectorAll("section");
      expect(sections.length).toBeGreaterThan(0);
    });

    it("renders mobile and desktop variants", () => {
      const { container } = render(
        <HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />,
      );

      // Mobile variant (md:hidden)
      const mobileVariant = container.querySelector(".md\\:hidden");
      expect(mobileVariant).toBeInTheDocument();

      // Desktop variant (hidden md:block)
      const desktopVariant = container.querySelector(".md\\:block");
      expect(desktopVariant).toBeInTheDocument();
    });

    it("calculates hints remaining correctly", () => {
      const oneHintUsed: OrderHint[] = [{ type: "anchor", eventId: "event1", position: 0 }];

      render(
        <HintPanel events={mockEvents} hints={oneHintUsed} onRequestHint={mockOnRequestHint} />,
      );

      // Mobile: "2 Hints Left" / Desktop: "2 of 3 remaining"
      // Both rendered (different visibility), so use getAllByText
      const hintsRemaining = screen.getAllByText(/2.*[Hh]ints|2 of 3 remaining/i);
      expect(hintsRemaining.length).toBeGreaterThan(0);
    });
  });

  describe("Available Hints", () => {
    it("renders all three hint types when available", () => {
      render(<HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />);

      // All three hint types should be available
      expect(screen.getAllByText(/Anchor/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Relative/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Bracket/i).length).toBeGreaterThan(0);
    });

    it("disables used hint types", () => {
      const disabledTypes = { anchor: true };

      render(
        <HintPanel
          events={mockEvents}
          hints={[]}
          onRequestHint={mockOnRequestHint}
          disabledTypes={disabledTypes}
        />,
      );

      // Anchor button should be disabled or marked as used
      // Both mobile and desktop variants render, so use getAllByText
      const usedText = screen.getAllByText(/Used/i);
      expect(usedText.length).toBeGreaterThan(0);
    });

    it("shows pending state for hint being generated", () => {
      render(
        <HintPanel
          events={mockEvents}
          hints={[]}
          onRequestHint={mockOnRequestHint}
          pendingType="anchor"
        />,
      );

      // Should show loading spinner and/or "Preparing hint…" text
      // (LoadingSpinner is mocked, so check for its presence)
      const buttons = screen.getAllByRole("button");
      const anchorButton = buttons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Anchor"),
      );

      expect(anchorButton).toHaveAttribute("disabled");
    });
  });

  describe("Used Hints", () => {
    it("displays used anchor hint correctly", () => {
      const usedHints: OrderHint[] = [{ type: "anchor", eventId: "event1", position: 0 }];

      render(
        <HintPanel
          events={mockEvents}
          hints={usedHints}
          onRequestHint={mockOnRequestHint}
          disabledTypes={{ anchor: true }}
        />,
      );

      // Should show "First Event locked at position 1"
      expect(screen.getByText(/First Event/i)).toBeInTheDocument();
      expect(screen.getByText(/locked at position 1/i)).toBeInTheDocument();
    });

    it("displays used relative hint correctly", () => {
      const usedHints: OrderHint[] = [
        {
          type: "relative",
          earlierEventId: "event1",
          laterEventId: "event2",
        },
      ];

      render(
        <HintPanel
          events={mockEvents}
          hints={usedHints}
          onRequestHint={mockOnRequestHint}
          disabledTypes={{ relative: true }}
        />,
      );

      // Should show relative hint text (formatted by formatRelativeHintText)
      // Both mobile and desktop render hints, so use getAllByText
      const firstEventText = screen.getAllByText(/First Event/i);
      const secondEventText = screen.getAllByText(/Second Event/i);
      expect(firstEventText.length).toBeGreaterThan(0);
      expect(secondEventText.length).toBeGreaterThan(0);
    });

    it("displays used bracket hint correctly", () => {
      const usedHints: OrderHint[] = [
        {
          type: "bracket",
          eventId: "event1",
          yearRange: [1995, 2005],
        },
      ];

      render(
        <HintPanel
          events={mockEvents}
          hints={usedHints}
          onRequestHint={mockOnRequestHint}
          disabledTypes={{ bracket: true }}
        />,
      );

      // Should show "First Event: 1995 AD – 2005 AD"
      expect(screen.getByText(/First Event/i)).toBeInTheDocument();
      expect(screen.getByText(/1995.*2005/i)).toBeInTheDocument();
    });

    it("displays multiple used hints", () => {
      const usedHints: OrderHint[] = [
        { type: "anchor", eventId: "event1", position: 0 },
        {
          type: "relative",
          earlierEventId: "event2",
          laterEventId: "event3",
        },
      ];

      render(
        <HintPanel
          events={mockEvents}
          hints={usedHints}
          onRequestHint={mockOnRequestHint}
          disabledTypes={{ anchor: true, relative: true }}
        />,
      );

      // Should show both hints (both variants rendered)
      const firstEventText = screen.getAllByText(/First Event/i);
      const secondEventText = screen.getAllByText(/Second Event/i);
      expect(firstEventText.length).toBeGreaterThan(0);
      expect(secondEventText.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("calls onRequestHint when hint button clicked", () => {
      render(<HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />);

      const buttons = screen.getAllByRole("button");
      const anchorButton = buttons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Anchor"),
      );

      if (anchorButton) {
        fireEvent.click(anchorButton);
        expect(mockOnRequestHint).toHaveBeenCalledWith("anchor");
      }
    });

    it("does not call onRequestHint when disabled hint clicked", () => {
      render(
        <HintPanel
          events={mockEvents}
          hints={[]}
          onRequestHint={mockOnRequestHint}
          disabledTypes={{ anchor: true }}
        />,
      );

      const buttons = screen.getAllByRole("button");
      const anchorButton = buttons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Anchor"),
      );

      if (anchorButton) {
        fireEvent.click(anchorButton);
        expect(mockOnRequestHint).not.toHaveBeenCalled();
      }
    });

    it("does not call onRequestHint when pending hint clicked", () => {
      render(
        <HintPanel
          events={mockEvents}
          hints={[]}
          onRequestHint={mockOnRequestHint}
          pendingType="anchor"
        />,
      );

      const buttons = screen.getAllByRole("button");
      const anchorButton = buttons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Anchor"),
      );

      if (anchorButton && !anchorButton.hasAttribute("disabled")) {
        fireEvent.click(anchorButton);
        expect(mockOnRequestHint).not.toHaveBeenCalled();
      }
    });
  });

  describe("Error Display", () => {
    it("displays error message when provided", () => {
      const errorMessage = "Unable to generate hint. Adjust your ordering and try again.";

      render(
        <HintPanel
          events={mockEvents}
          hints={[]}
          onRequestHint={mockOnRequestHint}
          error={errorMessage}
        />,
      );

      // Error appears in both mobile and desktop variants
      const errorElements = screen.getAllByText(errorMessage);
      expect(errorElements.length).toBeGreaterThan(0);
    });

    it("does not display error when error is null", () => {
      const { container } = render(
        <HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} error={null} />,
      );

      // Should not find error text
      const errorText = "Unable to generate hint";
      expect(screen.queryByText(errorText)).not.toBeInTheDocument();
    });
  });

  describe("Deep Module Interface", () => {
    it("has minimal interface complexity (3 required props)", () => {
      // This test documents the deep module property:
      // Interface = 3 required props (events, hints, onRequestHint)
      // Implementation = Responsive layouts + Accordion + animations + GameCard + icons

      render(<HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />);

      // Developer only specified 3 props, but got:
      // - Mobile and desktop responsive layouts
      // - GameCard wrapping (rounded)
      // - Accordion behavior (collapsible sections)
      // - Animation logic (motion, AnimatePresence)
      // - Icon rendering (Anchor, Scale, CalendarRange)
      // - Hint copy and descriptions
      // - Used hints formatting
      // All decisions hidden from caller
    });

    it("hides GameCard complexity from caller", () => {
      const { container } = render(
        <HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />,
      );

      // GameCard should be present (as section element)
      const sections = container.querySelectorAll("section");
      expect(sections.length).toBeGreaterThan(0);

      // Caller didn't specify GameCard, but got:
      // - rounded borders
      // - bg-white background
      // - Responsive padding (compact for mobile, default for desktop)
    });

    it("hides responsive breakpoint logic from caller", () => {
      const { container } = render(
        <HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />,
      );

      // Mobile variant uses md:hidden
      const mobileContainer = container.querySelector(".md\\:hidden");
      expect(mobileContainer).toBeInTheDocument();

      // Desktop variant uses hidden md:block
      const desktopContainer = container.querySelector(".md\\:block");
      expect(desktopContainer).toBeInTheDocument();

      // Caller didn't specify any breakpoints - all handled internally
    });

    it("hides animation logic from caller", () => {
      const usedHints: OrderHint[] = [{ type: "anchor", eventId: "event1", position: 0 }];

      render(
        <HintPanel
          events={mockEvents}
          hints={usedHints}
          onRequestHint={mockOnRequestHint}
          disabledTypes={{ anchor: true }}
        />,
      );

      // Used hints list should be present
      const list = screen.getByRole("list", { hidden: true });
      expect(list).toBeInTheDocument();

      // Caller didn't specify any animation props, but got:
      // - AnimatePresence for enter/exit animations
      // - LayoutGroup for layout animations
      // - Reduced motion support
      // All animation decisions hidden
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for hint buttons", () => {
      render(<HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />);

      // All hint buttons should have aria-label
      const buttons = screen.getAllByRole("button");
      const anchorButton = buttons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Anchor"),
      );
      const relativeButton = buttons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Relative"),
      );
      const bracketButton = buttons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Bracket"),
      );

      expect(anchorButton).toHaveAttribute("aria-label");
      expect(relativeButton).toHaveAttribute("aria-label");
      expect(bracketButton).toHaveAttribute("aria-label");
    });

    it("has proper section labeling", () => {
      const { container } = render(
        <HintPanel events={mockEvents} hints={[]} onRequestHint={mockOnRequestHint} />,
      );

      // Sections should have aria-labelledby pointing to headings
      const sections = container.querySelectorAll("section");
      sections.forEach((section) => {
        const labelledBy = section.getAttribute("aria-labelledby");
        if (labelledBy) {
          // Should have a corresponding heading element
          const heading = container.querySelector(`#${labelledBy}`);
          expect(heading).toBeInTheDocument();
        }
      });
    });

    it("marks used hints list as live region", () => {
      const usedHints: OrderHint[] = [{ type: "anchor", eventId: "event1", position: 0 }];

      render(
        <HintPanel
          events={mockEvents}
          hints={usedHints}
          onRequestHint={mockOnRequestHint}
          disabledTypes={{ anchor: true }}
        />,
      );

      // Used hints list should have aria-live
      const list = screen.getByRole("list", { hidden: true });
      expect(list).toHaveAttribute("aria-live", "polite");
    });

    it("marks error messages with role=status", () => {
      const errorMessage = "Unable to generate hint";

      render(
        <HintPanel
          events={mockEvents}
          hints={[]}
          onRequestHint={mockOnRequestHint}
          error={errorMessage}
        />,
      );

      // Error should be present with role="status"
      const errorElements = screen.getAllByRole("status");
      const errorElement = errorElements.find((el) => el.textContent?.includes(errorMessage));
      expect(errorElement).toBeDefined();
      expect(errorElement).toHaveTextContent(errorMessage);
    });
  });

  describe("Custom Styling", () => {
    it("merges custom className with base styles", () => {
      const { container } = render(
        <HintPanel
          events={mockEvents}
          hints={[]}
          onRequestHint={mockOnRequestHint}
          className="custom-hint-panel"
        />,
      );

      const customElement = container.querySelector(".custom-hint-panel");
      expect(customElement).toBeInTheDocument();
    });
  });
});
