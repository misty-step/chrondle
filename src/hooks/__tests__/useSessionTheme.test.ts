/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionTheme } from "../useSessionTheme";

// Mock matchMedia
function createMockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];

  return {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_, callback) => {
      listeners.push(callback);
    }),
    removeEventListener: vi.fn((_, callback) => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }),
    dispatchEvent: vi.fn(),
    _listeners: listeners,
    _setMatches: (newMatches: boolean) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)") as ReturnType<
        typeof createMockMatchMedia
      > & { matches: boolean };
      mq.matches = newMatches;
      // Trigger listeners
      for (const listener of listeners) {
        listener({ matches: newMatches } as MediaQueryListEvent);
      }
    },
  };
}

describe("useSessionTheme", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("detects system dark theme", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(true));

      const { result } = renderHook(() => useSessionTheme());

      expect(result.current.systemTheme).toBe("dark");
      expect(result.current.override).toBeNull();
      expect(result.current.currentTheme).toBe("dark");
    });

    it("detects system light theme", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(false));

      const { result } = renderHook(() => useSessionTheme());

      expect(result.current.systemTheme).toBe("light");
      expect(result.current.override).toBeNull();
      expect(result.current.currentTheme).toBe("light");
    });

    it("sets isMounted to true after mount", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(false));

      const { result } = renderHook(() => useSessionTheme());

      expect(result.current.isMounted).toBe(true);
    });
  });

  describe("toggle", () => {
    it("toggles from light to dark", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(false));

      const { result } = renderHook(() => useSessionTheme());

      expect(result.current.currentTheme).toBe("light");

      act(() => {
        result.current.toggle();
      });

      expect(result.current.override).toBe("dark");
      expect(result.current.currentTheme).toBe("dark");
    });

    it("toggles from dark to light", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(true));

      const { result } = renderHook(() => useSessionTheme());

      expect(result.current.currentTheme).toBe("dark");

      act(() => {
        result.current.toggle();
      });

      expect(result.current.override).toBe("light");
      expect(result.current.currentTheme).toBe("light");
    });

    it("can toggle back and forth", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(false));

      const { result } = renderHook(() => useSessionTheme());

      // Start at light
      expect(result.current.currentTheme).toBe("light");

      // Toggle to dark
      act(() => {
        result.current.toggle();
      });
      expect(result.current.currentTheme).toBe("dark");

      // Toggle back to light
      act(() => {
        result.current.toggle();
      });
      expect(result.current.currentTheme).toBe("light");
    });
  });

  describe("theme resolution", () => {
    it("uses system theme when no override", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(true));

      const { result } = renderHook(() => useSessionTheme());

      expect(result.current.override).toBeNull();
      expect(result.current.systemTheme).toBe("dark");
      expect(result.current.currentTheme).toBe("dark");
    });

    it("override takes precedence over system theme", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(true));

      const { result } = renderHook(() => useSessionTheme());

      // System is dark
      expect(result.current.systemTheme).toBe("dark");

      // Toggle to light
      act(() => {
        result.current.toggle();
      });

      // Override is light, even though system is dark
      expect(result.current.override).toBe("light");
      expect(result.current.systemTheme).toBe("dark");
      expect(result.current.currentTheme).toBe("light");
    });
  });

  describe("event listeners", () => {
    it("adds event listener on mount", () => {
      const mockMq = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMq);

      renderHook(() => useSessionTheme());

      expect(mockMq.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("removes event listener on unmount", () => {
      const mockMq = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMq);

      const { unmount } = renderHook(() => useSessionTheme());
      unmount();

      expect(mockMq.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });
  });

  describe("no localStorage persistence", () => {
    it("does not persist theme override", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(false));
      const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");

      const { result } = renderHook(() => useSessionTheme());

      act(() => {
        result.current.toggle();
      });

      // Should not call localStorage.setItem for theme
      expect(localStorageSpy).not.toHaveBeenCalled();

      localStorageSpy.mockRestore();
    });

    it("starts with null override (no persistence)", () => {
      window.matchMedia = vi.fn().mockReturnValue(createMockMatchMedia(false));

      const { result } = renderHook(() => useSessionTheme());

      expect(result.current.override).toBeNull();
    });
  });
});
