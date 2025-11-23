import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameProgress } from "../GameProgress";

describe("GameProgress Component", () => {
  describe("Guesses Remaining Label", () => {
    it("renders the 'Guesses Remaining:' label text", () => {
      render(<GameProgress guessCount={0} />);

      expect(screen.getByText("Guesses Remaining:")).toBeTruthy();
    });

    it("has correct styling on the label", () => {
      render(<GameProgress guessCount={0} />);

      const label = screen.getByText("Guesses Remaining:");
      expect(label.className).toContain("text-sm");
      expect(label.className).toContain("font-medium");
      expect(label.className).toContain("text-muted-foreground");
      expect(label.className).toContain("mr-2");
    });

    it("renders correct aria-label with remaining count", () => {
      render(<GameProgress guessCount={2} totalHints={6} />);

      const progressContainer = screen.getByLabelText("Guesses remaining: 4");
      expect(progressContainer).toBeTruthy();
    });

    it("updates aria-label when guesses change", () => {
      const { rerender } = render(<GameProgress guessCount={1} totalHints={6} />);

      expect(screen.getByLabelText("Guesses remaining: 5")).toBeTruthy();

      rerender(<GameProgress guessCount={3} totalHints={6} />);

      expect(screen.getByLabelText("Guesses remaining: 3")).toBeTruthy();
    });

    it("shows correct remaining count when all guesses used", () => {
      render(<GameProgress guessCount={6} totalHints={6} />);

      expect(screen.getByLabelText("Guesses remaining: 0")).toBeTruthy();
    });
  });

  describe("Progress Bubbles", () => {
    it("renders correct number of bubbles based on totalHints", () => {
      render(<GameProgress guessCount={0} totalHints={6} />);

      const bubbles = screen
        .getAllByRole("generic")
        .filter((el) => el.className.includes("rounded-full"));
      expect(bubbles).toHaveLength(6); // 6 remaining guesses
    });

    it("shows dots for remaining guesses only", () => {
      render(<GameProgress guessCount={2} />);

      const filledBubbles = screen
        .getAllByRole("generic")
        .filter(
          (el) => el.className.includes("rounded-full") && el.className.includes("bg-primary"),
        );
      expect(filledBubbles).toHaveLength(4); // 6 - 2 = 4 remaining
    });

    it("shows fewer dots as guesses are used", () => {
      render(<GameProgress guessCount={4} />);

      const filledBubbles = screen
        .getAllByRole("generic")
        .filter(
          (el) => el.className.includes("rounded-full") && el.className.includes("bg-primary"),
        );
      expect(filledBubbles).toHaveLength(2); // 6 - 4 = 2 remaining
    });

    it("shows 'None' when no guesses remain", () => {
      render(<GameProgress guessCount={6} />);

      // No bubbles should be present
      const bubbles = screen
        .queryAllByRole("generic")
        .filter((el) => el.className.includes("rounded-full"));
      expect(bubbles).toHaveLength(0);

      // Should show "None" text
      expect(screen.getByText("None")).toBeTruthy();
    });
  });

  describe("Container Styling", () => {
    it("applies custom className when provided", () => {
      render(<GameProgress guessCount={0} className="custom-class" />);

      const container = screen.getByText("Guesses Remaining:").parentElement;
      expect(container?.className).toContain("custom-class");
    });

    it("has correct flex layout classes", () => {
      render(<GameProgress guessCount={0} />);

      const container = screen.getByText("Guesses Remaining:").parentElement;
      expect(container?.className).toContain("flex");
      expect(container?.className).toContain("justify-start");
      expect(container?.className).toContain("items-center");
    });
  });
});
