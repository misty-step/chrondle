import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GameCard } from "../GameCard";

describe("GameCard", () => {
  describe("Basic Rendering", () => {
    it("renders children content", () => {
      render(<GameCard>Test content</GameCard>);

      expect(screen.getByText("Test content")).toBeInTheDocument();
    });

    it("renders as section element by default", () => {
      const { container } = render(<GameCard>Content</GameCard>);

      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
      expect(section).toHaveTextContent("Content");
    });

    it("renders as div when specified", () => {
      const { container } = render(<GameCard as="div">Content</GameCard>);

      const div = container.querySelector("div");
      expect(div).toBeInTheDocument();
      expect(div).toHaveTextContent("Content");

      const section = container.querySelector("section");
      expect(section).not.toBeInTheDocument();
    });

    it("renders as article when specified", () => {
      const { container } = render(<GameCard as="article">Content</GameCard>);

      const article = container.querySelector("article");
      expect(article).toBeInTheDocument();
      expect(article).toHaveTextContent("Content");
    });
  });

  describe("Core Styling", () => {
    it("applies core surface styling by default", () => {
      const { container } = render(<GameCard>Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      // Angular corners (not rounded-xl/lg)
      expect(card.className).toContain("rounded");
      expect(card.className).not.toContain("rounded-sm");

      // Solid background (not translucent)
      expect(card.className).toContain("bg-white");

      // Border system
      expect(card.className).toContain("border");
      expect(card.className).toContain("border-[#d3d6da]");
    });

    it("does not contain legacy shadow-warm class", () => {
      const { container } = render(<GameCard>Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).not.toContain("shadow-warm");
    });

    it("does not contain legacy rounded-xl class", () => {
      const { container } = render(<GameCard>Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).not.toContain("rounded-xl");
      expect(card.className).not.toContain("rounded-lg");
      expect(card.className).not.toContain("rounded-full");
    });

    it("does not use translucent backgrounds", () => {
      const { container } = render(<GameCard>Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      // Should not have opacity modifiers like /90 or /80
      expect(card.className).not.toContain("bg-card/90");
      expect(card.className).not.toContain("bg-background/80");
    });
  });

  describe("Variant System", () => {
    it("applies default variant styling", () => {
      const { container } = render(<GameCard variant="default">Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain("bg-white");
      expect(card.className).toContain("border-[#d3d6da]");
    });

    it("applies success variant styling", () => {
      const { container } = render(<GameCard variant="success">Correct!</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain("bg-feedback-success/5");
      expect(card.className).toContain("border-feedback-success/20");
    });

    it("applies muted variant styling", () => {
      const { container } = render(<GameCard variant="muted">Comparison</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain("bg-muted/30");
      expect(card.className).toContain("border-border");
    });

    it("switches variants correctly", () => {
      const { container, rerender } = render(<GameCard variant="default">Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain("bg-white");

      rerender(<GameCard variant="success">Content</GameCard>);
      expect(card.className).toContain("bg-feedback-success/5");

      rerender(<GameCard variant="muted">Content</GameCard>);
      expect(card.className).toContain("bg-muted/30");
    });
  });

  describe("Padding System (Responsive)", () => {
    it("applies default padding with responsive enhancement", () => {
      const { container } = render(<GameCard padding="default">Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain("p-4");
      expect(card.className).toContain("md:p-6");
    });

    it("applies compact padding for mobile-optimized layouts", () => {
      const { container } = render(<GameCard padding="compact">Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain("p-3");
      expect(card.className).toContain("md:p-4");
    });

    it("applies spacious padding for emphasis", () => {
      const { container } = render(<GameCard padding="spacious">Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain("p-6");
      expect(card.className).toContain("md:p-8");
    });

    it("switches padding correctly", () => {
      const { container, rerender } = render(<GameCard padding="compact">Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain("p-3");

      rerender(<GameCard padding="default">Content</GameCard>);
      expect(card.className).toContain("p-4");

      rerender(<GameCard padding="spacious">Content</GameCard>);
      expect(card.className).toContain("p-6");
    });
  });

  describe("Custom Styling", () => {
    it("merges custom className with base styles", () => {
      const { container } = render(<GameCard className="custom-class">Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      // Custom class should be present
      expect(card.className).toContain("custom-class");

      // Base styles should still be present
      expect(card.className).toContain("rounded");
      expect(card.className).not.toContain("shadow-hard");
    });

    it("allows overriding styles with custom className", () => {
      const { container } = render(<GameCard className="p-10">Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      // Custom padding should be present (cn utility handles precedence)
      expect(card.className).toContain("p-10");
    });
  });

  describe("Deep Module Interface", () => {
    it("has minimal interface complexity (variant + padding)", () => {
      // This test documents the deep module property:
      // Interface = 2 main props (variant, padding)
      // Implementation = 15+ styling decisions hidden internally

      render(
        <GameCard variant="success" padding="compact">
          Content
        </GameCard>,
      );

      // Developer only specified 2 props, but got:
      // - Angular aesthetic (rounded)
      // - Solid background (bg-white overridden by success)
      // - Border treatment (border + color)
      // - Responsive padding (p-3 md:p-4)
      // - Success semantic coloring
      // All decisions hidden from caller
    });

    it("prevents accidental token invention (information hiding)", () => {
      // Before GameCard: developers invented shadow-warm, rounded-xl, bg-card/90
      // After GameCard: these decisions are internal, developers can't invent tokens

      const { container } = render(<GameCard>Content</GameCard>);
      const card = container.firstChild as HTMLElement;

      // Guarantees correct tokens are used
      expect(card.className).not.toContain("shadow-hard");
      expect(card.className).toContain("rounded");
      expect(card.className).toContain("bg-white");

      // Prevents incorrect tokens from being used
      expect(card.className).not.toContain("shadow-warm");
      expect(card.className).not.toContain("rounded-xl");
      expect(card.className).not.toContain("bg-card/90");
    });
  });

  describe("Composite Usage Patterns", () => {
    it("supports nesting complex content", () => {
      render(
        <GameCard variant="success" padding="spacious">
          <h2>Title</h2>
          <p>Description with nested content</p>
          <div>
            <button>Action</button>
          </div>
        </GameCard>,
      );

      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description with nested content")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    });

    it("supports multiple variants in same component tree", () => {
      render(
        <div>
          <GameCard variant="default">Default card</GameCard>
          <GameCard variant="success">Success card</GameCard>
          <GameCard variant="muted">Muted card</GameCard>
        </div>,
      );

      expect(screen.getByText("Default card")).toBeInTheDocument();
      expect(screen.getByText("Success card")).toBeInTheDocument();
      expect(screen.getByText("Muted card")).toBeInTheDocument();
    });
  });
});
