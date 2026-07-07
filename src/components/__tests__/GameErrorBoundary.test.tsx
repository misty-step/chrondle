/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameErrorBoundary } from "../GameErrorBoundary";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function ThrowError({ error }: { error: Error }): React.ReactElement {
  throw error;
}

function renderBoundaryWithError() {
  const error = new Error("Test derivation error from deriveGameState");
  return render(
    <GameErrorBoundary>
      <ThrowError error={error} />
    </GameErrorBoundary>,
  );
}

describe("GameErrorBoundary", () => {
  it("exposes 'Go to Today's Puzzle' as a link without nesting a button inside it", () => {
    renderBoundaryWithError();

    const action = screen.getByRole("link", { name: /go to today's puzzle/i });
    expect(action).toBeInTheDocument();
    expect(action).toHaveAttribute("href", "/");

    // No button should be nested inside the link element
    expect(action.querySelector("button")).toBeNull();
  });

  it("does not render any button inside an anchor element", () => {
    const { container } = renderBoundaryWithError();

    const anchors = container.querySelectorAll("a");
    expect(anchors.length).toBeGreaterThan(0);

    for (const anchor of anchors) {
      expect(anchor.querySelector("button")).toBeNull();
    }
  });

  it("still renders the 'Try Again' recovery button", () => {
    renderBoundaryWithError();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
