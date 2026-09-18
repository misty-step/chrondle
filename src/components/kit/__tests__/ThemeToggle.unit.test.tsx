import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionThemeProvider } from "@/components/SessionThemeProvider";
import { ThemeToggle } from "../ThemeToggle";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("light", "dark", "theme-loaded");
});

describe("ThemeToggle", () => {
  it("changes the displayed theme without losing keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <SessionThemeProvider>
        <ThemeToggle />
      </SessionThemeProvider>,
    );
    const button = screen.getByRole("button", { name: "Switch to dark theme" });

    await user.tab();
    await user.keyboard("[Enter]");
    expect(document.documentElement).toHaveClass("dark");
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName("Switch to light theme");

    await user.keyboard("[Space]");
    expect(document.documentElement).toHaveClass("light");
    expect(button).toHaveFocus();
  });
});
