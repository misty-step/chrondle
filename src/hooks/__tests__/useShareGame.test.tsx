import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShareGame } from "../useShareGame";
import * as useWebShareModule from "../useWebShare";
import * as sharingGenerator from "@/lib/sharing/generator";
import type { RangeGuess } from "@/types/range";

// Mock useWebShare
vi.mock("../useWebShare", () => ({
  useWebShare: vi.fn(),
}));

// Mock sharing generator
vi.mock("@/lib/sharing/generator", () => ({
  generateShareText: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useShareGame", () => {
  const mockShare = vi.fn();
  const mockDispatchEvent = vi.fn();

  const defaultRanges: RangeGuess[] = [
    { start: 1960, end: 1980, hintsUsed: 2, score: 75, timestamp: Date.now() },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mock implementations
    vi.mocked(useWebShareModule.useWebShare).mockReturnValue({
      share: mockShare,
      canShare: true,
      shareMethod: "clipboard",
      isSharing: false,
      lastShareSuccess: null,
      shareStrategy: "clipboard",
    });

    vi.mocked(sharingGenerator.generateShareText).mockReturnValue(
      "Chrondle #42\nRange: 🗓️ 21 years\nHints: ⬛⬛⬜⬜⬜⬜\nScore: 😎 75/100\n\nchrondle.app",
    );

    // Mock window.dispatchEvent
    window.dispatchEvent = mockDispatchEvent;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should return idle shareStatus initially", () => {
      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      expect(result.current.shareStatus).toBe("idle");
    });

    it("should expose canShare from useWebShare", () => {
      vi.mocked(useWebShareModule.useWebShare).mockReturnValue({
        share: mockShare,
        canShare: false,
        shareMethod: null,
        isSharing: false,
        lastShareSuccess: null,
        shareStrategy: "fallback",
      });

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      expect(result.current.canShare).toBe(false);
    });

    it("should expose shareMethod from useWebShare", () => {
      vi.mocked(useWebShareModule.useWebShare).mockReturnValue({
        share: mockShare,
        canShare: true,
        shareMethod: "webshare",
        isSharing: false,
        lastShareSuccess: null,
        shareStrategy: "native",
      });

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      expect(result.current.shareMethod).toBe("webshare");
    });

    it("should expose isSharing from useWebShare", () => {
      vi.mocked(useWebShareModule.useWebShare).mockReturnValue({
        share: mockShare,
        canShare: true,
        shareMethod: "clipboard",
        isSharing: true,
        lastShareSuccess: null,
        shareStrategy: "clipboard",
      });

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      expect(result.current.isSharing).toBe(true);
    });
  });

  describe("shareGame success", () => {
    it("should call share with generated text", async () => {
      mockShare.mockResolvedValue(true);

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(mockShare).toHaveBeenCalledWith(
        "Chrondle #42\nRange: 🗓️ 21 years\nHints: ⬛⬛⬜⬜⬜⬜\nScore: 😎 75/100\n\nchrondle.app",
      );
    });

    it("should set shareStatus to success on successful share", async () => {
      mockShare.mockResolvedValue(true);

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(result.current.shareStatus).toBe("success");
    });

    it("should call onSuccess callback when provided", async () => {
      mockShare.mockResolvedValue(true);
      const onSuccess = vi.fn();

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42, { onSuccess }));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should dispatch celebrate event on win", async () => {
      mockShare.mockResolvedValue(true);

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chrondle:celebrate",
        }),
      );
    });

    it("should NOT dispatch celebrate event on loss", async () => {
      mockShare.mockResolvedValue(true);

      const { result } = renderHook(() => useShareGame(defaultRanges, 0, false, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(mockDispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe("shareGame failure", () => {
    it("should set shareStatus to error on failed share", async () => {
      mockShare.mockResolvedValue(false);

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(result.current.shareStatus).toBe("error");
    });

    it("should call onError callback when provided", async () => {
      mockShare.mockResolvedValue(false);
      const onError = vi.fn();

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42, { onError }));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(onError).toHaveBeenCalledTimes(1);
    });

    it("should NOT dispatch celebrate event on error", async () => {
      mockShare.mockResolvedValue(false);

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(mockDispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe("status reset timer", () => {
    it("should reset success status to idle after 2000ms", async () => {
      mockShare.mockResolvedValue(true);

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(result.current.shareStatus).toBe("success");

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.shareStatus).toBe("idle");
    });

    it("should reset error status to idle after 2000ms", async () => {
      mockShare.mockResolvedValue(false);

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      expect(result.current.shareStatus).toBe("error");

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.shareStatus).toBe("idle");
    });

    it("should not reset status before 2000ms", async () => {
      mockShare.mockResolvedValue(true);

      const { result } = renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      await act(async () => {
        await result.current.shareGame();
      });

      act(() => {
        vi.advanceTimersByTime(1999);
      });

      expect(result.current.shareStatus).toBe("success");
    });
  });

  describe("generateShareText integration", () => {
    it("should pass ranges, score, hasWon, puzzleNumber to generator", () => {
      renderHook(() => useShareGame(defaultRanges, 75, true, 42));

      expect(sharingGenerator.generateShareText).toHaveBeenCalledWith(defaultRanges, 75, true, 42, {
        targetYear: undefined,
      });
    });

    it("should pass targetYear option to generator", () => {
      renderHook(() => useShareGame(defaultRanges, 75, true, 42, { targetYear: 1969 }));

      expect(sharingGenerator.generateShareText).toHaveBeenCalledWith(defaultRanges, 75, true, 42, {
        targetYear: 1969,
      });
    });

    it("should handle missing puzzleNumber", () => {
      renderHook(() => useShareGame(defaultRanges, 75, true, undefined));

      expect(sharingGenerator.generateShareText).toHaveBeenCalledWith(
        defaultRanges,
        75,
        true,
        undefined,
        { targetYear: undefined },
      );
    });
  });
});
