import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RangeInput } from "../RangeInput";

const startInput = () => screen.getByRole("textbox", { name: "Start year" });
const endInput = () => screen.getByRole("textbox", { name: "End year" });
const submit = () => screen.getByRole("button", { name: /submit range/i });
const enterRange = (start: string, end: string) => {
  fireEvent.change(startInput(), { target: { value: start } });
  fireEvent.change(endInput(), { target: { value: end } });
};
const chooseEra = (field: "Start" | "End", era: "BC" | "AD") => {
  fireEvent.click(
    within(screen.getByRole("radiogroup", { name: `${field} year era` })).getByRole("radio", {
      name: new RegExp(`^${era}`),
    }),
  );
};

describe("RangeInput", () => {
  it("requires both years without suggesting a year or changing the other era", () => {
    render(<RangeInput onCommit={vi.fn()} />);
    expect(startInput()).toHaveValue("");
    expect(endInput()).toHaveValue("");
    fireEvent.change(startInput(), { target: { value: "500" } });
    chooseEra("Start", "BC");
    fireEvent.blur(startInput());
    expect(endInput()).toHaveValue("");
    expect(
      within(screen.getByRole("radiogroup", { name: "End year era" })).getByRole("radio", {
        name: /^AD/,
      }),
    ).toBeChecked();
    expect(submit()).toBeDisabled();
  });

  it("normalizes reversed BC endpoints only for submission, never rewriting the player's fields", async () => {
    const onCommit = vi.fn();
    render(<RangeInput onCommit={onCommit} />);
    chooseEra("Start", "BC");
    chooseEra("End", "BC");
    enterRange("400", "500");
    fireEvent.blur(endInput());
    expect(startInput()).toHaveValue("400");
    expect(endInput()).toHaveValue("500");
    fireEvent.click(submit());
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith({ start: -500, end: -400, hintsUsed: 0 }),
    );
    await waitFor(() => expect(startInput()).toHaveValue(""));
  });

  it("preserves an explicit range crossing BC and AD", async () => {
    const onCommit = vi.fn();
    render(<RangeInput onCommit={onCommit} hintsUsed={2} />);
    chooseEra("Start", "BC");
    enterRange("20", "30");
    fireEvent.click(submit());
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith({ start: -20, end: 30, hintsUsed: 2 }),
    );
  });

  it.each(["", "0", "19abc", "19.5", "9999"])(
    "never submits a previous valid year after replacement with %j",
    (replacement) => {
      const onCommit = vi.fn();
      render(<RangeInput onCommit={onCommit} />);
      enterRange("1900", "1949");
      expect(submit()).toBeEnabled();
      fireEvent.change(endInput(), { target: { value: replacement } });
      fireEvent.blur(endInput());
      expect(endInput()).toHaveValue(replacement);
      expect(submit()).toBeDisabled();
      fireEvent.click(submit());
      expect(onCommit).not.toHaveBeenCalled();
    },
  );

  it("accepts the width boundary and rejects the next year using the real scoring curve", () => {
    render(<RangeInput onCommit={vi.fn()} />);
    enterRange("1900", "1949");
    expect(screen.getByText("96")).toBeInTheDocument();
    enterRange("1700", "1949");
    expect(submit()).toBeEnabled();
    expect(screen.getByText("4")).toBeInTheDocument();
    fireEvent.change(endInput(), { target: { value: "1950" } });
    expect(submit()).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("updates potential points for hints without changing the range", () => {
    const onCommit = vi.fn();
    const { rerender } = render(<RangeInput onCommit={onCommit} />);
    enterRange("1900", "1949");
    rerender(<RangeInput onCommit={onCommit} hintsUsed={3} />);
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(startInput()).toHaveValue("1900");
    expect(endInput()).toHaveValue("1949");
  });

  it("moves through fields with Enter without accidentally spending the one guess", () => {
    const onCommit = vi.fn();
    render(<RangeInput onCommit={onCommit} />);
    enterRange("1969", "1969");
    startInput().focus();
    fireEvent.keyDown(startInput(), { key: "Enter" });
    expect(endInput()).toHaveFocus();
    fireEvent.keyDown(endInput(), { key: "Enter" });
    expect(submit()).toHaveFocus();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("keeps the editable draft through controlled updates and respects an external reset", () => {
    function Controlled() {
      const [range, setRange] = React.useState<[number, number]>([0, 0]);
      return (
        <>
          <RangeInput value={range} onChange={setRange} onCommit={vi.fn()} />
          <button onClick={() => setRange([0, 0])}>Reset puzzle</button>
        </>
      );
    }
    render(<Controlled />);
    enterRange("1949", "1900");
    expect(startInput()).toHaveValue("1949");
    expect(endInput()).toHaveValue("1900");
    fireEvent.click(screen.getByRole("button", { name: "Reset puzzle" }));
    expect(startInput()).toHaveValue("");
    expect(endInput()).toHaveValue("");
    expect(submit()).toBeDisabled();
  });

  it("keeps the guess for retry and prevents duplicate submissions while saving", async () => {
    let finish!: (saved: boolean) => void;
    const onCommit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    render(<RangeInput onCommit={onCommit} />);
    enterRange("1900", "1949");
    fireEvent.click(submit());
    const saving = screen.getByRole("button", { name: /saving/i });
    fireEvent.click(saving);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(startInput()).toBeDisabled();
    await act(async () => finish(false));
    expect(startInput()).toHaveValue("1900");
    expect(endInput()).toHaveValue("1949");
    expect(submit()).toBeEnabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
