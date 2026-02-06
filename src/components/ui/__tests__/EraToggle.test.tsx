import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EraToggle, EraToggleWithLabel } from "../EraToggle";
// Era type no longer needed after simplifying mock

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => ({
  motion: {
    button: ({
      children,
      type,
      ...props
    }: React.HTMLProps<HTMLButtonElement> & {
      whileTap?: unknown;
      animate?: unknown;
      transition?: unknown;
      type?: "button" | "submit" | "reset";
    }) => (
      <button type={type} {...props}>
        {children}
      </button>
    ),
  },
  useReducedMotion: () => false,
}));

describe("EraToggle", () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  describe("Basic Rendering", () => {
    it("renders BC and AD buttons", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      expect(screen.getByRole("radio", { name: /BC/i })).toBeTruthy();
      expect(screen.getByRole("radio", { name: /AD/i })).toBeTruthy();
    });

    it("displays correct active state for BC", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const bcButton = screen.getByRole("radio", { name: /BC/i });
      const adButton = screen.getByRole("radio", { name: /AD/i });

      expect(bcButton.getAttribute("aria-checked")).toBe("true");
      expect(adButton.getAttribute("aria-checked")).toBe("false");
    });

    it("displays correct active state for AD", () => {
      render(<EraToggle value="AD" onChange={mockOnChange} />);

      const bcButton = screen.getByRole("radio", { name: /BC/i });
      const adButton = screen.getByRole("radio", { name: /AD/i });

      expect(bcButton.getAttribute("aria-checked")).toBe("false");
      expect(adButton.getAttribute("aria-checked")).toBe("true");
    });
  });

  describe("User Interactions", () => {
    it("calls onChange when clicking BC button", () => {
      render(<EraToggle value="AD" onChange={mockOnChange} />);

      const bcButton = screen.getByRole("radio", { name: /BC/i });
      fireEvent.click(bcButton);

      expect(mockOnChange).toHaveBeenCalledWith("BC");
    });

    it("calls onChange when clicking AD button", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const adButton = screen.getByRole("radio", { name: /AD/i });
      fireEvent.click(adButton);

      expect(mockOnChange).toHaveBeenCalledWith("AD");
    });

    it("does not call onChange when clicking already active button", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const bcButton = screen.getByRole("radio", { name: /BC/i });
      fireEvent.click(bcButton);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe("Keyboard Navigation", () => {
    it("switches to BC with ArrowLeft when AD is selected", () => {
      render(<EraToggle value="AD" onChange={mockOnChange} />);

      const container = screen.getByRole("radiogroup");
      fireEvent.keyDown(container, { key: "ArrowLeft" });

      expect(mockOnChange).toHaveBeenCalledWith("BC");
    });

    it("switches to BC with ArrowUp when AD is selected", () => {
      render(<EraToggle value="AD" onChange={mockOnChange} />);

      const container = screen.getByRole("radiogroup");
      fireEvent.keyDown(container, { key: "ArrowUp" });

      expect(mockOnChange).toHaveBeenCalledWith("BC");
    });

    it("switches to AD with ArrowRight when BC is selected", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const container = screen.getByRole("radiogroup");
      fireEvent.keyDown(container, { key: "ArrowRight" });

      expect(mockOnChange).toHaveBeenCalledWith("AD");
    });

    it("switches to AD with ArrowDown when BC is selected", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const container = screen.getByRole("radiogroup");
      fireEvent.keyDown(container, { key: "ArrowDown" });

      expect(mockOnChange).toHaveBeenCalledWith("AD");
    });

    it("toggles era with Space key", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const container = screen.getByRole("radiogroup");
      fireEvent.keyDown(container, { key: " " });

      expect(mockOnChange).toHaveBeenCalledWith("AD");
    });

    it("toggles era with Enter key", () => {
      render(<EraToggle value="AD" onChange={mockOnChange} />);

      const container = screen.getByRole("radiogroup");
      fireEvent.keyDown(container, { key: "Enter" });

      expect(mockOnChange).toHaveBeenCalledWith("BC");
    });

    it("does not change when pressing arrow keys at boundaries", () => {
      const { rerender } = render(<EraToggle value="BC" onChange={mockOnChange} />);

      const container = screen.getByRole("radiogroup");

      // BC is leftmost, ArrowLeft should do nothing
      fireEvent.keyDown(container, { key: "ArrowLeft" });
      expect(mockOnChange).not.toHaveBeenCalled();

      // BC is leftmost, ArrowUp should do nothing
      fireEvent.keyDown(container, { key: "ArrowUp" });
      expect(mockOnChange).not.toHaveBeenCalled();

      // Reset mock and test AD boundaries
      mockOnChange.mockClear();
      rerender(<EraToggle value="AD" onChange={mockOnChange} />);

      // AD is rightmost, ArrowRight should do nothing
      fireEvent.keyDown(container, { key: "ArrowRight" });
      expect(mockOnChange).not.toHaveBeenCalled();

      // AD is rightmost, ArrowDown should do nothing
      fireEvent.keyDown(container, { key: "ArrowDown" });
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("disables both buttons when disabled prop is true", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} disabled />);

      const bcButton = screen.getByRole("radio", {
        name: /BC/i,
      }) as HTMLButtonElement;
      const adButton = screen.getByRole("radio", {
        name: /AD/i,
      }) as HTMLButtonElement;

      expect(bcButton.disabled).toBe(true);
      expect(adButton.disabled).toBe(true);
    });

    it("does not respond to clicks when disabled", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} disabled />);

      const adButton = screen.getByRole("radio", { name: /AD/i });
      fireEvent.click(adButton);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("does not respond to keyboard navigation when disabled", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} disabled />);

      const container = screen.getByRole("radiogroup");

      fireEvent.keyDown(container, { key: "ArrowRight" });
      fireEvent.keyDown(container, { key: "ArrowLeft" });
      fireEvent.keyDown(container, { key: " " });
      fireEvent.keyDown(container, { key: "Enter" });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("sets aria-disabled on container when disabled", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} disabled />);

      const container = screen.getByRole("radiogroup");
      expect(container.getAttribute("aria-disabled")).toBe("true");
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA radiogroup role", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const container = screen.getByRole("radiogroup");
      expect(container.getAttribute("aria-label")).toBe("Select era: BC or AD");
    });

    it("has proper ARIA radio roles on buttons", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const bcButton = screen.getByRole("radio", { name: /BC/i });
      const adButton = screen.getByRole("radio", { name: /AD/i });

      expect(bcButton.getAttribute("role")).toBe("radio");
      expect(adButton.getAttribute("role")).toBe("radio");
    });

    it("updates aria-checked attributes correctly", () => {
      const { rerender } = render(<EraToggle value="BC" onChange={mockOnChange} />);

      const bcButton = screen.getByRole("radio", { name: /BC/i });
      const adButton = screen.getByRole("radio", { name: /AD/i });

      expect(bcButton.getAttribute("aria-checked")).toBe("true");
      expect(adButton.getAttribute("aria-checked")).toBe("false");

      rerender(<EraToggle value="AD" onChange={mockOnChange} />);

      expect(bcButton.getAttribute("aria-checked")).toBe("false");
      expect(adButton.getAttribute("aria-checked")).toBe("true");
    });

    it("does not have aria-labels on buttons when showLabels is true", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} showLabels />);

      const bcButton = screen.getByText("BC").closest("button");
      const adButton = screen.getByText("AD").closest("button");

      expect(bcButton?.getAttribute("aria-label")).toBe(null);
      expect(adButton?.getAttribute("aria-label")).toBe(null);
    });

    it("supports aria-describedby for additional context", () => {
      render(
        <>
          <EraToggle value="BC" onChange={mockOnChange} aria-describedby="era-description" />
          <p id="era-description">Choose between BC (Before Christ) or AD (Anno Domini)</p>
        </>,
      );

      const container = screen.getByRole("radiogroup");
      expect(container.getAttribute("aria-describedby")).toBe("era-description");
    });
  });

  describe("Variants", () => {
    it("applies size variant classes", () => {
      const { rerender } = render(<EraToggle value="BC" onChange={mockOnChange} size="sm" />);

      const smallButton = screen.getByRole("radio", { name: /BC/i });
      expect(smallButton.className).toContain("min-w-[2.5rem]");
      expect(smallButton.className).toContain("text-xs");

      rerender(<EraToggle value="BC" onChange={mockOnChange} size="lg" />);

      const largeButton = screen.getByRole("radio", { name: /BC/i });
      expect(largeButton.className).toContain("min-w-[3.5rem]");
      expect(largeButton.className).toContain("text-base");
    });

    it("applies width variant classes", () => {
      const { rerender, container } = render(
        <EraToggle value="BC" onChange={mockOnChange} width="auto" />,
      );

      expect(container.querySelector(".w-auto")).toBeTruthy();

      rerender(<EraToggle value="BC" onChange={mockOnChange} width="full" />);
      expect(container.querySelector(".w-full")).toBeTruthy();
    });

    it("applies custom className", () => {
      const { container } = render(
        <EraToggle value="BC" onChange={mockOnChange} className="custom-class" />,
      );

      expect(container.querySelector(".custom-class")).toBeTruthy();
    });
  });

  describe("Visual Feedback", () => {
    it("applies active variant styles to selected button", () => {
      render(<EraToggle value="BC" onChange={mockOnChange} />);

      const bcButton = screen.getByRole("radio", { name: /BC/i });
      const adButton = screen.getByRole("radio", { name: /AD/i });

      expect(bcButton.className).toContain("bg-[#4a9b7f]");
      expect(bcButton.className).toContain("text-white");
      expect(adButton.className).toContain("bg-white");
      expect(adButton.className).toContain("text-[#1a1a1b]");
    });

    it("switches visual states when value changes", () => {
      const { rerender } = render(<EraToggle value="BC" onChange={mockOnChange} />);

      const bcButton = screen.getByRole("radio", { name: /BC/i });
      const adButton = screen.getByRole("radio", { name: /AD/i });

      expect(bcButton.className).toContain("bg-[#4a9b7f]");
      expect(adButton.className).not.toContain("bg-[#4a9b7f]");

      rerender(<EraToggle value="AD" onChange={mockOnChange} />);

      expect(bcButton.className).not.toContain("bg-[#4a9b7f]");
      expect(adButton.className).toContain("bg-[#4a9b7f]");
    });
  });

  describe("EraToggleWithLabel", () => {
    it("renders with label", () => {
      render(<EraToggleWithLabel value="BC" onChange={mockOnChange} label="Select Era" />);

      expect(screen.getByText("Select Era")).toBeTruthy();
    });

    it("renders with description", () => {
      render(
        <EraToggleWithLabel
          value="BC"
          onChange={mockOnChange}
          description="Choose between BC and AD"
        />,
      );

      expect(screen.getByText("Choose between BC and AD")).toBeTruthy();
    });

    it("associates toggle with description via aria-describedby", () => {
      render(
        <EraToggleWithLabel
          value="BC"
          onChange={mockOnChange}
          description="Choose between BC and AD"
        />,
      );

      const container = screen.getByRole("radiogroup");
      const describedBy = container.getAttribute("aria-describedby");

      expect(describedBy).toBeTruthy();

      const description = document.getElementById(describedBy!);
      expect(description?.textContent).toBe("Choose between BC and AD");
    });

    it("passes through all props to EraToggle", () => {
      render(<EraToggleWithLabel value="AD" onChange={mockOnChange} disabled size="lg" />);

      const bcButton = screen.getByRole("radio", {
        name: /BC/i,
      }) as HTMLButtonElement;
      const adButton = screen.getByRole("radio", {
        name: /AD/i,
      }) as HTMLButtonElement;

      expect(bcButton.disabled).toBe(true);
      expect(adButton.disabled).toBe(true);
      expect(adButton.getAttribute("aria-checked")).toBe("true");
    });
  });
});
