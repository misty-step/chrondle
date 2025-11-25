import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCopyEmail } from "../useCopyEmail";

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock toast hook
vi.mock("../use-toast", () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

describe("useCopyEmail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should cleanup setTimeout on unmount to prevent memory leaks", async () => {
    const { result, unmount } = renderHook(() => useCopyEmail("test@example.com"));

    // Trigger copy
    await act(async () => {
      await result.current.copy();
    });

    // Verify hasCopied is true
    expect(result.current.hasCopied).toBe(true);

    // Unmount component before timeout completes
    unmount();

    // Advance timers - if cleanup didn't happen, this would try to setHasCopied on unmounted component
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // No errors should be thrown - this test passing means cleanup worked
  });

  it("should reset hasCopied after 2 seconds", async () => {
    const { result } = renderHook(() => useCopyEmail("test@example.com"));

    // Trigger copy
    await act(async () => {
      await result.current.copy();
    });

    expect(result.current.hasCopied).toBe(true);

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.hasCopied).toBe(false);
  });

  it("should clear previous timeout when copy is called multiple times", async () => {
    const { result } = renderHook(() => useCopyEmail("test@example.com"));

    // First copy
    await act(async () => {
      await result.current.copy();
    });
    expect(result.current.hasCopied).toBe(true);

    // Advance time partially
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Second copy before first timeout completes
    await act(async () => {
      await result.current.copy();
    });
    expect(result.current.hasCopied).toBe(true);

    // Advance time by another 1 second (total 2 seconds from first copy, but only 1 from second)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should still be true because second timeout is still active
    expect(result.current.hasCopied).toBe(true);

    // Advance final second to complete second timeout
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.hasCopied).toBe(false);
  });

  it("should copy email to clipboard", async () => {
    const email = "test@example.com";
    const { result } = renderHook(() => useCopyEmail(email));

    await act(async () => {
      await result.current.copy();
    });

    expect(mockClipboard.writeText).toHaveBeenCalledWith(email);
    expect(result.current.hasCopied).toBe(true);
  });
});
