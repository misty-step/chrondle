import { describe, it, expect } from "vitest";
import { deriveDailyModeStatus } from "../todayModeStatus";

describe("deriveDailyModeStatus", () => {
  it("is unknown while today's puzzle is unresolved", () => {
    expect(
      deriveDailyModeStatus({
        puzzleId: null,
        isAuthenticated: false,
        serverCompleted: null,
        localCompleted: false,
      }),
    ).toBe("unknown");
  });

  describe("signed-in players (server plays are the truth)", () => {
    it("is unknown while the server play is loading", () => {
      expect(
        deriveDailyModeStatus({
          puzzleId: "p1",
          isAuthenticated: true,
          serverCompleted: null,
          localCompleted: false,
        }),
      ).toBe("unknown");
    });

    it("is done when the server play is completed", () => {
      expect(
        deriveDailyModeStatus({
          puzzleId: "p1",
          isAuthenticated: true,
          serverCompleted: true,
          localCompleted: false,
        }),
      ).toBe("done");
    });

    it("is todo when the server play is absent or incomplete", () => {
      expect(
        deriveDailyModeStatus({
          puzzleId: "p1",
          isAuthenticated: true,
          serverCompleted: false,
          localCompleted: true, // stale local state must not win for signed-in
        }),
      ).toBe("todo");
    });
  });

  describe("anonymous players (local session is the truth)", () => {
    it("is done when today's local session is complete", () => {
      expect(
        deriveDailyModeStatus({
          puzzleId: "p1",
          isAuthenticated: false,
          serverCompleted: null,
          localCompleted: true,
        }),
      ).toBe("done");
    });

    it("is todo otherwise", () => {
      expect(
        deriveDailyModeStatus({
          puzzleId: "p1",
          isAuthenticated: false,
          serverCompleted: null,
          localCompleted: false,
        }),
      ).toBe("todo");
    });
  });
});
