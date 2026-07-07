/**
 * Icon adapter (client components).
 *
 * The ONLY place allowed to import the icon vendor for client components.
 * Server components import from "./ssr" instead. Swapping icon vendors
 * means changing these two adapter files, not the whole tree.
 */
export * from "@phosphor-icons/react";
export { HelpIcon } from "./HelpIcon";
