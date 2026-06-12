import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { DuelBoard } from "../DuelBoard";
import type { UseDuelGameReturn } from "@/hooks/useDuelGame";
import type { DuelRoundView } from "@/lib/duel/runReducer";

const MOTION_PROPS = new Set([
  "initial",
  "animate",
  "exit",
  "transition",
  "whileTap",
  "whileHover",
  "layout",
]);

vi.mock("motion/react", () => {
  const React = require("react");
  const strip = (props: Record<string, unknown>) => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (!MOTION_PROPS.has(key)) clean[key] = value;
    }
    return clean;
  };
  return {
    motion: new Proxy(
      {},
      {
        get:
          (_target, tag: string) =>
          ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
            React.createElement(tag, strip(props), children),
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

const shareMock = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/useWebShare", () => ({
  useWebShare: () => ({
    share: shareMock,
    canShare: true,
    shareMethod: "clipboard",
    isSharing: false,
  }),
}));

const ROUND: DuelRoundView = {
  roundIndex: 0,
  first: { id: "a", year: 1066, text: "Battle of Hastings" },
  second: { id: "b", year: 1492, text: "Columbus reaches the Americas" },
  gap: 426,
  tierLabel: "Novice",
};

function makeGame(overrides: Partial<UseDuelGameReturn> = {}): UseDuelGameReturn {
  return {
    status: "choosing",
    round: ROUND,
    streak: 0,
    bestStreak: 0,
    isNewBest: false,
    pick: null,
    wasCorrect: null,
    endReason: null,
    choose: vi.fn(),
    advance: vi.fn(),
    restart: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  shareMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DuelBoard — choosing", () => {
  it("shows the prompt and both events without revealing years", () => {
    render(<DuelBoard game={makeGame()} />);

    expect(screen.getByText("Which happened first?")).toBeInTheDocument();
    expect(screen.getByText("Battle of Hastings")).toBeInTheDocument();
    expect(screen.getByText("Columbus reaches the Americas")).toBeInTheDocument();
    expect(screen.queryByText(/1066/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1492/)).not.toBeInTheDocument();
  });

  it("reports the tapped slot", () => {
    const game = makeGame();
    render(<DuelBoard game={game} />);

    fireEvent.click(screen.getByRole("button", { name: "Battle of Hastings" }));
    expect(game.choose).toHaveBeenCalledWith("first");

    fireEvent.click(screen.getByRole("button", { name: "Columbus reaches the Americas" }));
    expect(game.choose).toHaveBeenCalledWith("second");
  });
});

describe("DuelBoard — correct reveal", () => {
  function correctGame(overrides: Partial<UseDuelGameReturn> = {}) {
    return makeGame({
      status: "revealed",
      pick: "first",
      wasCorrect: true,
      streak: 1,
      ...overrides,
    });
  }

  it("reveals both years and the gap", () => {
    render(<DuelBoard game={correctGame()} />);

    expect(screen.getByText("1066 AD")).toBeInTheDocument();
    expect(screen.getByText("1492 AD")).toBeInTheDocument();
    expect(screen.getByText("426 years apart")).toBeInTheDocument();
    expect(screen.getByText("Tap to continue")).toBeInTheDocument();
  });

  it("ignores further card taps once revealed", () => {
    const game = correctGame();
    render(<DuelBoard game={game} />);

    fireEvent.click(screen.getByRole("button", { name: /Battle of Hastings/ }));
    expect(game.choose).not.toHaveBeenCalled();
  });

  it("auto-advances after the reveal delay", () => {
    vi.useFakeTimers();
    const game = correctGame();
    render(<DuelBoard game={game} />);

    expect(game.advance).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(game.advance).toHaveBeenCalled();
  });

  it("advances immediately on tap", () => {
    const game = correctGame();
    render(<DuelBoard game={game} />);

    fireEvent.click(screen.getByText("Tap to continue"));
    expect(game.advance).toHaveBeenCalled();
  });
});

describe("DuelBoard — run over", () => {
  function lostGame(overrides: Partial<UseDuelGameReturn> = {}) {
    return makeGame({
      status: "over",
      pick: "second",
      wasCorrect: false,
      endReason: "miss",
      streak: 7,
      bestStreak: 12,
      ...overrides,
    });
  }

  it("shows the final streak, gap context, and best run", () => {
    render(<DuelBoard game={lostGame()} />);

    const summary = screen.getByText("Run over").closest("section");
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText("7")).toBeInTheDocument();
    expect(screen.getByText("The gap was 426 years.")).toBeInTheDocument();
    expect(screen.getByText(/Best run:/)).toBeInTheDocument();
    expect(screen.queryByText("Which happened first?")).not.toBeInTheDocument();
  });

  it("celebrates a new personal best", () => {
    render(<DuelBoard game={lostGame({ streak: 13, bestStreak: 13, isNewBest: true })} />);
    expect(screen.getByText("New personal best")).toBeInTheDocument();
  });

  it("restarts the run from Play Again", () => {
    const game = lostGame();
    render(<DuelBoard game={game} />);

    fireEvent.click(screen.getByRole("button", { name: /Play Again/ }));
    expect(game.restart).toHaveBeenCalled();
  });

  it("shares the run summary", async () => {
    render(<DuelBoard game={lostGame()} />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(shareMock).toHaveBeenCalledWith(expect.stringContaining("Chrondle Duel"));
    expect(shareMock).toHaveBeenCalledWith(expect.stringContaining("⚔️ 7 in a row"));
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("offers the other modes", () => {
    render(<DuelBoard game={lostGame()} />);

    expect(screen.getByText("Keep playing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Classic/ })).toHaveAttribute("href", "/classic");
    expect(screen.getByRole("link", { name: /Order/ })).toHaveAttribute("href", "/order");
    expect(screen.queryByRole("link", { name: /Duel/ })).not.toBeInTheDocument();
  });
});

describe("DuelBoard — loading", () => {
  it("renders skeleton cards while awaiting rounds", () => {
    render(<DuelBoard game={makeGame({ status: "loading", round: null })} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("DuelBoard — BC years", () => {
  it("formats BC years in reveals", () => {
    const bcRound: DuelRoundView = {
      roundIndex: 3,
      first: { id: "x", year: -776, text: "First Olympic games" },
      second: { id: "y", year: -331, text: "Battle of Gaugamela" },
      gap: 445,
      tierLabel: "Apprentice",
    };
    render(
      <DuelBoard
        game={makeGame({
          status: "revealed",
          round: bcRound,
          pick: "first",
          wasCorrect: true,
          streak: 4,
        })}
      />,
    );

    expect(screen.getByText("776 BC")).toBeInTheDocument();
    expect(screen.getByText("331 BC")).toBeInTheDocument();
  });
});
