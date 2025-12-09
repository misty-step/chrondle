/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setModePreferenceCookie, MODE_COOKIE, type ModeKey } from "../modePreference";

describe("modePreference", () => {
  describe("setModePreferenceCookie", () => {
    let originalDocument: PropertyDescriptor | undefined;

    beforeEach(() => {
      // Store original document descriptor
      originalDocument = Object.getOwnPropertyDescriptor(global, "document");
      // Mock document.cookie as a writable string
      let cookieStore = "";
      Object.defineProperty(document, "cookie", {
        get: () => cookieStore,
        set: (value: string) => {
          cookieStore = value;
        },
        configurable: true,
      });
    });

    afterEach(() => {
      // Restore original document
      if (originalDocument) {
        Object.defineProperty(global, "document", originalDocument);
      }
    });

    it("sets cookie for classic mode", () => {
      setModePreferenceCookie("classic");

      expect(document.cookie).toContain(`${MODE_COOKIE}=classic`);
      expect(document.cookie).toContain("path=/");
      expect(document.cookie).toContain("SameSite=Lax");
    });

    it("sets cookie for order mode", () => {
      setModePreferenceCookie("order");

      expect(document.cookie).toContain(`${MODE_COOKIE}=order`);
    });

    it("sets cookie with 1-year max-age", () => {
      setModePreferenceCookie("classic");

      const oneYearSeconds = 60 * 60 * 24 * 365;
      expect(document.cookie).toContain(`max-age=${oneYearSeconds}`);
    });

    it("does nothing when document is undefined (SSR)", () => {
      // Simulate SSR environment by making document undefined
      const originalDoc = global.document;
      // @ts-expect-error - Intentionally setting to undefined for SSR test
      global.document = undefined;

      // Should not throw
      expect(() => setModePreferenceCookie("classic")).not.toThrow();

      // Restore document
      global.document = originalDoc;
    });
  });

  describe("MODE_COOKIE constant", () => {
    it("exports the correct cookie name", () => {
      expect(MODE_COOKIE).toBe("chrondle_mode");
    });
  });

  describe("ModeKey type", () => {
    it("accepts valid mode keys", () => {
      const classic: ModeKey = "classic";
      const order: ModeKey = "order";

      expect(classic).toBe("classic");
      expect(order).toBe("order");
    });
  });
});
