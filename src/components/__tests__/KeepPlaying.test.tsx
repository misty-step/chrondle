import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { KeepPlaying } from "../KeepPlaying";
import { useTodayModeStatus } from "@/hooks/useTodayModeStatus";

vi.mock("@/hooks/useTodayModeStatus", () => ({
  useTodayModeStatus: vi.fn(),
}));

vi.mock("@/lib/modePreference", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/modePreference")>();
  return { ...original, setModePreferenceCookie: vi.fn() };
});

vi.mock("@/components/kit/icons", () => ({
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="check-icon" {...props} />,
  Crosshair: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  Shuffle: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  Sword: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

describe("KeepPlaying (today's checklist)", () => {
  beforeEach(() => {
    vi.mocked(useTodayModeStatus).mockReturnValue({
      classic: "done",
      order: "todo",
      duel: "endless",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("excludes the mode just played and links to the others", () => {
    render(<KeepPlaying currentMode="classic" />);

    expect(screen.queryByRole("link", { name: /classic/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /order/i })).toHaveAttribute("href", "/order");
    expect(screen.getByRole("link", { name: /duel/i })).toHaveAttribute("href", "/duel");
  });

  it("carries per-mode today-state so the strip reads as a checklist", () => {
    render(<KeepPlaying currentMode="duel" />);

    expect(screen.getByRole("link", { name: /classic/i })).toHaveTextContent("Done today");
    expect(screen.getByRole("link", { name: /order/i })).toHaveTextContent("Not played today");
  });

  it("labels Duel as endless rather than a daily checkbox", () => {
    render(<KeepPlaying currentMode="classic" />);

    expect(screen.getByRole("link", { name: /duel/i })).toHaveTextContent("Endless");
  });

  it("shows no badge while a mode's today-state is unresolved", () => {
    vi.mocked(useTodayModeStatus).mockReturnValue({
      classic: "unknown",
      order: "unknown",
      duel: "endless",
    });
    render(<KeepPlaying currentMode="duel" />);

    const classicChip = screen.getByRole("link", { name: /classic/i });
    expect(classicChip).not.toHaveTextContent("Done today");
    expect(classicChip).not.toHaveTextContent("Not played today");
  });
});
