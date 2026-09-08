import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EraToggle, EraToggleWithLabel } from "../EraToggle";

describe("EraToggle", () => {
  function ControlledToggle() {
    const [era, setEra] = React.useState<"BC" | "AD">("AD");
    return <EraToggle value={era} onChange={setEra} />;
  }

  it("uses one tab stop and moves selection and focus together with arrow keys", () => {
    render(<ControlledToggle />);
    const bc = screen.getByRole("radio", { name: /^BC/ });
    const ad = screen.getByRole("radio", { name: /^AD/ });
    expect(ad.tabIndex).toBe(0);
    expect(bc.tabIndex).toBe(-1);
    ad.focus();
    fireEvent.keyDown(ad, { key: "ArrowLeft" });
    expect(bc).toHaveFocus();
    expect(bc).toBeChecked();
    expect(ad).not.toBeChecked();
    fireEvent.keyDown(bc, { key: "ArrowLeft" });
    expect(ad).toHaveFocus();
    expect(ad).toBeChecked();
  });

  it("clicking the selected radio does not toggle away from it", () => {
    render(<ControlledToggle />);
    const bc = screen.getByRole("radio", { name: /^BC/ });
    fireEvent.click(bc);
    fireEvent.click(bc);
    expect(bc).toBeChecked();
  });

  it("prevents pointer and keyboard selection while disabled", () => {
    const onChange = vi.fn();
    render(<EraToggle value="AD" onChange={onChange} disabled />);
    const bc = screen.getByRole("radio", { name: /^BC/ });
    expect(bc).toBeDisabled();
    fireEvent.click(bc);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowLeft" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("associates its visible label and explanatory text with the group", () => {
    render(
      <EraToggleWithLabel
        value="BC"
        onChange={vi.fn()}
        label="Start year era"
        description="Use BC for years before Christ."
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Start year era" })).toHaveAccessibleDescription(
      "Use BC for years before Christ.",
    );
  });
});
