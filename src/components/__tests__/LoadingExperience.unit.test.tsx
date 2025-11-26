import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LoadingShell as LoadingExperience } from "../LoadingShell";

describe("LoadingExperience", () => {
  it("renders message and semantic wrappers", () => {
    render(<LoadingExperience intent="order" stage="fetching" message="Loading Order puzzle…" />);

    expect(screen.getByText("Loading Order puzzle…")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main.className).toContain("bg-background");
    expect(main.className).toContain("text-foreground");
  });

  it("shows stage label", () => {
    render(<LoadingExperience intent="generic" stage="hydrating" message="Please wait..." />);
    expect(screen.getByText(/Preparing the ledger/i)).toBeInTheDocument();
  });
});
