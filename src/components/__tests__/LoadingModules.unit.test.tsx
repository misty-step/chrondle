import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LoadingScreen } from "../LoadingScreen";
import { LoadingShell as LoadingExperience, LoadingShell } from "../LoadingShell";

describe("Loading modules", () => {
  it("LoadingExperience renders minimal loader and progress bar", () => {
    const { container } = render(
      <LoadingExperience
        intent="generic"
        stage="fetching"
        message="Loading…"
        subMessage="Please wait"
      />,
    );

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    // Progress bar exists
    const bar = container.querySelector(".h-1\\.5");
    expect(bar).toBeTruthy();
  });

  it("LoadingScreen delays rendering unless ready", () => {
    render(<LoadingScreen intent="generic" stage="fetching" message="Delayed" delayMs={0} />);
    expect(screen.getByText("Delayed")).toBeInTheDocument();
  });

  it("LoadingShell renders on server-safe path", () => {
    render(<LoadingShell intent="generic" stage="fetching" message="Shell" />);
    expect(screen.getByText("Shell")).toBeInTheDocument();
  });
});
