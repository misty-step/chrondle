import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGameActions } from "../useGameActions";
import { useLocalSession } from "@/hooks/data/useLocalSession";
import { assertConvexId } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { readLocalGameState } from "@/lib/gameDataStore";

const mutation = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const report = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useMutation: () => mutation }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ addToast: toast }) }));
vi.mock("@/observability/reporter", () => ({ captureClientException: report }));
const puzzleId = assertConvexId("a".repeat(32), "puzzles");

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function renderGame(authenticated = true) {
  return renderHook(() => {
    const session = useLocalSession(puzzleId, authenticated, 2000);
    const actions = useGameActions({
      puzzle: {
        puzzle: { id: puzzleId, targetYear: 2000, events: [], puzzleNumber: 42 },
        isLoading: false,
        error: null,
      },
      auth: {
        isAuthenticated: authenticated,
        userId: authenticated ? "b".repeat(32) : null,
        isLoading: false,
      },
      progress: { progress: null, isLoading: false },
      session,
    });
    return { session, actions };
  });
}

async function submit(result: ReturnType<typeof renderGame>["result"]) {
  let accepted: boolean | undefined;
  await act(async () => {
    const pending = result.current.actions.submitRange({ start: 1990, end: 2010, hintsUsed: 1 });
    await vi.runAllTimersAsync();
    accepted = await pending;
  });
  return accepted;
}

it("reports terminal failure once after all retries without claiming durable saving or exposing content", async () => {
  mutation.mockRejectedValue(new Error("network private-account private-puzzle range=1990:2010"));
  const { result } = renderGame();
  expect(await submit(result)).toBe(false);
  expect(result.current.session.sessionRanges).toEqual([]);
  expect(readLocalGameState(puzzleId)).toBeNull();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ description: expect.not.stringMatching(/saved locally/i) }),
  );
  expect(mutation).toHaveBeenCalledTimes(4);
  expect(report).toHaveBeenCalledTimes(1);
  const [error, context] = report.mock.calls[0];
  expect(error.message).toBe("Classic submission encountered an error");
  expect(context).toEqual({
    tags: { source: "classic_submission", action: "submitRange", stage: "save" },
  });
  expect(JSON.stringify(report.mock.calls)).not.toMatch(
    /private-account|private-puzzle|1990|2010|aaaaaaaa|bbbbbbbb/,
  );
});

it("retains a successful range after a transient retry", async () => {
  mutation.mockRejectedValueOnce(new Error("network")).mockResolvedValue({});
  const { result } = renderGame();
  expect(await submit(result)).toBe(true);
  expect(result.current.session.sessionRanges).toHaveLength(1);
  expect(mutation).toHaveBeenCalledTimes(2);
  expect(report).not.toHaveBeenCalled();
});

it("does not roll back or retry an accepted range when outcome logging throws", async () => {
  mutation.mockResolvedValue({});
  vi.spyOn(console, "info").mockImplementation(() => {
    throw new Error("telemetry failed");
  });
  const { result } = renderGame();
  expect(await submit(result)).toBe(true);
  expect(result.current.session.sessionRanges).toHaveLength(1);
  expect(mutation).toHaveBeenCalledTimes(1);
  expect(toast).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ tags: expect.objectContaining({ stage: "after_save" }) }),
  );
});

it("still returns the failed outcome if error reporting throws", async () => {
  mutation.mockRejectedValue(new Error("network"));
  report.mockImplementation(() => {
    throw new Error("reporter failed");
  });
  const { result } = renderGame();
  expect(await submit(result)).toBe(false);
  expect(result.current.session.sessionRanges).toEqual([]);
});

it("retains a durably accepted anonymous range when submission logging throws", async () => {
  vi.spyOn(console, "info").mockImplementation(() => {
    throw new Error("logging failed");
  });
  const { result } = renderGame(false);
  expect(await submit(result)).toBe(true);
  expect(readLocalGameState(puzzleId)?.ranges).toHaveLength(1);
  expect(result.current.session.sessionRanges).toHaveLength(1);
  expect(mutation).not.toHaveBeenCalled();
});

it("never retries a successful retry because development success logging throws", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.spyOn(logger, "info").mockImplementation(() => {
    throw new Error("network logging failed");
  });
  mutation.mockRejectedValueOnce(new Error("network")).mockResolvedValue({});
  const { result } = renderGame();
  expect(await submit(result)).toBe(true);
  expect(result.current.session.sessionRanges).toHaveLength(1);
  expect(mutation).toHaveBeenCalledTimes(2);
});
