import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useClipboard } from "../useClipboard";

/**
 * Tests for useClipboard hook
 *
 * Tests clipboard copy functionality with both modern
 * navigator.clipboard API and legacy execCommand fallback.
 */

describe("useClipboard", () => {
  const originalClipboard = navigator.clipboard;
  const originalIsSecureContext = window.isSecureContext;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original implementations
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "isSecureContext", {
      value: originalIsSecureContext,
      writable: true,
      configurable: true,
    });
    document.execCommand = originalExecCommand;
  });

  describe("Initial State", () => {
    it("returns initial state with isCopying false", () => {
      const { result } = renderHook(() => useClipboard());

      expect(result.current.isCopying).toBe(false);
      expect(result.current.lastCopySuccess).toBeNull();
      expect(typeof result.current.copyToClipboard).toBe("function");
    });
  });

  describe("Modern Clipboard API", () => {
    it("copies text using navigator.clipboard.writeText", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "isSecureContext", {
        value: true,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copyToClipboard("Hello, World!");
      });

      expect(writeTextMock).toHaveBeenCalledWith("Hello, World!");
      expect(success!).toBe(true);
      expect(result.current.lastCopySuccess).toBe(true);
      expect(result.current.isCopying).toBe(false);
    });

    it("handles clipboard API errors", async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error("Permission denied"));

      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "isSecureContext", {
        value: true,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copyToClipboard("text");
      });

      expect(success!).toBe(false);
      expect(result.current.lastCopySuccess).toBe(false);
      expect(result.current.isCopying).toBe(false);
    });
  });

  describe("Legacy Fallback (execCommand)", () => {
    it("uses execCommand when clipboard API unavailable", async () => {
      // Remove clipboard API
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const { result } = renderHook(() => useClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copyToClipboard("Fallback text");
      });

      expect(execCommandMock).toHaveBeenCalledWith("copy");
      expect(success!).toBe(true);
      expect(result.current.lastCopySuccess).toBe(true);
    });

    it("uses execCommand when not in secure context", async () => {
      const writeTextMock = vi.fn();
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "isSecureContext", {
        value: false,
        writable: true,
        configurable: true,
      });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copyToClipboard("Non-secure context");
      });

      // Should not use clipboard API
      expect(writeTextMock).not.toHaveBeenCalled();
      // Should use execCommand fallback
      expect(execCommandMock).toHaveBeenCalledWith("copy");
    });

    it("handles execCommand failure", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const execCommandMock = vi.fn().mockReturnValue(false);
      document.execCommand = execCommandMock;

      const { result } = renderHook(() => useClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copyToClipboard("text");
      });

      expect(success!).toBe(false);
      expect(result.current.lastCopySuccess).toBe(false);
    });
  });

  describe("State Management", () => {
    it("sets isCopying to true during copy operation", async () => {
      let resolvePromise: () => void;
      const writeTextMock = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolvePromise = resolve;
          }),
      );

      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "isSecureContext", {
        value: true,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useClipboard());

      // Start copy (don't await)
      let copyPromise: Promise<boolean>;
      act(() => {
        copyPromise = result.current.copyToClipboard("text");
      });

      // Should be copying
      expect(result.current.isCopying).toBe(true);

      // Complete the copy
      await act(async () => {
        resolvePromise!();
        await copyPromise;
      });

      // Should no longer be copying
      expect(result.current.isCopying).toBe(false);
    });

    it("updates lastCopySuccess on each copy", async () => {
      const writeTextMock = vi.fn();

      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "isSecureContext", {
        value: true,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useClipboard());

      // First copy succeeds
      writeTextMock.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.copyToClipboard("first");
      });
      expect(result.current.lastCopySuccess).toBe(true);

      // Second copy fails
      writeTextMock.mockRejectedValueOnce(new Error("fail"));
      await act(async () => {
        await result.current.copyToClipboard("second");
      });
      expect(result.current.lastCopySuccess).toBe(false);

      // Third copy succeeds again
      writeTextMock.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.copyToClipboard("third");
      });
      expect(result.current.lastCopySuccess).toBe(true);
    });
  });
});
