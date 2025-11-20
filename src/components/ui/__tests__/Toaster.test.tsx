import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "@/hooks/use-toast";

// Test component that exposes toast functions and state
function ToastTestHarness() {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div>
      <div data-testid="toast-count">{toasts.length}</div>
      <button
        onClick={() =>
          addToast({
            title: "Test Toast",
            description: "This is a test message",
          })
        }
      >
        Add Toast
      </button>
      <button
        onClick={() =>
          addToast({
            title: "Error",
            description: "Something went wrong",
            variant: "destructive",
          })
        }
      >
        Add Error
      </button>
      {toasts.map((toast) => (
        <div key={toast.id} data-testid={`toast-${toast.id}`}>
          <span data-testid={`title-${toast.id}`}>{toast.title}</span>
          <span data-testid={`description-${toast.id}`}>{toast.description}</span>
          <span data-testid={`variant-${toast.id}`}>{toast.variant || "default"}</span>
          <button onClick={() => removeToast(toast.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}

describe("Toast System", () => {
  describe("useToast hook", () => {
    it("returns safe defaults outside provider", () => {
      function TestComponent() {
        const { toasts, addToast, removeToast } = useToast();
        return (
          <div>
            <div data-testid="toast-count">{toasts.length}</div>
            <button onClick={() => addToast({ title: "Test" })}>Add</button>
            <button onClick={() => removeToast("test-id")}>Remove</button>
          </div>
        );
      }

      render(<TestComponent />);

      expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
      // Functions should not throw
      expect(() => screen.getByText("Add").click()).not.toThrow();
      expect(() => screen.getByText("Remove").click()).not.toThrow();
    });
  });

  describe("ToastProvider", () => {
    it("provides toast context to children", () => {
      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>,
      );

      expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
    });

    it("adds toast when addToast called", () => {
      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>,
      );

      act(() => {
        screen.getByText("Add Toast").click();
      });

      expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
      expect(screen.getByText("Test Toast")).toBeInTheDocument();
      expect(screen.getByText("This is a test message")).toBeInTheDocument();
    });

    it("adds destructive variant toast", () => {
      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>,
      );

      act(() => {
        screen.getByText("Add Error").click();
      });

      expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
      const toast = screen.getByText("Error").closest("[data-testid^='toast-']");
      const variant = toast?.querySelector("[data-testid^='variant-']");
      expect(variant).toHaveTextContent("destructive");
    });

    it("removes toast when removeToast called", () => {
      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>,
      );

      act(() => {
        screen.getByText("Add Toast").click();
      });

      expect(screen.getByTestId("toast-count")).toHaveTextContent("1");

      act(() => {
        screen.getByText("Dismiss").click();
      });

      expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
    });

    it("handles multiple toasts", () => {
      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>,
      );

      act(() => {
        screen.getByText("Add Toast").click();
        screen.getByText("Add Error").click();
      });

      expect(screen.getByTestId("toast-count")).toHaveTextContent("2");
    });

    it("auto-dismisses toast after timeout", () => {
      vi.useFakeTimers();

      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>,
      );

      act(() => {
        screen.getByText("Add Toast").click();
      });

      expect(screen.getByTestId("toast-count")).toHaveTextContent("1");

      // Fast-forward time by 7 seconds
      act(() => {
        vi.advanceTimersByTime(7000);
      });

      expect(screen.getByTestId("toast-count")).toHaveTextContent("0");

      vi.useRealTimers();
    });

    it("generates unique IDs for each toast", () => {
      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>,
      );

      // Get initial count
      const initialCount = parseInt(screen.getByTestId("toast-count").textContent || "0");

      act(() => {
        screen.getByText("Add Toast").click();
        screen.getByText("Add Toast").click();
      });

      const toastElements = screen.getAllByTestId(/^toast-/);
      const ids = toastElements.map((el) => el.getAttribute("data-testid"));

      // All IDs should be unique
      expect(new Set(ids).size).toBe(ids.length);
      // Should have added 2 toasts
      expect(parseInt(screen.getByTestId("toast-count").textContent || "0")).toBe(initialCount + 2);
    });
  });
});
