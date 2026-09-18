import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SubmitButton } from "../SubmitButton";

describe("SubmitButton", () => {
  it("activates once without submitting an enclosing form", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <SubmitButton onClick={onClick}>Submit timeline</SubmitButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit timeline" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not activate while disabled", () => {
    const onClick = vi.fn();
    render(
      <SubmitButton onClick={onClick} disabled>
        Submit timeline
      </SubmitButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit timeline" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
