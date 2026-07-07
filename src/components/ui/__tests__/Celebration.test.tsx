/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useReducedMotion } from "@/lib/animationConstants";
import { Celebration } from "../Celebration";

vi.mock("@/lib/animationConstants", () => ({
  useReducedMotion: vi.fn(),
}));

describe("Celebration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function triggerCelebration() {
    act(() => {
      window.dispatchEvent(new CustomEvent("chrondle:celebrate"));
    });
  }

  it("renders confetti particles when active and motion is allowed", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);

    const { container } = render(<Celebration duration={3000} />);
    triggerCelebration();

    const celebrationContainer = container.querySelector(".celebration-container");
    expect(celebrationContainer).toBeInTheDocument();
    expect(celebrationContainer?.querySelectorAll(".confetti").length).toBe(50);
  });

  it("disables confetti particles when the user prefers reduced motion", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);

    const { container } = render(<Celebration duration={3000} />);
    triggerCelebration();

    expect(container.querySelector(".celebration-container")).toBeNull();
    expect(container.querySelector(".confetti")).toBeNull();
  });

  it("does not render anything before being triggered", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);

    const { container } = render(<Celebration duration={3000} />);
    expect(container.querySelector(".celebration-container")).toBeNull();
  });
});
