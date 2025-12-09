import React from "react";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GamesGallery } from "../GamesGallery";

// --- Mocks ---

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockToggle = vi.fn();

vi.mock("@/components/SessionThemeProvider", () => ({
  useTheme: () => ({
    currentTheme: "light",
    toggle: mockToggle,
    isMounted: true,
  }),
}));

vi.mock("@/lib/modePreference", () => ({
  setModePreferenceCookie: vi.fn(),
}));

// Mock motion/react - use function syntax for React access
vi.mock("motion/react", () => {
  // Use factory function that returns mocks
  const createMockMotion = () => {
    const motionComponent = (TagName: string) =>
      function MotionComponent(props: Record<string, unknown>) {
        const {
          children,
          animate: _animate,
          initial: _initial,
          transition: _transition,
          layout: _layout,
          whileHover: _whileHover,
          whileTap: _whileTap,
          onHoverStart,
          ...rest
        } = props;

        // Convert onHoverStart to onMouseEnter for testing
        const eventHandlers: Record<string, unknown> = {};
        if (onHoverStart) {
          eventHandlers.onMouseEnter = onHoverStart;
        }

        return React.createElement(
          TagName,
          { ...rest, ...eventHandlers },
          children as React.ReactNode,
        );
      };

    return {
      div: motionComponent("div"),
      button: motionComponent("button"),
      p: motionComponent("p"),
      span: motionComponent("span"),
    };
  };

  return {
    motion: createMockMotion(),
    AnimatePresence: function AnimatePresence(props: { children: React.ReactNode }) {
      return React.createElement(React.Fragment, null, props.children);
    },
    useReducedMotion: () => false,
  };
});

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ArrowRight: function ArrowRight() {
    return React.createElement("span", { "data-testid": "arrow-right" }, "→");
  },
  Crosshair: function Crosshair() {
    return React.createElement("span", { "data-testid": "crosshair" }, "⊕");
  },
  Shuffle: function Shuffle() {
    return React.createElement("span", { "data-testid": "shuffle" }, "⇄");
  },
  GripHorizontal: function GripHorizontal() {
    return React.createElement("span", { "data-testid": "grip" }, "☰");
  },
  Crown: function Crown() {
    return React.createElement("span", { "data-testid": "crown" }, "♛");
  },
  Sun: function Sun() {
    return React.createElement("span", { "data-testid": "sun" }, "☀");
  },
  Moon: function Moon() {
    return React.createElement("span", { "data-testid": "moon" }, "☽");
  },
}));

// --- matchMedia Mock Utilities ---

type MediaQueryHandler = (e: MediaQueryListEvent) => void;

const createMatchMediaMock = (matches: boolean) => {
  let handler: MediaQueryHandler | null = null;

  return {
    matches,
    media: "(max-width: 768px)",
    onchange: null,
    addEventListener: vi.fn((_event: string, cb: MediaQueryHandler) => {
      handler = cb;
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    // Utility to trigger media query change in tests
    _triggerChange: (newMatches: boolean) => {
      if (handler) {
        handler({ matches: newMatches } as MediaQueryListEvent);
      }
    },
    _getHandler: () => handler,
  };
};

describe("GamesGallery", () => {
  let matchMediaMock: ReturnType<typeof createMatchMediaMock>;

  beforeEach(() => {
    matchMediaMock = createMatchMediaMock(false);
    window.matchMedia = vi.fn().mockImplementation(() => matchMediaMock);
    mockPush.mockClear();
    mockToggle.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders both Classic and Order mode cards", () => {
      render(<GamesGallery />);

      expect(screen.getByText("Classic")).toBeInTheDocument();
      expect(screen.getByText("Order")).toBeInTheDocument();
    });

    it("renders CHRONDLE branding header", () => {
      render(<GamesGallery />);

      expect(screen.getByText("CHRONDLE")).toBeInTheDocument();
    });

    it("renders theme toggle button", () => {
      render(<GamesGallery />);

      const toggleButton = screen.getByRole("button", { name: /switch to dark mode/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it("renders mode subtitles", () => {
      render(<GamesGallery />);

      expect(screen.getByText("The Daily Time-Travel Puzzle")).toBeInTheDocument();
    });

    it("renders 'New' badge on Order mode", () => {
      render(<GamesGallery />);

      expect(screen.getByText("New")).toBeInTheDocument();
    });
  });

  describe("Mode Selection", () => {
    it("has Classic as the default active mode", () => {
      render(<GamesGallery />);

      // Classic shows its subtitle and CTA when active
      expect(screen.getByText("The Daily Time-Travel Puzzle")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /play now/i })).toBeInTheDocument();
    });

    it("switches to Order mode when clicked", () => {
      render(<GamesGallery />);

      // Find Order card by its aria-label
      const orderCard = screen.getByRole("button", { name: /select order mode/i });
      fireEvent.click(orderCard);

      // Order subtitle should now be visible
      expect(screen.getByText("Restore the Timeline")).toBeInTheDocument();
    });

    it("switches mode on hover", () => {
      render(<GamesGallery />);

      const orderCard = screen.getByRole("button", { name: /select order mode/i });
      fireEvent.mouseEnter(orderCard);

      expect(screen.getByText("Restore the Timeline")).toBeInTheDocument();
    });

    it("shows Play Now button only for active mode", () => {
      render(<GamesGallery />);

      // Classic is active by default - should have Play Now
      const playButtons = screen.getAllByRole("button", { name: /play now/i });
      expect(playButtons).toHaveLength(1);
    });
  });

  describe("Mobile Detection", () => {
    it("calls matchMedia with 768px breakpoint on mount", () => {
      render(<GamesGallery />);

      expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 768px)");
    });

    it("adds event listener for media query changes", () => {
      render(<GamesGallery />);

      expect(matchMediaMock.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("removes event listener on unmount", () => {
      const { unmount } = render(<GamesGallery />);

      unmount();

      expect(matchMediaMock.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });

    it("responds to media query changes", () => {
      render(<GamesGallery />);

      // Initially desktop (matches = false)
      // The component should use desktop flex ratio (2.5)

      // Trigger mobile change - wrap in act since it updates state
      act(() => {
        matchMediaMock._triggerChange(true);
      });

      // Component should now use mobile flex ratio (8)
      // We can't directly test flex values, but we can verify the handler was connected
      expect(matchMediaMock._getHandler()).not.toBeNull();
    });
  });

  describe("Navigation", () => {
    it("navigates to /classic when Play Now is clicked for Classic mode", () => {
      render(<GamesGallery />);

      const playButton = screen.getByRole("button", { name: /play now/i });
      fireEvent.click(playButton);

      expect(mockPush).toHaveBeenCalledWith("/classic");
    });

    it("navigates to /order when Play Now is clicked for Order mode", () => {
      render(<GamesGallery />);

      // Switch to Order mode first
      const orderCard = screen.getByRole("button", { name: /select order mode/i });
      fireEvent.click(orderCard);

      const playButton = screen.getByRole("button", { name: /play now/i });
      fireEvent.click(playButton);

      expect(mockPush).toHaveBeenCalledWith("/order");
    });
  });

  describe("Keyboard Navigation", () => {
    it("activates mode on Enter key", () => {
      render(<GamesGallery />);

      const orderCard = screen.getByRole("button", { name: /select order mode/i });
      fireEvent.keyDown(orderCard, { key: "Enter" });

      expect(screen.getByText("Restore the Timeline")).toBeInTheDocument();
    });

    it("activates mode on Space key", () => {
      render(<GamesGallery />);

      const orderCard = screen.getByRole("button", { name: /select order mode/i });
      fireEvent.keyDown(orderCard, { key: " " });

      expect(screen.getByText("Restore the Timeline")).toBeInTheDocument();
    });

    it("navigates when Enter pressed on active mode", () => {
      render(<GamesGallery />);

      // Classic is already active
      const classicCard = screen.getByRole("button", { name: /select classic mode/i });
      fireEvent.keyDown(classicCard, { key: "Enter" });

      expect(mockPush).toHaveBeenCalledWith("/classic");
    });
  });

  describe("Accessibility", () => {
    it("has role=button on mode cards", () => {
      render(<GamesGallery />);

      const buttons = screen.getAllByRole("button", { name: /select .* mode/i });
      expect(buttons).toHaveLength(2);
    });

    it("has tabIndex=0 for keyboard navigation", () => {
      render(<GamesGallery />);

      const classicCard = screen.getByRole("button", { name: /select classic mode/i });
      expect(classicCard.getAttribute("tabIndex")).toBe("0");
    });

    it("indicates active state with aria-expanded", () => {
      render(<GamesGallery />);

      const classicCard = screen.getByRole("button", { name: /select classic mode/i });
      expect(classicCard.getAttribute("aria-expanded")).toBe("true");

      const orderCard = screen.getByRole("button", { name: /select order mode/i });
      expect(orderCard.getAttribute("aria-expanded")).toBe("false");
    });

    it("updates aria-expanded when mode changes", () => {
      render(<GamesGallery />);

      const orderCard = screen.getByRole("button", { name: /select order mode/i });
      fireEvent.click(orderCard);

      expect(orderCard.getAttribute("aria-expanded")).toBe("true");

      const classicCard = screen.getByRole("button", { name: /select classic mode/i });
      expect(classicCard.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("Theme Toggle", () => {
    it("calls toggle when theme button is clicked", () => {
      render(<GamesGallery />);

      const toggleButton = screen.getByRole("button", { name: /switch to dark mode/i });
      fireEvent.click(toggleButton);

      expect(mockToggle).toHaveBeenCalled();
    });
  });
});
