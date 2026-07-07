/**
 * Chrondle share-text system.
 *
 * One module, three mode adapters (classic/order/duel), one shared
 * header/footer format family (format.ts) and one shared spoiler-safety
 * invariant asserted in __tests__/leakage.test.ts. See the Powder card
 * chrondle-ux-share-unification for the consolidation rationale.
 */

export { CHRONDLE_URL, buildShareHeader, buildShareText } from "./format";

export { generateClassicShareText } from "./classic";
export type { ClassicShareOptions } from "./classic";

export { generateOrderShareText } from "./order";
export type { OrderShareInput } from "./order";

export { generateDuelShareText } from "./duel";
export type { DuelShareInput } from "./duel";
