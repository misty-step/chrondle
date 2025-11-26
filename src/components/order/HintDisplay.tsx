"use client";

import { HintPanel } from "@/components/ui/HintPanel";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";

type HintType = OrderHint["type"];

interface HintDisplayProps {
  events: OrderEvent[];
  hints: OrderHint[];
  onRequestHint: (type: HintType) => void;
  disabledTypes?: Partial<Record<HintType, boolean>>;
  pendingType?: HintType | null;
  error?: string | null;
  className?: string;
}

/**
 * Backward-compatible wrapper for HintPanel deep module.
 *
 * **Historical Context:**
 * HintDisplay originally contained 390 lines of mobile/desktop responsive logic,
 * Accordion behavior, animation handling, and GameCard wrapping. This complexity
 * was extracted into the HintPanel deep module following Ousterhout's principles.
 *
 * **Current Role:**
 * Maintains backward compatibility for existing imports while delegating all
 * implementation to HintPanel. This allows gradual migration of call sites to
 * use HintPanel directly if desired.
 *
 * **Migration Path:**
 * Call sites can continue using HintDisplay or migrate to HintPanel directly:
 *
 * @example
 * // Current usage (backward compatible)
 * import { HintDisplay } from "@/components/order/HintDisplay";
 * <HintDisplay events={events} hints={hints} onRequestHint={requestHint} />
 *
 * @example
 * // Direct usage (preferred for new code)
 * import { HintPanel } from "@/components/ui/HintPanel";
 * <HintPanel events={events} hints={hints} onRequestHint={requestHint} />
 */
export function HintDisplay(props: HintDisplayProps) {
  return <HintPanel {...props} />;
}
