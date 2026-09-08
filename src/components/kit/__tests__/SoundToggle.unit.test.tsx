import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SoundToggle } from "../SoundToggle";
import { sound } from "@/lib/sound/soundEngine";

const STORAGE_KEY = "chrondle_sound_enabled";

beforeEach(() => {
  sound.setEnabled(false);
});

afterEach(() => {
  cleanup();
  sound.setEnabled(false);
});

describe("SoundToggle", () => {
  it("keeps every toggle synchronized and preserves focus through keyboard activation", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SoundToggle />
        <SoundToggle />
      </>,
    );
    const [first, second] = screen.getAllByRole("button", { name: "Sound effects" });
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "false");

    await user.tab();
    await user.keyboard("[Space]");
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");

    await user.tab();
    await user.keyboard("[Enter]");
    expect(second).toHaveFocus();
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "false");
  });

  it("updates visible controls when another tab changes or clears the preference", () => {
    render(<SoundToggle />);
    const button = screen.getByRole("button", { name: "Sound effects" });

    act(() => {
      window.localStorage.setItem(STORAGE_KEY, "true");
      // The test environment replaces Storage, so attach its storageArea to a plain event.
      window.dispatchEvent(
        Object.assign(new Event("storage"), {
          key: STORAGE_KEY,
          storageArea: window.localStorage,
        }),
      );
    });
    expect(button).toHaveAttribute("aria-pressed", "true");

    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(
        Object.assign(new Event("storage"), {
          key: null,
          storageArea: window.localStorage,
        }),
      );
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
