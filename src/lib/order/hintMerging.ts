import type { OrderHint } from "@/types/orderGameState";

export function mergeHints(serverHints: OrderHint[], sessionHints: OrderHint[]): OrderHint[] {
  const serialized = new Set(serverHints.map(serializeHint));
  const merged = [...serverHints];

  for (const hint of sessionHints) {
    const key = serializeHint(hint);
    if (!serialized.has(key)) {
      serialized.add(key);
      merged.push(hint);
    }
  }

  return merged;
}

export function serializeHint(hint: OrderHint): string {
  switch (hint.type) {
    case "anchor":
      return `anchor:${hint.eventId}:${hint.position}`;
    case "relative":
      return `relative:${hint.earlierEventId}:${hint.laterEventId}`;
    case "bracket":
      return `bracket:${hint.eventId}:${hint.yearRange[0]}-${hint.yearRange[1]}`;
    default:
      return JSON.stringify(hint);
  }
}
