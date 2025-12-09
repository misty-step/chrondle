import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusTrap } from "../useFocusTrap";

/**
 * Tests for useFocusTrap hook
 *
 * Tests focus trapping behavior for modals and dialogs.
 */

describe("useFocusTrap", () => {
  let container: HTMLDivElement;
  let button1: HTMLButtonElement;
  let button2: HTMLButtonElement;
  let button3: HTMLButtonElement;

  beforeEach(() => {
    // Create test DOM structure
    container = document.createElement("div");
    container.setAttribute("tabindex", "-1");

    button1 = document.createElement("button");
    button1.textContent = "First Button";
    button1.setAttribute("data-testid", "button-1");

    button2 = document.createElement("button");
    button2.textContent = "Second Button";
    button2.setAttribute("data-testid", "button-2");

    button3 = document.createElement("button");
    button3.textContent = "Third Button";
    button3.setAttribute("data-testid", "button-3");

    container.appendChild(button1);
    container.appendChild(button2);
    container.appendChild(button3);

    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("Initial State", () => {
    it("returns a ref object", () => {
      const { result } = renderHook(() => useFocusTrap(false));

      expect(result.current).toBeDefined();
      expect(result.current.current).toBeNull();
    });
  });

  describe("Focus Behavior", () => {
    it("focuses first focusable element when activated", () => {
      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      });

      // Attach ref to container
      act(() => {
        result.current.current = container;
      });

      // Activate focus trap
      rerender({ active: true });

      expect(document.activeElement).toBe(button1);
    });

    it("restores focus when deactivated", () => {
      // Focus an element outside the trap
      const outsideButton = document.createElement("button");
      outsideButton.textContent = "Outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      });

      act(() => {
        result.current.current = container;
      });

      // Activate focus trap
      rerender({ active: true });
      expect(document.activeElement).toBe(button1);

      // Deactivate focus trap
      rerender({ active: false });
      expect(document.activeElement).toBe(outsideButton);

      // Cleanup
      document.body.removeChild(outsideButton);
    });
  });

  describe("Tab Trapping", () => {
    it("wraps focus from last to first on Tab", () => {
      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      });

      act(() => {
        result.current.current = container;
      });

      rerender({ active: true });

      // Focus the last button
      button3.focus();
      expect(document.activeElement).toBe(button3);

      // Simulate Tab key
      const tabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(tabEvent, "preventDefault");

      act(() => {
        document.dispatchEvent(tabEvent);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(button1);
    });

    it("wraps focus from first to last on Shift+Tab", () => {
      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      });

      act(() => {
        result.current.current = container;
      });

      rerender({ active: true });

      // Focus should be on first button after activation
      expect(document.activeElement).toBe(button1);

      // Simulate Shift+Tab key
      const shiftTabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(shiftTabEvent, "preventDefault");

      act(() => {
        document.dispatchEvent(shiftTabEvent);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(button3);
    });

    it("does not trap when inactive", () => {
      const { result } = renderHook(() => useFocusTrap(false));

      act(() => {
        result.current.current = container;
      });

      // Focus last button
      button3.focus();

      // Simulate Tab key
      const tabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(tabEvent, "preventDefault");

      act(() => {
        document.dispatchEvent(tabEvent);
      });

      // Should not prevent default when inactive
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("ignores non-Tab keys", () => {
      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      });

      act(() => {
        result.current.current = container;
      });

      rerender({ active: true });

      button2.focus();

      // Simulate Enter key
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(enterEvent, "preventDefault");

      act(() => {
        document.dispatchEvent(enterEvent);
      });

      // Should not prevent default for non-Tab keys
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      // Focus should remain on button2
      expect(document.activeElement).toBe(button2);
    });
  });

  describe("Edge Cases", () => {
    it("focuses container when no focusable elements", () => {
      const emptyContainer = document.createElement("div");
      emptyContainer.setAttribute("tabindex", "-1");
      document.body.appendChild(emptyContainer);

      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      });

      act(() => {
        result.current.current = emptyContainer;
      });

      rerender({ active: true });

      expect(document.activeElement).toBe(emptyContainer);

      // Cleanup
      document.body.removeChild(emptyContainer);
    });

    it("handles disabled buttons correctly", () => {
      // Disable the first and last buttons
      button1.disabled = true;
      button3.disabled = true;

      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      });

      act(() => {
        result.current.current = container;
      });

      rerender({ active: true });

      // Should focus the only enabled button
      expect(document.activeElement).toBe(button2);
    });

    it("finds various focusable element types", () => {
      // Add various focusable elements
      const input = document.createElement("input");
      const anchor = document.createElement("a");
      anchor.href = "#";
      const select = document.createElement("select");
      const textarea = document.createElement("textarea");

      container.appendChild(input);
      container.appendChild(anchor);
      container.appendChild(select);
      container.appendChild(textarea);

      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      });

      act(() => {
        result.current.current = container;
      });

      rerender({ active: true });

      // Focus last element (textarea)
      textarea.focus();

      // Tab should wrap to first (button1)
      const tabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        document.dispatchEvent(tabEvent);
      });

      expect(document.activeElement).toBe(button1);
    });
  });
});
