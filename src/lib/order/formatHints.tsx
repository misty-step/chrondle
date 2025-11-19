import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";

/**
 * Formats relative hint text with visual hierarchy for readability.
 *
 * Following Ousterhout's information hiding principle: encapsulates the
 * presentation logic for relative hints in one place.
 *
 * @param hint - The relative hint to format
 * @param eventsById - Map of event IDs to event objects
 * @returns JSX with styled event names and relationship text
 */
export function formatRelativeHintText(
  hint: Extract<OrderHint, { type: "relative" }>,
  eventsById: Map<string, OrderEvent>,
): ReactNode {
  const earlierEvent = eventsById.get(hint.earlierEventId);
  const laterEvent = eventsById.get(hint.laterEventId);

  const earlierName = earlierEvent?.text ?? "Unknown event";
  const laterName = laterEvent?.text ?? "Unknown event";

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-primary font-semibold">{earlierName}</span>
      <span className="text-muted-foreground inline-flex items-center gap-1 italic">
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
        happens before
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </span>
      <span className="text-primary font-semibold">{laterName}</span>
    </span>
  );
}

/**
 * Formats relative hint text as a concise inline summary.
 * Used for compact displays where full event text would be too long.
 *
 * @param hint - The relative hint to format
 * @param eventsById - Map of event IDs to event objects
 * @returns Plain string with arrow notation
 */
export function formatRelativeHintShort(
  hint: Extract<OrderHint, { type: "relative" }>,
  eventsById: Map<string, OrderEvent>,
): string {
  const earlierEvent = eventsById.get(hint.earlierEventId);
  const laterEvent = eventsById.get(hint.laterEventId);

  const earlierName = earlierEvent?.text ?? "Unknown";
  const laterName = laterEvent?.text ?? "Unknown";

  // Truncate long event names for compact display
  const truncate = (text: string, maxLength: number = 30) =>
    text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

  return `${truncate(earlierName)} → before → ${truncate(laterName)}`;
}
