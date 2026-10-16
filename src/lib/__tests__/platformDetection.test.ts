import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isMobileDevice, supportsWebShare, getShareStrategy } from "../platformDetection";

/**
 * Platform Detection Tests
 *
 * Deep module pattern: Tests verify behavior at the interface level.
 * We mock browser APIs at the boundary, not internal implementation.
 */

describe("platformDetection", () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  // Helper to create mock navigator
  function mockNavigator(overrides: Partial<Navigator> = {}): void {
    Object.defineProperty(global, "navigator", {
      value: {
        userAgent: "Mozilla/5.0",
        share: undefined,
        clipboard: undefined,
        ...overrides,
      },
      writable: true,
      configurable: true,
    });
  }

  // Helper to create mock window
  function mockWindow(overrides: Record<string, unknown> = {}): void {
    Object.defineProperty(global, "window", {
      value: {
        isSecureContext: true,
        ...overrides,
      },
      writable: true,
      configurable: true,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  describe("isMobileDevice", () => {
    it("returns false during SSR (no navigator)", () => {
      Object.defineProperty(global, "navigator", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isMobileDevice()).toBe(false);
    });

    it("detects iPhone", () => {
      mockNavigator({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      });
      expect(isMobileDevice()).toBe(true);
    });

    it("detects Android phone", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/110.0.0.0 Mobile",
      });
      expect(isMobileDevice()).toBe(true);
    });

    it("detects iPad", () => {
      mockNavigator({
        userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      });
      expect(isMobileDevice()).toBe(true);
    });

    it("returns false for desktop Chrome", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0",
      });
      expect(isMobileDevice()).toBe(false);
    });

    it("returns false for desktop Firefox", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      });
      expect(isMobileDevice()).toBe(false);
    });
  });

  describe("supportsWebShare", () => {
    it("returns false during SSR", () => {
      Object.defineProperty(global, "navigator", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(supportsWebShare()).toBe(false);
    });

    it("returns true when navigator.share is a function", () => {
      mockNavigator({
        share: vi.fn(),
      });
      expect(supportsWebShare()).toBe(true);
    });

    it("returns false when navigator.share is undefined", () => {
      mockNavigator({
        share: undefined,
      });
      expect(supportsWebShare()).toBe(false);
    });

    it("returns false when navigator.share exists but is not a function", () => {
      mockNavigator({
        share: "not a function" as unknown as Navigator["share"],
      });
      expect(supportsWebShare()).toBe(false);
    });
  });

  describe("getShareStrategy", () => {
    it("returns 'native' on mobile with Web Share support", () => {
      mockNavigator({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        share: vi.fn(),
      });
      mockWindow({ isSecureContext: true });
      expect(getShareStrategy()).toBe("native");
    });

    it("returns 'clipboard' on desktop with secure context", () => {
      mockNavigator({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        clipboard: { writeText: vi.fn() } as unknown as Clipboard,
      });
      mockWindow({ isSecureContext: true });
      expect(getShareStrategy()).toBe("clipboard");
    });

    it("returns 'fallback' without clipboard or Web Share", () => {
      mockNavigator({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        clipboard: undefined,
      });
      mockWindow({ isSecureContext: false });
      expect(getShareStrategy()).toBe("fallback");
    });

    it("returns 'clipboard' on desktop even with Web Share support", () => {
      // Desktop Chrome has Web Share but we prefer clipboard for better UX
      mockNavigator({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        share: vi.fn(),
        clipboard: { writeText: vi.fn() } as unknown as Clipboard,
      });
      mockWindow({ isSecureContext: true });
      expect(getShareStrategy()).toBe("clipboard");
    });
  });
});
