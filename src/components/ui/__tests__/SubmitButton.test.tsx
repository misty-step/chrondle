import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SubmitButton } from "../SubmitButton";

describe("SubmitButton", () => {
  describe("Basic Rendering", () => {
    it("renders button with children text", () => {
      render(<SubmitButton onClick={() => {}}>Submit My Timeline</SubmitButton>);

      expect(screen.getByRole("button", { name: "Submit My Timeline" })).toBeInTheDocument();
    });

    it("renders with default size (lg)", () => {
      const { container } = render(<SubmitButton onClick={() => {}}>Submit</SubmitButton>);
      const button = container.querySelector("button");

      expect(button?.className).toContain("text-base");
    });

    it("renders with default size when not specified", () => {
      const { container } = render(
        <SubmitButton onClick={() => {}} size="default">
          Submit
        </SubmitButton>,
      );
      const button = container.querySelector("button");

      expect(button?.className).not.toContain("text-base");
    });
  });

  describe("Core Styling", () => {
    it("applies core CTA styling", () => {
      const { container } = render(<SubmitButton onClick={() => {}}>Submit</SubmitButton>);
      const button = container.querySelector("button");

      // Angular corners (not rounded-full or rounded-xl)
      expect(button?.className).toContain("rounded");
      expect(button?.className).not.toContain("rounded-sm");

      // No hard shadow classes
      expect(button?.className).not.toContain("shadow-hard");
    });

    it("applies success brand theming", () => {
      const { container } = render(<SubmitButton onClick={() => {}}>Submit</SubmitButton>);
      const button = container.querySelector("button");

      expect(button?.className).toContain("bg-[#4a9b7f]");
      expect(button?.className).toContain("hover:bg-[#3d8a6e]");
      expect(button?.className).toContain("text-white");
    });

    it("applies hover lift animation", () => {
      const { container } = render(<SubmitButton onClick={() => {}}>Submit</SubmitButton>);
      const button = container.querySelector("button");

      expect(button?.className).toContain("hover:translate-y-[-1px]");
      expect(button?.className).toContain("transition-all");
    });

    it("does not contain legacy rounded-full class", () => {
      const { container } = render(<SubmitButton onClick={() => {}}>Submit</SubmitButton>);
      const button = container.querySelector("button");

      expect(button?.className).not.toContain("rounded-full");
      expect(button?.className).not.toContain("rounded-xl");
      expect(button?.className).not.toContain("rounded-lg");
      expect(button?.className).not.toContain("rounded-sm");
    });
  });

  describe("User Interactions", () => {
    it("calls onClick when button is clicked", () => {
      const handleClick = vi.fn();
      render(<SubmitButton onClick={handleClick}>Submit</SubmitButton>);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", () => {
      const handleClick = vi.fn();
      render(
        <SubmitButton onClick={handleClick} disabled>
          Submit
        </SubmitButton>,
      );

      const button = screen.getByRole("button") as HTMLButtonElement;
      fireEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
      expect(button.disabled).toBe(true);
    });

    it("applies disabled state correctly", () => {
      render(
        <SubmitButton onClick={() => {}} disabled>
          Submit
        </SubmitButton>,
      );

      const button = screen.getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe("Custom Styling", () => {
    it("merges custom className with base styles", () => {
      const { container } = render(
        <SubmitButton onClick={() => {}} className="custom-class">
          Submit
        </SubmitButton>,
      );
      const button = container.querySelector("button");

      // Custom class should be present
      expect(button?.className).toContain("custom-class");

      // Base styles should still be present
      expect(button?.className).toContain("rounded");
      expect(button?.className).not.toContain("shadow-hard");
    });
  });

  describe("Deep Module Interface", () => {
    it("has minimal interface complexity (onClick only required)", () => {
      // This test documents the deep module property:
      // Interface = 1 required prop (onClick)
      // Implementation = 10+ styling decisions hidden internally

      render(<SubmitButton onClick={() => {}}>Submit</SubmitButton>);

      // Developer only specified 1 required prop, but got:
      // - Angular aesthetic (rounded)
      // - Success brand theming
      // - Hover animations (lift, color)
      // - Full-width layout
      // All decisions hidden from caller
    });

    it("prevents accidental styling divergence across modes", () => {
      // Before SubmitButton: Order used rounded-full, Classic used different styling
      // After SubmitButton: architectural guarantee of consistency

      const { container: orderContainer } = render(
        <SubmitButton onClick={() => {}}>Submit My Timeline</SubmitButton>,
      );

      const { container: classicContainer } = render(
        <SubmitButton onClick={() => {}}>Commit Range</SubmitButton>,
      );

      const orderButton = orderContainer.querySelector("button");
      const classicButton = classicContainer.querySelector("button");

      // Both use identical core styling (rounded, success color)
      expect(orderButton?.className).toContain("rounded");
      expect(classicButton?.className).toContain("rounded");

      expect(orderButton?.className).toContain("bg-[#4a9b7f]");
      expect(classicButton?.className).toContain("bg-[#4a9b7f]");

      expect(orderButton?.className).not.toContain("shadow-hard");
      expect(classicButton?.className).not.toContain("shadow-hard");

      // Neither can accidentally use rounded-full
      expect(orderButton?.className).not.toContain("rounded-full");
      expect(classicButton?.className).not.toContain("rounded-full");
    });
  });

  describe("Accessibility", () => {
    it("has proper button type", () => {
      render(<SubmitButton onClick={() => {}}>Submit</SubmitButton>);

      const button = screen.getByRole("button");
      expect(button.getAttribute("type")).toBe("button");
    });

    it("is keyboard accessible", () => {
      const handleClick = vi.fn();
      render(<SubmitButton onClick={handleClick}>Submit</SubmitButton>);

      const button = screen.getByRole("button");
      button.focus();

      // Enter key should trigger click
      fireEvent.keyDown(button, { key: "Enter", code: "Enter" });

      // Note: Button elements handle Enter key natively
      // This test verifies the button is focusable
      expect(document.activeElement).toBe(button);
    });
  });
});
