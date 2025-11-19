import type { OrderHint } from "@/types/orderGameState";

export type LockedPositions = Map<string, number>;

export interface OrderEngineState {
  ordering: string[];
  locks: LockedPositions;
}

export type OrderEngineAction =
  | { type: "hydrate"; ordering?: string[]; hints?: OrderHint[] }
  | { type: "move"; eventId: string; targetIndex: number }
  | { type: "apply-hint"; hint: OrderHint; correctOrder: string[] };

export interface OrderEngineContext {
  baseline: string[];
}

export function initializeOrderState(
  context: OrderEngineContext,
  ordering: string[],
  hints: OrderHint[],
): OrderEngineState {
  const locks = deriveLockedPositions(hints);
  const normalized = normalizeOrdering(ordering, context.baseline);
  const orderingWithLocks = enforceLocks(normalized, locks, context.baseline.length);
  return { ordering: orderingWithLocks, locks };
}

export function reduceOrderState(
  context: OrderEngineContext,
  state: OrderEngineState,
  action: OrderEngineAction,
): OrderEngineState {
  switch (action.type) {
    case "hydrate": {
      const nextLocks = action.hints ? deriveLockedPositions(action.hints) : state.locks;
      const normalized = normalizeOrdering(action.ordering ?? state.ordering, context.baseline);
      const orderingWithLocks = enforceLocks(normalized, nextLocks, context.baseline.length);
      return {
        ordering: orderingWithLocks,
        locks: nextLocks,
      };
    }
    case "move": {
      const ordering = applyMove(state.ordering, action.eventId, action.targetIndex, state.locks);
      const orderingWithLocks = enforceLocks(ordering, state.locks, context.baseline.length);
      return {
        ordering: orderingWithLocks,
        locks: state.locks,
      };
    }
    case "apply-hint": {
      if (action.hint.type !== "anchor") {
        return state;
      }
      const nextLocks = new Map(state.locks);
      nextLocks.set(action.hint.eventId, action.hint.position);
      const orderingWithLocks = enforceLocks(state.ordering, nextLocks, context.baseline.length);
      return {
        ordering: orderingWithLocks,
        locks: nextLocks,
      };
    }
    default: {
      return state;
    }
  }
}

export function deriveLockedPositions(hints: OrderHint[]): LockedPositions {
  const positions = new Map<string, number>();
  for (const hint of hints) {
    if (hint.type === "anchor") {
      positions.set(hint.eventId, hint.position);
    }
  }
  return positions;
}

export function enforceLocks(ordering: string[], locks: LockedPositions, size: number): string[] {
  if (!locks.size) {
    return ordering.slice(0, size);
  }

  const result = ordering.slice(0, size);
  const sortedLocks = [...locks.entries()].sort(([, posA], [, posB]) => posA - posB);

  for (const [eventId, lockedIndex] of sortedLocks) {
    const currentIndex = result.indexOf(eventId);
    if (currentIndex === -1) {
      continue;
    }

    if (currentIndex === lockedIndex) {
      continue;
    }

    const [removed] = result.splice(currentIndex, 1);
    result.splice(clampIndex(lockedIndex, size), 0, removed);
  }

  return result;
}

export function normalizeOrdering(ordering: string[], baseline: string[]): string[] {
  if (!baseline.length) {
    return ordering.slice();
  }

  const validIds = new Set(baseline);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of ordering) {
    if (validIds.has(id) && !seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  for (const id of baseline) {
    if (!seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  return normalized;
}

function applyMove(
  ordering: string[],
  eventId: string,
  targetIndex: number,
  locks: LockedPositions,
): string[] {
  if (locks.has(eventId)) {
    return ordering;
  }

  const unlocked = ordering.filter((id) => !locks.has(id));
  const currentUnlockedIndex = unlocked.indexOf(eventId);
  if (currentUnlockedIndex === -1) {
    return ordering;
  }

  const positionLocks = invertLocks(locks);
  const visibleTarget = clampIndex(targetIndex, ordering.length);
  const lockedBeforeTarget = countLocksBefore(visibleTarget, positionLocks);
  const targetLocked = positionLocks.has(visibleTarget);
  const unlockedTarget = clampIndex(
    visibleTarget - lockedBeforeTarget - (targetLocked ? 1 : 0),
    unlocked.length,
  );

  const nextUnlocked = arrayMoveImmutable(unlocked, currentUnlockedIndex, unlockedTarget);
  return rebuildOrdering(nextUnlocked, positionLocks, ordering.length);
}

function invertLocks(locks: LockedPositions): Map<number, string> {
  const inverted = new Map<number, string>();
  for (const [eventId, index] of locks.entries()) {
    inverted.set(index, eventId);
  }
  return inverted;
}

function countLocksBefore(index: number, positionLocks: Map<number, string>): number {
  let count = 0;
  for (const lockedIndex of positionLocks.keys()) {
    if (lockedIndex < index) {
      count += 1;
    }
  }
  return count;
}

function rebuildOrdering(
  unlocked: string[],
  positionLocks: Map<number, string>,
  size: number,
): string[] {
  const result: string[] = [];
  let unlockedCursor = 0;
  for (let i = 0; i < size; i++) {
    const lockedEvent = positionLocks.get(i);
    if (lockedEvent) {
      result.push(lockedEvent);
      continue;
    }

    const nextUnlocked = unlocked[unlockedCursor];
    if (nextUnlocked) {
      result.push(nextUnlocked);
      unlockedCursor += 1;
    }
  }

  return result;
}

function arrayMoveImmutable<T>(items: T[], from: number, to: number): T[] {
  if (from === to) {
    return items.slice();
  }

  const copy = items.slice();
  const [removed] = copy.splice(from, 1);
  copy.splice(to, 0, removed);
  return copy;
}

function clampIndex(index: number, size: number): number {
  if (Number.isNaN(index)) return 0;
  return Math.max(0, Math.min(size - 1, index));
}

export function selectOrdering(state: OrderEngineState): string[] {
  return state.ordering.slice();
}
