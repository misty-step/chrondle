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
