import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GameModeLayout } from "../GameModeLayout";

// Mock lazy components
vi.mock("../LazyComponents", () => ({
  AppHeader: ({
    mode,
    puzzleNumber,
    currentStreak,
    isDebugMode,
    isArchive,
  }: {
    mode: "classic" | "order";
    puzzleNumber?: number;
    currentStreak?: number;
    isDebugMode?: boolean;
    isArchive?: boolean;
  }) => (
    <header
      data-testid="app-header"
      data-mode={mode}
      data-puzzle={puzzleNumber}
      data-streak={currentStreak}
      data-is-debug-mode={isDebugMode}
      data-is-archive={isArchive}
    >
      AppHeader
    </header>
  ),
}));

vi.mock("../Footer", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock("../GameErrorBoundary", () => ({
  GameErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

describe("GameModeLayout", () => {
  describe("Basic Structure", () => {
    it("renders children content", () => {
      render(
        <GameModeLayout mode="order">
          <div data-testid="game-content">Game Content</div>
        </GameModeLayout>,
      );

      expect(screen.getByTestId("game-content")).toBeInTheDocument();
    });

    it("renders as order mode", () => {
      render(
        <GameModeLayout mode="order">
          <div>Content</div>
        </GameModeLayout>,
      );

      const header = screen.getByTestId("app-header");
      expect(header.getAttribute("data-mode")).toBe("order");
    });

    it("renders as classic mode", () => {
      render(
        <GameModeLayout mode="classic">
          <div>Content</div>
        </GameModeLayout>,
      );

      const header = screen.getByTestId("app-header");
      expect(header.getAttribute("data-mode")).toBe("classic");
    });

    it("wraps content in GameErrorBoundary", () => {
      render(
        <GameModeLayout mode="order">
          <div>Content</div>
        </GameModeLayout>,
      );

      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    });
  });

  describe("Footer Guarantee (Architectural)", () => {
    it("always renders Footer for order mode", () => {
      render(
        <GameModeLayout mode="order">
          <div>Content</div>
        </GameModeLayout>,
      );

      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("always renders Footer for classic mode", () => {
      render(
        <GameModeLayout mode="classic">
          <div>Content</div>
        </GameModeLayout>,
      );

      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("renders Footer even with minimal props", () => {
      render(
        <GameModeLayout mode="order">
          <div>Minimal</div>
        </GameModeLayout>,
      );

      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("renders Footer even with all optional features provided", () => {
      render(
        <GameModeLayout
          mode="classic"
          modals={<div>Modal</div>}
          debugContent={<div>Debug</div>}
          isDebugMode={true}
        >
          <div>Content</div>
        </GameModeLayout>,
      );

      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });
  });

  describe("Classic Mode Features", () => {
    it("renders modals when provided", () => {
      render(
        <GameModeLayout mode="classic" modals={<div data-testid="modal">Achievement Modal</div>}>
          Content
        </GameModeLayout>,
      );

      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });

    it("does not render modals when not provided", () => {
      render(<GameModeLayout mode="classic">Content</GameModeLayout>);

      expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
    });

    it("renders debug content when isDebugMode=true", () => {
      render(
        <GameModeLayout
          mode="classic"
          isDebugMode={true}
          debugContent={<div data-testid="debug">Analytics Dashboard</div>}
        >
          Content
        </GameModeLayout>,
      );

      expect(screen.getByTestId("debug")).toBeInTheDocument();
    });

    it("does not render debug content when isDebugMode=false", () => {
      render(
        <GameModeLayout
          mode="classic"
          isDebugMode={false}
          debugContent={<div data-testid="debug">Analytics Dashboard</div>}
        >
          Content
        </GameModeLayout>,
      );

      expect(screen.queryByTestId("debug")).not.toBeInTheDocument();
    });

    it("does not render debug content when debugContent not provided", () => {
      render(
        <GameModeLayout mode="classic" isDebugMode={true}>
          Content
        </GameModeLayout>,
      );

      expect(screen.queryByTestId("debug")).not.toBeInTheDocument();
    });

    it("renders screen reader announcements when provided", () => {
      render(
        <GameModeLayout
          mode="classic"
          screenReaderAnnouncements={<div data-testid="announcer">Correct guess!</div>}
        >
          Content
        </GameModeLayout>,
      );

      expect(screen.getByTestId("announcer")).toBeInTheDocument();
    });

    it("does not render screen reader announcements when not provided", () => {
      render(<GameModeLayout mode="classic">Content</GameModeLayout>);

      expect(screen.queryByTestId("announcer")).not.toBeInTheDocument();
    });

    it("passes currentStreak to AppHeader when provided", () => {
      render(
        <GameModeLayout mode="classic" currentStreak={5} puzzleNumber={123}>
          Content
        </GameModeLayout>,
      );

      const header = screen.getByTestId("app-header");
      expect(header.getAttribute("data-streak")).toBe("5");
    });

    it("passes isDebugMode to AppHeader", () => {
      render(
        <GameModeLayout mode="classic" isDebugMode={true}>
          Content
        </GameModeLayout>,
      );

      const header = screen.getByTestId("app-header");
      expect(header.getAttribute("data-is-debug-mode")).toBe("true");
    });
  });

  describe("AppHeader Integration", () => {
    it("passes puzzleNumber to AppHeader", () => {
      render(
        <GameModeLayout mode="order" puzzleNumber={123}>
          Content
        </GameModeLayout>,
      );

      const header = screen.getByTestId("app-header");
      expect(header.getAttribute("data-puzzle")).toBe("123");
    });

    it("passes isArchive=false by default", () => {
      render(<GameModeLayout mode="order">Content</GameModeLayout>);

      const header = screen.getByTestId("app-header");
      expect(header.getAttribute("data-is-archive")).toBe("false");
    });

    it("passes isArchive=true when specified", () => {
      render(
        <GameModeLayout mode="order" isArchive={true}>
          Content
        </GameModeLayout>,
      );

      const header = screen.getByTestId("app-header");
      expect(header.getAttribute("data-is-archive")).toBe("true");
    });
  });

  describe("Cross-Mode Feature Availability", () => {
    it("allows Order Mode to use debug mode", () => {
      render(
        <GameModeLayout
          mode="order"
          isDebugMode={true}
          debugContent={<div data-testid="order-debug">Order Debug</div>}
        >
          Content
        </GameModeLayout>,
      );

      expect(screen.getByTestId("order-debug")).toBeInTheDocument();
    });

    it("allows Order Mode to use modals", () => {
      render(
        <GameModeLayout mode="order" modals={<div data-testid="order-modal">Order Modal</div>}>
          Content
        </GameModeLayout>,
      );

      expect(screen.getByTestId("order-modal")).toBeInTheDocument();
    });
  });

  describe("Hydration State", () => {
    it("renders with consistent structure without hydration classes", () => {
      const { container } = render(<GameModeLayout mode="order">Content</GameModeLayout>);

      // Component no longer uses hydration classes - CSS variables handle theme switching
      // Verify the core structure is present
      expect(container.querySelector(".bg-background")).toBeInTheDocument();
      expect(container.querySelector(".flex-col")).toBeInTheDocument();
    });

    it("applies background and foreground classes", () => {
      const { container } = render(<GameModeLayout mode="order">Content</GameModeLayout>);

      // The layout div (inside error boundary mock) should have theme-aware classes
      const layoutDiv = container.querySelector(".min-h-screen");
      expect(layoutDiv).toBeInTheDocument();
      expect(layoutDiv?.className).toContain("bg-background");
      expect(layoutDiv?.className).toContain("text-foreground");
    });
  });

  describe("Deep Module Interface", () => {
    it("has minimal interface complexity (2 required props)", () => {
      // This test documents the deep module property:
      // Interface = 2 required props (mode, children)
      // Implementation = Page structure + optional features + Suspense + z-index

      render(
        <GameModeLayout mode="order">
          <div>Content</div>
        </GameModeLayout>,
      );

      // Developer only specified 2 props, but got:
      // - Page structure (header + main + footer)
      // - Error boundary
      // - Safe area insets
      // - Flex layout
      // - SSR/hydration handling
      // All decisions hidden from caller
    });

    it("hides Suspense boundary decisions from caller", () => {
      // Caller provides ReactNode, GameModeLayout wraps in Suspense
      render(
        <GameModeLayout
          mode="classic"
          debugContent={<div data-testid="debug">Debug</div>}
          isDebugMode={true}
        >
          Content
        </GameModeLayout>,
      );

      // Both features render (Suspense internal to GameModeLayout)
      expect(screen.getByTestId("debug")).toBeInTheDocument();
    });

    it("prevents footer omission architecturally", () => {
      // This is the key architectural guarantee:
      // You CANNOT create a GameModeLayout without a Footer
      // It's not a guideline—it's structurally impossible

      render(
        <GameModeLayout mode="order">
          <div>Content</div>
        </GameModeLayout>,
      );

      // Footer present - no way to opt out
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });
  });

  describe("Custom Styling", () => {
    it("merges custom className with base styles", () => {
      const { container } = render(
        <GameModeLayout mode="order" className="custom-layout">
          Content
        </GameModeLayout>,
      );

      const rootDiv = container.querySelector(".custom-layout");
      expect(rootDiv).toBeInTheDocument();

      // Base styles still present
      expect(rootDiv?.className).toContain("bg-background");
      expect(rootDiv?.className).toContain("text-foreground");
    });
  });

  describe("Safe Area Insets", () => {
    it("applies safe area padding to main element", () => {
      const { container } = render(<GameModeLayout mode="order">Content</GameModeLayout>);

      const main = container.querySelector("main");
      // React may reformat the calc expression, so check for key parts
      const paddingBottom = main?.style.paddingBottom || "";
      expect(paddingBottom).toContain("calc");
      expect(paddingBottom).toContain("24px");
      expect(paddingBottom).toContain("safe-area-inset-bottom");
    });
  });
});
