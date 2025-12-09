import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVictoryConfetti } from "../useVictoryConfetti";
import type { ConfettiRef } from "@/components/magicui/confetti";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useVictoryConfetti", () => {
  const mockFire = vi.fn().mockResolvedValue(undefined);
  let mockConfettiRef: React.RefObject<ConfettiRef>;
  let mockMatchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock confetti ref
    mockConfettiRef = {
      current: { fire: mockFire },
    } as unknown as React.RefObject<ConfettiRef>;

    // Default to prefers motion (not reduced)
    mockMatchMedia = vi.fn().mockReturnValue({ matches: false });
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });
  });

  describe("initial state", () => {
    it("should return hasFiredConfetti: false initially", () => {
      const { result } = renderHook(() =>
        useVictoryConfetti(mockConfettiRef, {
          hasWon: false,
          isGameComplete: false,
          isMounted: true,
        }),
      );

      expect(result.current.hasFiredConfetti).toBe(false);
    });

    it("should expose triggerConfetti function", () => {
      const { result } = renderHook(() =>
        useVictoryConfetti(mockConfettiRef, {
          hasWon: false,
          isGameComplete: false,
          isMounted: true,
        }),
      );

      expect(typeof result.current.triggerConfetti).toBe("function");
    });
  });

  describe("auto-fire on victory", () => {
    it("should fire confetti when all conditions are met", async () => {
      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          }),
        );
      });

      expect(mockFire).toHaveBeenCalled();
    });

    it("should NOT fire confetti when hasWon is false", async () => {
      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: false,
            isGameComplete: true,
            isMounted: true,
            guessCount: 6,
          }),
        );
      });

      expect(mockFire).not.toHaveBeenCalled();
    });

    it("should NOT fire confetti when isGameComplete is false", async () => {
      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: false,
            isMounted: true,
            guessCount: 3,
          }),
        );
      });

      expect(mockFire).not.toHaveBeenCalled();
    });

    it("should NOT fire confetti when isMounted is false", async () => {
      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: false,
            guessCount: 3,
          }),
        );
      });

      expect(mockFire).not.toHaveBeenCalled();
    });

    it("should NOT fire confetti when disabled is true", async () => {
      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
            disabled: true,
          }),
        );
      });

      expect(mockFire).not.toHaveBeenCalled();
    });

    it("should NOT fire confetti when confettiRef.current is null", async () => {
      const nullRef = { current: null } as React.RefObject<ConfettiRef>;

      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(nullRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          }),
        );
      });

      expect(mockFire).not.toHaveBeenCalled();
    });

    it("should set hasFiredConfetti to true after firing", async () => {
      let result: { current: { hasFiredConfetti: boolean } };

      await act(async () => {
        const hook = renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          }),
        );
        result = hook.result;
      });

      expect(result!.current.hasFiredConfetti).toBe(true);
    });

    it("should NOT fire twice for the same victory", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rerender: any;

      await act(async () => {
        const hook = renderHook((props) => useVictoryConfetti(mockConfettiRef, props), {
          initialProps: {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          },
        });
        result = hook.result;
        rerender = hook.rerender;
      });

      expect(result!.current.hasFiredConfetti).toBe(true);
      expect(mockFire).toHaveBeenCalledTimes(1);

      mockFire.mockClear();

      await act(async () => {
        rerender({
          hasWon: true,
          isGameComplete: true,
          isMounted: true,
          guessCount: 3,
        });
      });

      // Should not fire again
      expect(mockFire).not.toHaveBeenCalled();
    });
  });

  describe("reduced motion preference", () => {
    it("should use reduced particle count when prefers-reduced-motion", async () => {
      mockMatchMedia.mockReturnValue({ matches: true });

      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          }),
        );
      });

      expect(mockFire).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 30,
          spread: 45,
          gravity: 1.2,
          drift: 0,
        }),
      );
    });

    it("should use full confetti when motion is allowed", async () => {
      mockMatchMedia.mockReturnValue({ matches: false });

      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          }),
        );
      });

      expect(mockFire).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 100,
          spread: 70,
        }),
      );
    });

    it("should fire second burst after delay when motion is allowed", async () => {
      vi.useFakeTimers();
      mockMatchMedia.mockReturnValue({ matches: false });

      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          }),
        );
      });

      expect(mockFire).toHaveBeenCalledTimes(1);

      // Advance timer for second burst
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(mockFire).toHaveBeenCalledTimes(2);

      // Second burst has different settings
      expect(mockFire).toHaveBeenLastCalledWith(
        expect.objectContaining({
          particleCount: 50,
          spread: 120,
        }),
      );

      vi.useRealTimers();
    });
  });

  describe("manual trigger", () => {
    it("should fire confetti when triggerConfetti is called", async () => {
      const { result } = renderHook(() =>
        useVictoryConfetti(mockConfettiRef, {
          hasWon: false,
          isGameComplete: false,
          isMounted: true,
        }),
      );

      await act(async () => {
        await result.current.triggerConfetti();
      });

      expect(mockFire).toHaveBeenCalled();
    });

    it("should not fire when disabled even with manual trigger", async () => {
      const { result } = renderHook(() =>
        useVictoryConfetti(mockConfettiRef, {
          hasWon: false,
          isGameComplete: false,
          isMounted: true,
          disabled: true,
        }),
      );

      await act(async () => {
        await result.current.triggerConfetti();
      });

      expect(mockFire).not.toHaveBeenCalled();
    });

    it("should not fire when confettiRef.current is null", async () => {
      const nullRef = { current: null } as React.RefObject<ConfettiRef>;

      const { result } = renderHook(() =>
        useVictoryConfetti(nullRef, {
          hasWon: false,
          isGameComplete: false,
          isMounted: true,
        }),
      );

      await act(async () => {
        await result.current.triggerConfetti();
      });

      expect(mockFire).not.toHaveBeenCalled();
    });
  });

  describe("state reset", () => {
    it("should reset hasFiredConfetti when hasWon becomes false", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rerender: any;

      await act(async () => {
        const hook = renderHook((props) => useVictoryConfetti(mockConfettiRef, props), {
          initialProps: {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          },
        });
        result = hook.result;
        rerender = hook.rerender;
      });

      expect(result!.current.hasFiredConfetti).toBe(true);

      // Change to a losing state
      await act(async () => {
        rerender({
          hasWon: false,
          isGameComplete: true,
          isMounted: true,
          guessCount: 6,
        });
      });

      expect(result!.current.hasFiredConfetti).toBe(false);
    });

    it("should reset hasFiredConfetti when isGameComplete becomes false", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rerender: any;

      await act(async () => {
        const hook = renderHook((props) => useVictoryConfetti(mockConfettiRef, props), {
          initialProps: {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          },
        });
        result = hook.result;
        rerender = hook.rerender;
      });

      expect(result!.current.hasFiredConfetti).toBe(true);

      // Start new game
      await act(async () => {
        rerender({
          hasWon: false,
          isGameComplete: false,
          isMounted: true,
          guessCount: 0,
        });
      });

      expect(result!.current.hasFiredConfetti).toBe(false);
    });
  });

  describe("custom colors", () => {
    it("should use custom colors when provided", async () => {
      const customColors = ["#ff0000", "#00ff00"];

      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
            colors: customColors,
          }),
        );
      });

      expect(mockFire).toHaveBeenCalledWith(
        expect.objectContaining({
          colors: customColors,
        }),
      );
    });

    it("should use default colors when not provided", async () => {
      await act(async () => {
        renderHook(() =>
          useVictoryConfetti(mockConfettiRef, {
            hasWon: true,
            isGameComplete: true,
            isMounted: true,
            guessCount: 3,
          }),
        );
      });

      expect(mockFire).toHaveBeenCalledWith(
        expect.objectContaining({
          colors: ["#d4a574", "#27ae60", "#3498db", "#f39c12"],
        }),
      );
    });
  });
});
