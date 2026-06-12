import type { ElementType } from "react";
import { Crosshair, Shuffle, SquaresFour, Sword } from "@phosphor-icons/react";
import type { ModeKey } from "@/lib/modePreference";

/**
 * Canonical registry of game modes.
 *
 * Single source of truth for mode identity (label, route, icon, theme
 * classes). Surfaces with bespoke copy (e.g. the home gallery's long
 * descriptions and CTAs) keep that copy local but pull identity from here.
 * Adding a mode = one entry here + route + color tokens in globals.css.
 */
export interface ModeInfo {
  key: ModeKey;
  label: string;
  route: string;
  icon: ElementType;
  /** Short hook for compact surfaces (cross-promotion chips, lists) */
  tagline: string;
  /** Mode-tinted card surface (bg + text + border) */
  cardClass: string;
  /** Mode accent text color */
  accentClass: string;
}

export const MODES: Record<ModeKey, ModeInfo> = {
  classic: {
    key: "classic",
    label: "Classic",
    route: "/classic",
    icon: Crosshair,
    tagline: "Pin the year from six clues",
    cardClass: "bg-mode-classic-bg text-mode-classic-text border-mode-classic-accent/30",
    accentClass: "text-mode-classic-accent",
  },
  order: {
    key: "order",
    label: "Order",
    route: "/order",
    icon: Shuffle,
    tagline: "Sort today's timeline",
    cardClass: "bg-mode-order-bg text-mode-order-text border-mode-order-accent/30",
    accentClass: "text-mode-order-accent",
  },
  groups: {
    key: "groups",
    label: "Groups",
    route: "/groups",
    icon: SquaresFour,
    tagline: "Crack today's board",
    cardClass: "bg-mode-groups-bg text-mode-groups-text border-mode-groups-accent/30",
    accentClass: "text-mode-groups-accent",
  },
  duel: {
    key: "duel",
    label: "Duel",
    route: "/duel",
    icon: Sword,
    tagline: "Endless: which came first?",
    cardClass: "bg-mode-duel-bg text-mode-duel-text border-mode-duel-accent/30",
    accentClass: "text-mode-duel-accent",
  },
};

/** Display order across surfaces. */
export const MODE_ORDER: readonly ModeKey[] = ["classic", "order", "groups", "duel"];
