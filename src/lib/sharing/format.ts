import { siteConfig } from "@/lib/site";

/**
 * Shared share-text format family.
 *
 * Every Chrondle mode (Classic, Order) shares one visual identity for
 * its share artifact: a header line, a blank line, mode-specific body lines
 * expressing that mode's mechanic, a blank line, and a URL footer. Modes
 * differ in body grammar (see classic.ts / order.ts) but never in
 * this outer shape — that consistency is the "format family" this ticket
 * unifies around.
 */

export const CHRONDLE_URL = siteConfig.url;
export const SHARE_PITCH = siteConfig.description;

/**
 * Builds the shared header: "Chrondle", optionally suffixed with a mode
 * label and/or a puzzle number.
 *
 * - Classic (no mode label, daily puzzle number): "Chrondle #347"
 * - Order (mode label + daily puzzle number): "Chrondle Order #247"
 */
export function buildShareHeader(modeLabel: string | null, puzzleNumber?: number): string {
  const mode = modeLabel ? ` ${modeLabel}` : "";
  const number = typeof puzzleNumber === "number" ? ` #${puzzleNumber}` : "";
  return `Chrondle${mode}${number}`;
}

/**
 * Assembles the final share text from a header and mode-specific body
 * lines, wrapping the body in the shared blank-line/footer envelope.
 */
export function buildShareText(
  header: string,
  bodyLines: string[],
  url: string = CHRONDLE_URL,
): string {
  if (bodyLines.length === 0) {
    return [header, "", SHARE_PITCH, url].join("\n");
  }

  return [header, "", ...bodyLines, "", SHARE_PITCH, url].join("\n");
}
