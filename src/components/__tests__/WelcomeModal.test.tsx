import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WelcomeModal, WELCOME_SEEN_KEY } from "../WelcomeModal";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Crown: function Crown() {
    return React.createElement("span", { "data-testid": "crown" }, "♛");
  },
  Calendar: function Calendar() {
    return React.createElement("span", { "data-testid": "calendar" }, "📅");
  },
  Target: function Target() {
    return React.createElement("span", { "data-testid": "target" }, "🎯");
  },
  Lightbulb: function Lightbulb() {
    return React.createElement("span", { "data-testid": "lightbulb" }, "💡");
  },
  XIcon: function XIcon() {
    return React.createElement("span", { "data-testid": "x-icon" }, "✕");
  },
}));

describe("WelcomeModal", () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    mockOnDismiss.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders modal when open is true", () => {
      render(<WelcomeModal open={true} onDismiss={mockOnDismiss} />);

      expect(screen.getByText("Test Your History Knowledge")).toBeInTheDocument();
    });

    it("does not render modal when open is false", () => {
      render(<WelcomeModal open={false} onDismiss={mockOnDismiss} />);

      expect(screen.queryByText("Test Your History Knowledge")).not.toBeInTheDocument();
    });

    it("renders the tagline", () => {
      render(<WelcomeModal open={true} onDismiss={mockOnDismiss} />);

      expect(
        screen.getByText(
          /Six clues\. One year\. Daily puzzles from ancient empires to pop culture\./,
        ),
      ).toBeInTheDocument();
    });

    it("renders game explanation bullet points", () => {
      render(<WelcomeModal open={true} onDismiss={mockOnDismiss} />);

      expect(screen.getByText("A new puzzle every day at midnight")).toBeInTheDocument();
      expect(
        screen.getByText("Reveal hints one by one to narrow down the year"),
      ).toBeInTheDocument();
      expect(screen.getByText("Fewer hints used means a higher score")).toBeInTheDocument();
    });

    it("renders Start Playing CTA button", () => {
      render(<WelcomeModal open={true} onDismiss={mockOnDismiss} />);

      expect(screen.getByRole("button", { name: /start playing/i })).toBeInTheDocument();
    });

    it("renders Crown icon in header", () => {
      render(<WelcomeModal open={true} onDismiss={mockOnDismiss} />);

      expect(screen.getByTestId("crown")).toBeInTheDocument();
    });
  });

  describe("Interaction", () => {
    it("calls onDismiss when Start Playing button is clicked", () => {
      render(<WelcomeModal open={true} onDismiss={mockOnDismiss} />);

      const startButton = screen.getByRole("button", { name: /start playing/i });
      fireEvent.click(startButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("Constants", () => {
    it("exports WELCOME_SEEN_KEY constant", () => {
      expect(WELCOME_SEEN_KEY).toBe("chrondle_seen_welcome");
    });
  });
});
