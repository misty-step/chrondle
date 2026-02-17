# Chrondle Design Token System

> A comprehensive design token system for Chrondle — a daily history puzzle game with the clean, subtle aesthetic of NYT Games (Wordle, Connections, Strands).

## Overview

This design system prioritizes:

- **Subtle depth** through layered shadows (not color changes)
- **Clarity** through consistent interactive states
- **Accessibility** with sufficient contrast ratios
- **Flexibility** with mode-specific theming (Classic/Order)

---

## 1. Elevation System

Elevation creates visual hierarchy through subtle shadows. Unlike material design, NYT Games uses minimal, soft shadows that suggest depth without heavy chrome.

### Philosophy

- **Light mode**: Subtle Y-axis offset shadows with soft blur
- **Dark mode**: Even subtler shadows (darker surfaces absorb more shadow)
- **No elevation = no shadow**: Flat surfaces sit directly on the page

### Token Reference

| Token              | Usage                             | Light Mode                                                 | Dark Mode                                                 |
| ------------------ | --------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| `--elevation-0`    | Base surfaces, page background    | `none`                                                     | `none`                                                    |
| `--elevation-1`    | Cards, buttons, hint panels       | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`   | `0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)`    |
| `--elevation-2`    | Modals, dropdowns, elevated cards | `0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.04)`   | `0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)`   |
| `--elevation-3`    | Tooltips, popovers, floating UI   | `0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.04)`  | `0 8px 24px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.2)`   |
| `--elevation-drag` | Dragging state for sortable cards | `0 12px 32px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1)` | `0 12px 32px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.3)` |

### CSS Implementation

```css
:root {
  /* Elevation - Light Mode */
  --elevation-0: none;
  --elevation-1: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --elevation-2: 0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.04);
  --elevation-3: 0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.04);
  --elevation-drag: 0 12px 32px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1);
}

.dark {
  /* Elevation - Dark Mode (subtler) */
  --elevation-0: none;
  --elevation-1: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  --elevation-2: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2);
  --elevation-3: 0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.2);
  --elevation-drag: 0 12px 32px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.3);
}
```

### Tailwind 4 Theme Extension

```css
@theme {
  --shadow-elevation-0: var(--elevation-0);
  --shadow-elevation-1: var(--elevation-1);
  --shadow-elevation-2: var(--elevation-2);
  --shadow-elevation-3: var(--elevation-3);
  --shadow-drag: var(--elevation-drag);
}
```

### Usage Examples

```tsx
// Card with subtle elevation
<div className="shadow-elevation-1">

// Modal with raised elevation
<div className="shadow-elevation-2">

// Tooltip with floating elevation
<div className="shadow-elevation-3">

// Draggable card being dragged
<div className="shadow-drag">
```

---

## 2. Interactive States

Interactive states follow NYT Games patterns: subtle shifts that provide feedback without distraction.

### State Philosophy

- **Hover**: Slight elevation increase + optional background shift
- **Active**: Subtle press-in effect (inverse of hover)
- **Focus**: Ring outline for accessibility
- **Disabled**: Reduced opacity + no pointer events

### Button Variants

#### Primary Button (Classic Mode)

| State    | Background | Text         | Border        | Shadow        | Transform          |
| -------- | ---------- | ------------ | ------------- | ------------- | ------------------ |
| Default  | `#4a9b7f`  | `#ffffff`    | `transparent` | `elevation-1` | `translateY(0)`    |
| Hover    | `#3d8a6e`  | `#ffffff`    | `transparent` | `elevation-2` | `translateY(-1px)` |
| Active   | `#347a60`  | `#ffffff`    | `transparent` | `elevation-0` | `translateY(0)`    |
| Focus    | `#3d8a6e`  | `#ffffff`    | `transparent` | `elevation-1` | `translateY(0)`    |
| Disabled | `#4a9b7f`  | `#ffffff/50` | `transparent` | `none`        | `none`             |

#### Secondary Button (Outline)

| State    | Background    | Text      | Border    | Shadow        | Transform          |
| -------- | ------------- | --------- | --------- | ------------- | ------------------ |
| Default  | `transparent` | `#1a1a1b` | `#d3d6da` | `none`        | `translateY(0)`    |
| Hover    | `#f4f4f5`     | `#1a1a1b` | `#a1a1aa` | `elevation-1` | `translateY(-1px)` |
| Active   | `#e4e4e7`     | `#1a1a1b` | `#71717a` | `none`        | `translateY(0)`    |
| Focus    | `#f4f4f5`     | `#1a1a1b` | `#71717a` | `elevation-1` | `translateY(0)`    |
| Disabled | `transparent` | `#a1a1aa` | `#e4e4e7` | `none`        | `none`             |

#### Ghost Button

| State    | Background         | Text      | Border        | Shadow |
| -------- | ------------------ | --------- | ------------- | ------ |
| Default  | `transparent`      | `#1a1a1b` | `transparent` | `none` |
| Hover    | `rgba(0,0,0,0.05)` | `#1a1a1b` | `transparent` | `none` |
| Active   | `rgba(0,0,0,0.1)`  | `#1a1a1b` | `transparent` | `none` |
| Focus    | `rgba(0,0,0,0.05)` | `#1a1a1b` | `transparent` | `none` |
| Disabled | `transparent`      | `#a1a1aa` | `transparent` | `none` |

#### Destructive Button

| State    | Background   | Text         | Border        | Shadow        |
| -------- | ------------ | ------------ | ------------- | ------------- |
| Default  | `#b42318`    | `#ffffff`    | `transparent` | `elevation-1` |
| Hover    | `#991b1b`    | `#ffffff`    | `transparent` | `elevation-2` |
| Active   | `#7f1d1d`    | `#ffffff`    | `transparent` | `elevation-0` |
| Focus    | `#991b1b`    | `#ffffff`    | `transparent` | `elevation-1` |
| Disabled | `#b42318/50` | `#ffffff/50` | `transparent` | `none`        |

### Take Hint Button (Special)

The "Take Hint" button requires special attention for dark mode visibility.

| Mode  | State   | Background                                          | Border       | Shadow        |
| ----- | ------- | --------------------------------------------------- | ------------ | ------------- |
| Light | Default | `linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)` | `#d97706/50` | `elevation-1` |
| Light | Hover   | `linear-gradient(135deg, #fde68a 0%, #fcd34d 100%)` | `#b45309/50` | `elevation-2` |
| Dark  | Default | `linear-gradient(135deg, #78350f 0%, #92400e 100%)` | `#fbbf24/30` | `elevation-1` |
| Dark  | Hover   | `linear-gradient(135deg, #92400e 0%, #b45309 100%)` | `#fbbf24/50` | `elevation-2` |

### CSS Implementation

```css
:root {
  /* Primary Button */
  --btn-primary-bg: #4a9b7f;
  --btn-primary-bg-hover: #3d8a6e;
  --btn-primary-bg-active: #347a60;
  --btn-primary-text: #ffffff;
  --btn-primary-text-disabled: rgba(255, 255, 255, 0.5);

  /* Secondary Button */
  --btn-secondary-bg: transparent;
  --btn-secondary-bg-hover: #f4f4f5;
  --btn-secondary-bg-active: #e4e4e7;
  --btn-secondary-text: #1a1a1b;
  --btn-secondary-border: #d3d6da;
  --btn-secondary-border-hover: #a1a1aa;
  --btn-secondary-border-active: #71717a;

  /* Ghost Button */
  --btn-ghost-bg-hover: rgba(0, 0, 0, 0.05);
  --btn-ghost-bg-active: rgba(0, 0, 0, 0.1);

  /* Destructive Button */
  --btn-destructive-bg: #b42318;
  --btn-destructive-bg-hover: #991b1b;
  --btn-destructive-bg-active: #7f1d1d;

  /* Take Hint Button - Light */
  --hint-btn-bg: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  --hint-btn-bg-hover: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
  --hint-btn-border: rgba(217, 119, 6, 0.5);
  --hint-btn-border-hover: rgba(180, 83, 9, 0.5);
  --hint-btn-text: #92400e;
}

.dark {
  /* Primary Button Dark */
  --btn-primary-bg: #5fb899;
  --btn-primary-bg-hover: #4a9b7f;
  --btn-primary-bg-active: #3d8a6e;

  /* Secondary Button Dark */
  --btn-secondary-bg: transparent;
  --btn-secondary-bg-hover: rgba(255, 255, 255, 0.1);
  --btn-secondary-bg-active: rgba(255, 255, 255, 0.15);
  --btn-secondary-text: #e4e5f1;
  --btn-secondary-border: #52525b;
  --btn-secondary-border-hover: #71717a;
  --btn-secondary-border-active: #a1a1aa;

  /* Ghost Button Dark */
  --btn-ghost-bg-hover: rgba(255, 255, 255, 0.1);
  --btn-ghost-bg-active: rgba(255, 255, 255, 0.15);

  /* Take Hint Button - Dark */
  --hint-btn-bg: linear-gradient(135deg, #78350f 0%, #92400e 100%);
  --hint-btn-bg-hover: linear-gradient(135deg, #92400e 0%, #b45309 100%);
  --hint-btn-border: rgba(251, 191, 36, 0.3);
  --hint-btn-border-hover: rgba(251, 191, 36, 0.5);
  --hint-btn-text: #fbbf24;
}
```

### Focus Ring System

All interactive elements use a consistent focus ring:

```css
:root {
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
  --focus-ring-color: #2563eb;
  --focus-ring:
    0 0 0 var(--focus-ring-offset) var(--bg),
    0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
}

.dark {
  --focus-ring-color: #60a5fa;
}
```

---

## 3. Surface Colors

Surfaces create the foundation of the UI. Each surface has a specific purpose in the visual hierarchy.

### Surface Hierarchy

| Token                      | Purpose            | Light     | Dark                     |
| -------------------------- | ------------------ | --------- | ------------------------ |
| `--surface-primary`        | Page background    | `#ffffff` | `#121213`                |
| `--surface-elevated`       | Cards, panels      | `#ffffff` | `#1e1e1f`                |
| `--surface-elevated-hover` | Hovered cards      | `#fafafa` | `#27272a`                |
| `--surface-overlay`        | Modals, dialogs    | `#ffffff` | `#27272a`                |
| `--surface-inset`          | Input fields       | `#f4f4f5` | `#18181b`                |
| `--surface-inset-focus`    | Active input       | `#ffffff` | `#27272a`                |
| `--surface-hover`          | Hover backgrounds  | `#f4f4f5` | `rgba(255,255,255,0.1)`  |
| `--surface-active`         | Active/pressed     | `#e4e4e7` | `rgba(255,255,255,0.15)` |
| `--surface-subtle`         | Subtle backgrounds | `#fafafa` | `#18181b`                |

### CSS Implementation

```css
:root {
  /* Surface Colors - Light Mode */
  --surface-primary: #ffffff;
  --surface-elevated: #ffffff;
  --surface-elevated-hover: #fafafa;
  --surface-overlay: #ffffff;
  --surface-inset: #f4f4f5;
  --surface-inset-focus: #ffffff;
  --surface-hover: #f4f4f5;
  --surface-active: #e4e4e7;
  --surface-subtle: #fafafa;
  --surface-backdrop: rgba(0, 0, 0, 0.5);
}

.dark {
  /* Surface Colors - Dark Mode */
  --surface-primary: #121213;
  --surface-elevated: #1e1e1f;
  --surface-elevated-hover: #27272a;
  --surface-overlay: #27272a;
  --surface-inset: #18181b;
  --surface-inset-focus: #27272a;
  --surface-hover: rgba(255, 255, 255, 0.1);
  --surface-active: rgba(255, 255, 255, 0.15);
  --surface-subtle: #18181b;
  --surface-backdrop: rgba(0, 0, 0, 0.7);
}
```

### Tailwind 4 Theme Extension

```css
@theme {
  --color-surface-primary: var(--surface-primary);
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-elevated-hover: var(--surface-elevated-hover);
  --color-surface-overlay: var(--surface-overlay);
  --color-surface-inset: var(--surface-inset);
  --color-surface-inset-focus: var(--surface-inset-focus);
  --color-surface-hover: var(--surface-hover);
  --color-surface-active: var(--surface-active);
  --color-surface-subtle: var(--surface-subtle);
  --color-surface-backdrop: var(--surface-backdrop);
}
```

---

## 4. Mode-Specific Tokens

Each game mode has a distinct color identity that carries through light and dark modes.

### Classic Mode (Archival Green/Teal)

Classic mode uses archival green tones that evoke historical documents and museums.

| Token                          | Light     | Dark      |
| ------------------------------ | --------- | --------- |
| `--mode-classic-bg`            | `#f0f7f4` | `#1a2f25` |
| `--mode-classic-surface`       | `#ffffff` | `#1e1e1f` |
| `--mode-classic-accent`        | `#2d6a4f` | `#6ee7b7` |
| `--mode-classic-accent-hover`  | `#22543d` | `#34d399` |
| `--mode-classic-accent-subtle` | `#d1fae5` | `#064e3b` |
| `--mode-classic-border`        | `#a7f3d0` | `#065f46` |
| `--mode-classic-text`          | `#1a1a1b` | `#e4e5f1` |
| `--mode-classic-text-muted`    | `#787c7e` | `#9ca3af` |

### Order Mode (Warm Amber/Timeline)

Order mode uses warm amber tones that suggest timelines and chronological organization.

| Token                        | Light     | Dark      |
| ---------------------------- | --------- | --------- |
| `--mode-order-bg`            | `#fef7ed` | `#2a2015` |
| `--mode-order-surface`       | `#ffffff` | `#1e1e1f` |
| `--mode-order-accent`        | `#b45309` | `#fbbf24` |
| `--mode-order-accent-hover`  | `#92400e` | `#f59e0b` |
| `--mode-order-accent-subtle` | `#fef3c7` | `#78350f` |
| `--mode-order-border`        | `#fde68a` | `#92400e` |
| `--mode-order-text`          | `#1a1a1b` | `#e4e5f1` |
| `--mode-order-text-muted`    | `#787c7e` | `#9ca3af` |

### CSS Implementation

```css
:root {
  /* Classic Mode - Light */
  --mode-classic-bg: #f0f7f4;
  --mode-classic-surface: #ffffff;
  --mode-classic-accent: #2d6a4f;
  --mode-classic-accent-hover: #22543d;
  --mode-classic-accent-subtle: #d1fae5;
  --mode-classic-accent-muted: #6b9c86;
  --mode-classic-border: #a7f3d0;
  --mode-classic-border-strong: #6ee7b7;
  --mode-classic-text: #1a1a1b;
  --mode-classic-text-muted: #787c7e;
  --mode-classic-elevation-1: 0 1px 3px rgba(45, 106, 79, 0.08);
  --mode-classic-elevation-2: 0 4px 12px rgba(45, 106, 79, 0.12);

  /* Order Mode - Light */
  --mode-order-bg: #fef7ed;
  --mode-order-surface: #ffffff;
  --mode-order-accent: #b45309;
  --mode-order-accent-hover: #92400e;
  --mode-order-accent-subtle: #fef3c7;
  --mode-order-accent-muted: #d97706;
  --mode-order-border: #fde68a;
  --mode-order-border-strong: #fbbf24;
  --mode-order-text: #1a1a1b;
  --mode-order-text-muted: #787c7e;
  --mode-order-elevation-1: 0 1px 3px rgba(180, 83, 9, 0.08);
  --mode-order-elevation-2: 0 4px 12px rgba(180, 83, 9, 0.12);
}

.dark {
  /* Classic Mode - Dark */
  --mode-classic-bg: #1a2f25;
  --mode-classic-surface: #1e1e1f;
  --mode-classic-accent: #6ee7b7;
  --mode-classic-accent-hover: #34d399;
  --mode-classic-accent-subtle: #064e3b;
  --mode-classic-accent-muted: #4a9b7f;
  --mode-classic-border: #065f46;
  --mode-classic-border-strong: #10b981;
  --mode-classic-text: #e4e5f1;
  --mode-classic-text-muted: #9ca3af;
  --mode-classic-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.3);
  --mode-classic-elevation-2: 0 4px 12px rgba(0, 0, 0, 0.4);

  /* Order Mode - Dark */
  --mode-order-bg: #2a2015;
  --mode-order-surface: #1e1e1f;
  --mode-order-accent: #fbbf24;
  --mode-order-accent-hover: #f59e0b;
  --mode-order-accent-subtle: #78350f;
  --mode-order-accent-muted: #d97706;
  --mode-order-border: #92400e;
  --mode-order-border-strong: #f59e0b;
  --mode-order-text: #e4e5f1;
  --mode-order-text-muted: #9ca3af;
  --mode-order-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.3);
  --mode-order-elevation-2: 0 4px 12px rgba(0, 0, 0, 0.4);
}
```

### Tailwind 4 Theme Extension

```css
@theme {
  /* Classic Mode Colors */
  --color-classic-bg: var(--mode-classic-bg);
  --color-classic-surface: var(--mode-classic-surface);
  --color-classic-accent: var(--mode-classic-accent);
  --color-classic-accent-hover: var(--mode-classic-accent-hover);
  --color-classic-accent-subtle: var(--mode-classic-accent-subtle);
  --color-classic-border: var(--mode-classic-border);
  --color-classic-text: var(--mode-classic-text);

  /* Order Mode Colors */
  --color-order-bg: var(--mode-order-bg);
  --color-order-surface: var(--mode-order-surface);
  --color-order-accent: var(--mode-order-accent);
  --color-order-accent-hover: var(--mode-order-accent-hover);
  --color-order-accent-subtle: var(--mode-order-accent-subtle);
  --color-order-border: var(--mode-order-border);
  --color-order-text: var(--mode-order-text);
}
```

---

## 5. Border System

Borders define structure and create visual separation. The system uses four weights of borders for different purposes.

### Border Weights

| Token                        | Usage                | Light     | Dark      |
| ---------------------------- | -------------------- | --------- | --------- |
| `--border-subtle`            | Subtle dividers      | `#f4f4f5` | `#27272a` |
| `--border-default`           | Standard borders     | `#e4e4e7` | `#3a3a3c` |
| `--border-strong`            | Emphasized borders   | `#d4d4d8` | `#52525b` |
| `--border-interactive`       | Form elements        | `#a1a1aa` | `#71717a` |
| `--border-interactive-focus` | Active form elements | `#3f3f46` | `#a1a1aa` |

### Border Widths

| Token              | Value | Usage                 |
| ------------------ | ----- | --------------------- |
| `--border-width-0` | `0`   | No border             |
| `--border-width-1` | `1px` | Subtle dividers       |
| `--border-width-2` | `2px` | Cards, buttons        |
| `--border-width-4` | `4px` | Focus states, accents |

### CSS Implementation

```css
:root {
  /* Border Colors - Light Mode */
  --border-subtle: #f4f4f5;
  --border-default: #e4e4e7;
  --border-strong: #d4d4d8;
  --border-interactive: #a1a1aa;
  --border-interactive-focus: #3f3f46;

  /* Border Widths */
  --border-width-0: 0;
  --border-width-1: 1px;
  --border-width-2: 2px;
  --border-width-4: 4px;

  /* Border Radius */
  --radius-none: 0;
  --radius-sm: 3px;
  --radius-default: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
}

.dark {
  /* Border Colors - Dark Mode */
  --border-subtle: #27272a;
  --border-default: #3a3a3c;
  --border-strong: #52525b;
  --border-interactive: #71717a;
  --border-interactive-focus: #a1a1aa;
}
```

### Tailwind 4 Theme Extension

```css
@theme {
  --color-border-subtle: var(--border-subtle);
  --color-border-default: var(--border-default);
  --color-border-strong: var(--border-strong);
  --color-border-interactive: var(--border-interactive);
  --color-border-interactive-focus: var(--border-interactive-focus);
}
```

### Usage Examples

```tsx
// Card with default border
<div className="border-2 border-border-default">

// Subtle divider
<hr className="border-border-subtle">

// Interactive input
<input className="border border-border-interactive focus:border-border-interactive-focus">

// Strong border for emphasis
<div className="border-2 border-border-strong">
```

---

## 6. Typography Tokens

Text styling tokens ensure consistent readability across the interface.

### Font Families

| Token            | Value                  | Usage            |
| ---------------- | ---------------------- | ---------------- |
| `--font-display` | `"Outfit", sans-serif` | Headings, titles |
| `--font-body`    | `"Karla", sans-serif`  | Body text, UI    |
| `--font-mono`    | `"SF Mono", monospace` | Numbers, years   |

### Font Sizes

| Token         | Value      | Usage            |
| ------------- | ---------- | ---------------- |
| `--text-xs`   | `0.75rem`  | Captions, labels |
| `--text-sm`   | `0.875rem` | Secondary text   |
| `--text-base` | `1rem`     | Body text        |
| `--text-lg`   | `1.125rem` | Emphasized body  |
| `--text-xl`   | `1.25rem`  | Small headings   |
| `--text-2xl`  | `1.5rem`   | Section headings |
| `--text-3xl`  | `1.875rem` | Large headings   |
| `--text-4xl`  | `2.25rem`  | Hero text        |

### Font Weights

| Token             | Value | Usage           |
| ----------------- | ----- | --------------- |
| `--font-normal`   | `400` | Body text       |
| `--font-medium`   | `500` | Emphasized text |
| `--font-semibold` | `600` | Labels, buttons |
| `--font-bold`     | `700` | Headings        |

### Line Heights

| Token               | Value   | Usage          |
| ------------------- | ------- | -------------- |
| `--leading-tight`   | `1.1`   | Headings       |
| `--leading-snug`    | `1.25`  | UI elements    |
| `--leading-normal`  | `1.5`   | Body text      |
| `--leading-relaxed` | `1.625` | Long-form text |

---

## 7. Spacing Tokens

Consistent spacing creates visual rhythm and hierarchy.

| Token        | Value            | Usage                 |
| ------------ | ---------------- | --------------------- |
| `--space-0`  | `0`              | No space              |
| `--space-1`  | `0.25rem` (4px)  | Tight spacing         |
| `--space-2`  | `0.5rem` (8px)   | Compact spacing       |
| `--space-3`  | `0.75rem` (12px) | Default spacing       |
| `--space-4`  | `1rem` (16px)    | Standard spacing      |
| `--space-5`  | `1.25rem` (20px) | Medium spacing        |
| `--space-6`  | `1.5rem` (24px)  | Large spacing         |
| `--space-8`  | `2rem` (32px)    | Section spacing       |
| `--space-10` | `2.5rem` (40px)  | Large section spacing |
| `--space-12` | `3rem` (48px)    | Extra large spacing   |

---

## 8. Animation Tokens

Subtle animations enhance the experience without distraction.

| Token                | Value   | Usage               |
| -------------------- | ------- | ------------------- |
| `--duration-instant` | `0ms`   | No animation        |
| `--duration-fast`    | `100ms` | Micro-interactions  |
| `--duration-normal`  | `150ms` | State changes       |
| `--duration-slow`    | `200ms` | Larger transitions  |
| `--duration-slower`  | `300ms` | Entrance animations |

| Token            | Value                             | Usage               |
| ---------------- | --------------------------------- | ------------------- |
| `--ease-default` | `ease`                            | Standard easing     |
| `--ease-in-out`  | `ease-in-out`                     | Smooth transitions  |
| `--ease-out`     | `ease-out`                        | Exit animations     |
| `--ease-spring`  | `cubic-bezier(0.2, 0, 0.38, 0.9)` | Snappy interactions |

---

## 9. Complete CSS Implementation

Here's the complete CSS for reference. This should be integrated into `src/app/globals.css`:

```css
:root {
  /* ========================================
     BASE COLORS
     ======================================== */
  --bg: #ffffff;
  --text: #1a1a1b;
  --muted: #787c7e;
  --neutral: #787c7e;
  --success: #4a9b7f;
  --warning: #d4a84b;
  --error: #b42318;
  --info: #2563eb;

  /* ========================================
     ELEVATION SYSTEM
     ======================================== */
  --elevation-0: none;
  --elevation-1: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --elevation-2: 0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.04);
  --elevation-3: 0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.04);
  --elevation-drag: 0 12px 32px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1);

  /* ========================================
     SURFACE COLORS
     ======================================== */
  --surface-primary: #ffffff;
  --surface-elevated: #ffffff;
  --surface-elevated-hover: #fafafa;
  --surface-overlay: #ffffff;
  --surface-inset: #f4f4f5;
  --surface-inset-focus: #ffffff;
  --surface-hover: #f4f4f5;
  --surface-active: #e4e4e7;
  --surface-subtle: #fafafa;
  --surface-backdrop: rgba(0, 0, 0, 0.5);

  /* ========================================
     INTERACTIVE STATES - PRIMARY
     ======================================== */
  --btn-primary-bg: #4a9b7f;
  --btn-primary-bg-hover: #3d8a6e;
  --btn-primary-bg-active: #347a60;
  --btn-primary-text: #ffffff;
  --btn-primary-text-disabled: rgba(255, 255, 255, 0.5);

  /* ========================================
     INTERACTIVE STATES - SECONDARY
     ======================================== */
  --btn-secondary-bg: transparent;
  --btn-secondary-bg-hover: #f4f4f5;
  --btn-secondary-bg-active: #e4e4e7;
  --btn-secondary-text: #1a1a1b;
  --btn-secondary-border: #d3d6da;
  --btn-secondary-border-hover: #a1a1aa;
  --btn-secondary-border-active: #71717a;

  /* ========================================
     INTERACTIVE STATES - GHOST
     ======================================== */
  --btn-ghost-bg-hover: rgba(0, 0, 0, 0.05);
  --btn-ghost-bg-active: rgba(0, 0, 0, 0.1);

  /* ========================================
     INTERACTIVE STATES - DESTRUCTIVE
     ======================================== */
  --btn-destructive-bg: #b42318;
  --btn-destructive-bg-hover: #991b1b;
  --btn-destructive-bg-active: #7f1d1d;

  /* ========================================
     TAKE HINT BUTTON
     ======================================== */
  --hint-btn-bg: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  --hint-btn-bg-hover: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
  --hint-btn-border: rgba(217, 119, 6, 0.5);
  --hint-btn-border-hover: rgba(180, 83, 9, 0.5);
  --hint-btn-text: #92400e;

  /* ========================================
     FOCUS RING
     ======================================== */
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
  --focus-ring-color: #2563eb;

  /* ========================================
     BORDER SYSTEM
     ======================================== */
  --border-subtle: #f4f4f5;
  --border-default: #e4e4e7;
  --border-strong: #d4d4d8;
  --border-interactive: #a1a1aa;
  --border-interactive-focus: #3f3f46;

  /* ========================================
     MODE: CLASSIC
     ======================================== */
  --mode-classic-bg: #f0f7f4;
  --mode-classic-surface: #ffffff;
  --mode-classic-accent: #2d6a4f;
  --mode-classic-accent-hover: #22543d;
  --mode-classic-accent-subtle: #d1fae5;
  --mode-classic-accent-muted: #6b9c86;
  --mode-classic-border: #a7f3d0;
  --mode-classic-border-strong: #6ee7b7;
  --mode-classic-text: #1a1a1b;
  --mode-classic-text-muted: #787c7e;

  /* ========================================
     MODE: ORDER
     ======================================== */
  --mode-order-bg: #fef7ed;
  --mode-order-surface: #ffffff;
  --mode-order-accent: #b45309;
  --mode-order-accent-hover: #92400e;
  --mode-order-accent-subtle: #fef3c7;
  --mode-order-accent-muted: #d97706;
  --order-border: #fde68a;
  --mode-order-border-strong: #fbbf24;
  --mode-order-text: #1a1a1b;
  --mode-order-text-muted: #787c7e;

  /* ========================================
     TYPOGRAPHY
     ======================================== */
  --font-display: "Outfit", sans-serif;
  --font-body: "Karla", sans-serif;
  --font-mono: ui-monospace, "SF Mono", monospace;

  /* ========================================
     RADIUS
     ======================================== */
  --radius-sm: 3px;
  --radius-default: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* ========================================
     ANIMATION
     ======================================== */
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 200ms;
}

/* ========================================
   DARK MODE OVERRIDES
   ======================================== */
.dark {
  /* Base Colors */
  --bg: #121213;
  --text: #e4e5f1;
  --muted: #9ca3af;
  --success: #5fb899;
  --warning: #fbbf24;

  /* Elevation */
  --elevation-0: none;
  --elevation-1: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  --elevation-2: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2);
  --elevation-3: 0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.2);
  --elevation-drag: 0 12px 32px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.3);

  /* Surfaces */
  --surface-primary: #121213;
  --surface-elevated: #1e1e1f;
  --surface-elevated-hover: #27272a;
  --surface-overlay: #27272a;
  --surface-inset: #18181b;
  --surface-inset-focus: #27272a;
  --surface-hover: rgba(255, 255, 255, 0.1);
  --surface-active: rgba(255, 255, 255, 0.15);
  --surface-subtle: #18181b;
  --surface-backdrop: rgba(0, 0, 0, 0.7);

  /* Primary Button */
  --btn-primary-bg: #5fb899;
  --btn-primary-bg-hover: #4a9b7f;
  --btn-primary-bg-active: #3d8a6e;

  /* Secondary Button */
  --btn-secondary-bg-hover: rgba(255, 255, 255, 0.1);
  --btn-secondary-bg-active: rgba(255, 255, 255, 0.15);
  --btn-secondary-text: #e4e5f1;
  --btn-secondary-border: #52525b;
  --btn-secondary-border-hover: #71717a;
  --btn-secondary-border-active: #a1a1aa;

  /* Ghost Button */
  --btn-ghost-bg-hover: rgba(255, 255, 255, 0.1);
  --btn-ghost-bg-active: rgba(255, 255, 255, 0.15);

  /* Take Hint Button */
  --hint-btn-bg: linear-gradient(135deg, #78350f 0%, #92400e 100%);
  --hint-btn-bg-hover: linear-gradient(135deg, #92400e 0%, #b45309 100%);
  --hint-btn-border: rgba(251, 191, 36, 0.3);
  --hint-btn-border-hover: rgba(251, 191, 36, 0.5);
  --hint-btn-text: #fbbf24;

  /* Focus Ring */
  --focus-ring-color: #60a5fa;

  /* Borders */
  --border-subtle: #27272a;
  --border-default: #3a3a3c;
  --border-strong: #52525b;
  --border-interactive: #71717a;
  --border-interactive-focus: #a1a1aa;

  /* Mode: Classic */
  --mode-classic-bg: #1a2f25;
  --mode-classic-surface: #1e1e1f;
  --mode-classic-accent: #6ee7b7;
  --mode-classic-accent-hover: #34d399;
  --mode-classic-accent-subtle: #064e3b;
  --mode-classic-accent-muted: #4a9b7f;
  --mode-classic-border: #065f46;
  --mode-classic-border-strong: #10b981;
  --mode-classic-text: #e4e5f1;
  --mode-classic-text-muted: #9ca3af;

  /* Mode: Order */
  --mode-order-bg: #2a2015;
  --mode-order-surface: #1e1e1f;
  --mode-order-accent: #fbbf24;
  --mode-order-accent-hover: #f59e0b;
  --mode-order-accent-subtle: #78350f;
  --mode-order-accent-muted: #d97706;
  --order-border: #92400e;
  --mode-order-border-strong: #f59e0b;
  --mode-order-text: #e4e5f1;
  --mode-order-text-muted: #9ca3af;
}
```

---

## 10. Tailwind 4 Theme Configuration

Here's the complete Tailwind 4 `@theme` block for reference:

```css
@theme {
  /* ========================================
     FONTS
     ======================================== */
  --font-display: "Outfit", sans-serif;
  --font-heading: "Outfit", sans-serif;
  --font-body: "Karla", sans-serif;
  --font-mono: ui-monospace, "SF Mono", monospace;
  --font-sans: "Karla", sans-serif;
  --font-accent: "Outfit", sans-serif;

  /* ========================================
     ELEVATION (Shadows)
     ======================================== */
  --shadow-elevation-0: var(--elevation-0);
  --shadow-elevation-1: var(--elevation-1);
  --shadow-elevation-2: var(--elevation-2);
  --shadow-elevation-3: var(--elevation-3);
  --shadow-drag: var(--elevation-drag);

  /* ========================================
     SURFACE COLORS
     ======================================== */
  --color-surface-primary: var(--surface-primary);
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-elevated-hover: var(--surface-elevated-hover);
  --color-surface-overlay: var(--surface-overlay);
  --color-surface-inset: var(--surface-inset);
  --color-surface-inset-focus: var(--surface-inset-focus);
  --color-surface-hover: var(--surface-hover);
  --color-surface-active: var(--surface-active);
  --color-surface-subtle: var(--surface-subtle);
  --color-surface-backdrop: var(--surface-backdrop);

  /* ========================================
     BASE COLORS
     ======================================== */
  --color-background: var(--bg);
  --color-foreground: var(--text);
  --color-muted: var(--muted);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-error: var(--error);
  --color-info: var(--info);

  /* ========================================
     BORDER COLORS
     ======================================== */
  --color-border-subtle: var(--border-subtle);
  --color-border-default: var(--border-default);
  --color-border-strong: var(--border-strong);
  --color-border-interactive: var(--border-interactive);
  --color-border-interactive-focus: var(--border-interactive-focus);

  /* ========================================
     CLASSIC MODE
     ======================================== */
  --color-classic-bg: var(--mode-classic-bg);
  --color-classic-surface: var(--mode-classic-surface);
  --color-classic-accent: var(--mode-classic-accent);
  --color-classic-accent-hover: var(--mode-classic-accent-hover);
  --color-classic-accent-subtle: var(--mode-classic-accent-subtle);
  --color-classic-border: var(--mode-classic-border);
  --color-classic-text: var(--mode-classic-text);

  /* ========================================
     ORDER MODE
     ======================================== */
  --color-order-bg: var(--mode-order-bg);
  --color-order-surface: var(--mode-order-surface);
  --color-order-accent: var(--mode-order-accent);
  --color-order-accent-hover: var(--mode-order-accent-hover);
  --color-order-accent-subtle: var(--mode-order-accent-subtle);
  --color-order-border: var(--order-border);
  --color-order-text: var(--mode-order-text);

  /* ========================================
     RADIUS
     ======================================== */
  --radius-sm: 3px;
  --radius-md: 4px;
  --radius-lg: 6px;
  --radius-xl: 8px;
  --radius-full: 999px;
}
```

---

## 11. Migration Guide

### From Current System

1. **Replace hardcoded shadows** with elevation tokens:

   ```diff
   - box-shadow: 0 2px 0 rgba(26, 26, 27, 0.15);
   + box-shadow: var(--elevation-1);
   ```

2. **Update button variants** to use state tokens:

   ```diff
   - hover:bg-[#3d8a6e] hover:translate-y-[-1px]
   + hover:bg-[var(--btn-primary-bg-hover)] hover:-translate-y-px hover:shadow-elevation-2
   ```

3. **Replace surface colors** with semantic tokens:

   ```diff
   - dark:bg-[#27272a]
   + dark:bg-surface-elevated
   ```

4. **Update border usage**:

   ```diff
   - border border-[#d3d6da]
   + border border-border-default
   ```

5. **Take Hint button dark mode fix**:
   ```diff
   - className="border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-amber-500/10"
   + className="border-2 border-[var(--hint-btn-border)] bg-[var(--hint-btn-bg)] text-[var(--hint-btn-text)]"
   ```

---

## 12. Design Principles

1. **Shadows, not borders**: Use elevation changes rather than border color changes to indicate state
2. **Subtlety**: NYT Games uses minimal visual noise—keep shadows soft and colors muted
3. **Consistency**: Interactive elements should behave the same way across the app
4. **Accessibility**: Ensure focus states are visible and contrast ratios meet WCAG 2.1 AA
5. **Mode identity**: Each game mode should feel distinct through accent colors while maintaining structural consistency

---

## References

- [NYT Games Design Philosophy](https://www.nytimes.com/crosswords)
- [Wordle Color System](https://www.nytimes.com/games/wordle/index.html)
- [Tailwind CSS 4 Theme Documentation](https://tailwindcss.com/docs/theme)
- [CSS Custom Properties Best Practices](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
