/**
 * Unified share system — one module, one format family, three mode grammars.
 *
 * All share text ships through composeShareText's header/body/footer shape,
 * each mode's body expresses that mode's mechanic (Classic: range width +
 * contained/missed; Order: arrangement correctness; Duel: run length), and
 * the shared leakage suite (__tests__/leakage.test.ts) guards the no-spoiler
 * red line across every mode and outcome class.
 */

export { generateClassicShareText, type ClassicShareOptions } from "./classic";
export { generateOrderShareText, type OrderSharePayload } from "./order";
export { generateDuelShareText, type DuelShareInput } from "./duel";
export { SHARE_URL } from "./format";
