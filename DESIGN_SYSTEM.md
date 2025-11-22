# Chrondle Design System

## Overview

Chrondle uses a **three-layer token architecture** built on Tailwind v4's CSS-first approach to ensure consistent theming across light and dark modes.

## Token Architecture

```
Primitives (raw OKLCH values)
    ↓
Materials (theme context)
    ↓
Semantic (intent-based) ← USE THESE IN COMPONENTS
```

### 🔴 **Layer 1: Primitives** (Internal - DO NOT USE)

Raw color values defined in `src/app/globals.css`:

```css
@theme {
  --color-ink-900: oklch(25% 0.02 280);
  --color-ink-700: oklch(45% 0.02 280);
  --color-parchment-50: oklch(98% 0.01 80);
  --color-parchment-300: oklch(85% 0.02 80);
  /* etc... */
}
```

**⚠️ NEVER use these directly in components.** They don't adapt to dark mode.

### 🟡 **Layer 2: Materials** (Theme Context)

Material tokens that flip values between themes:

```css
@theme {
  /* Light mode */
  --background: var(--color-parchment-50);
  --foreground: var(--color-ink-900);
  --card: var(--color-parchment-100);
}

html.dark {
  /* Dark mode */
  --background: var(--color-ink-900);
  --foreground: var(--color-parchment-50);
  --card: var(--color-ink-800);
}
```

### 🟢 **Layer 3: Semantic** (Intent - USE THESE)

Intent-based tokens that reference materials:

```css
@theme {
  /* Text */
  --text-primary: var(--foreground);
  --text-secondary: oklch(from var(--foreground) l c h / 0.7);
  --text-tertiary: oklch(from var(--foreground) l c h / 0.5);

  /* Surfaces */
  --surface-elevated: var(--card);
  --surface-hover: oklch(from var(--muted) l c h / 0.5);

  /* Borders */
  --outline-default: var(--border);
  --outline-subtle: oklch(from var(--border) l c h / 0.3);
}
```

## Token Reference

### Text Colors

| Token Class             | Purpose             | Example              |
| ----------------------- | ------------------- | -------------------- |
| `text-primary`          | Main text, headings | Body copy, titles    |
| `text-secondary`        | Supporting text     | Labels, captions     |
| `text-tertiary`         | Subtle text         | Placeholders, hints  |
| `text-muted-foreground` | Deemphasized text   | Timestamps, metadata |

### Background Colors

| Token Class           | Purpose            | Example              |
| --------------------- | ------------------ | -------------------- |
| `bg-background`       | Page background    | Main layout          |
| `bg-card`             | Card surfaces      | Panels, modals       |
| `bg-surface-elevated` | Raised surfaces    | Input fields         |
| `bg-surface-hover`    | Hover states       | Interactive elements |
| `bg-muted`            | Subtle backgrounds | Badges, tags         |

### Border Colors

| Token Class              | Purpose          | Example                  |
| ------------------------ | ---------------- | ------------------------ |
| `border-outline-default` | Standard borders | Cards, dividers          |
| `border-outline-subtle`  | Faint borders    | Decorative elements      |
| `border-border`          | Material border  | Default Radix components |

### Feedback Colors

| Token Class             | Purpose       | Example           |
| ----------------------- | ------------- | ----------------- |
| `text-feedback-correct` | Success state | Correct answer    |
| `text-feedback-error`   | Error state   | Validation errors |
| `border-feedback-error` | Error borders | Invalid inputs    |

## Usage Examples

### ✅ **Correct Usage** (Semantic Tokens)

```tsx
// Text hierarchy
<h1 className="text-primary text-4xl font-bold">Heading</h1>
<p className="text-secondary text-sm">Supporting text</p>
<span className="text-tertiary text-xs">Hint text</span>

// Surfaces
<div className="bg-card border-outline-default p-4">
  <input className="bg-surface-elevated border-outline-default" />
</div>

// Interactive states
<button className="hover:bg-surface-hover active:bg-muted">
  Click me
</button>
```

### ❌ **Incorrect Usage** (Primitive Tokens)

```tsx
// DO NOT USE - won't adapt to dark mode
<h1 className="text-ink-900">Heading</h1>
<div className="bg-parchment-50 border-parchment-300">
  <input className="bg-parchment-100" />
</div>
```

## Migration Guide

### Common Primitive → Semantic Mappings

```
text-ink-900     → text-primary
text-ink-700     → text-secondary
text-ink-500     → text-tertiary
text-ink-400     → text-muted-foreground

bg-parchment-50  → bg-background
bg-parchment-100 → bg-card
bg-parchment-200 → bg-surface-elevated

border-parchment-300 → border-outline-default
border-ink-900       → border-outline-default
```

## Enforcement

### ESLint Rule

Primitive token usage is **automatically blocked** by ESLint:

```js
// eslint.config.mjs
"no-restricted-syntax": [
  "error",
  {
    "selector": "Literal[value=/\\b(text|bg|border)-(ink|parchment)-\\d+\\b/]",
    "message": "Use semantic tokens instead"
  }
]
```

### Pre-commit Hook

The `.husky/pre-commit` hook scans staged files for primitive tokens and blocks commits:

```bash
🎨 Checking for primitive token usage in staged files...
❌ DESIGN SYSTEM VIOLATION: Primitive tokens detected!

Use semantic tokens instead:
  - text-ink-900 → text-primary
  - bg-parchment-50 → bg-surface-elevated
```

## Adding New Tokens

If semantic tokens don't cover your use case:

1. **First**, check if existing tokens can work with opacity modifiers:

   ```tsx
   className = "text-primary/70"; // 70% opacity
   className = "bg-muted/50"; // 50% opacity
   ```

2. **If truly needed**, add to `globals.css` semantic layer:

   ```css
   @theme {
     --your-new-semantic-token: /* reference materials */;
   }

   html.dark {
     --your-new-semantic-token: /* dark mode value */;
   }
   ```

3. **Never** add primitive tokens to components.

## Special Cases

### Mode-Specific Colors

Game mode colors (`mode-classic-*`, `mode-order-*`) are allowed as they're intentionally mode-specific:

```tsx
// ✅ OK - mode-specific theming
<div className="bg-mode-classic-bg text-mode-classic-text" />
```

### Inline Styles with CSS Variables

When using inline styles, prefer CSS variables:

```tsx
// ✅ Good - uses CSS variable
<div style={{ color: "var(--text-primary)" }} />

// ❌ Bad - hardcoded color
<div style={{ color: "#1a1a1a" }} />
```

## Benefits

1. **Automatic dark mode** - Components adapt without conditional logic
2. **Maintainability** - Change theme by updating `globals.css`
3. **Consistency** - Single source of truth for colors
4. **Type safety** - ESLint + pre-commit hooks prevent mistakes
5. **DRY principle** - No duplicated color values

## Resources

- **Token Definitions**: `src/app/globals.css`
- **ESLint Config**: `eslint.config.mjs`
- **Pre-commit Hook**: `.husky/pre-commit`
- **Tailwind v4 Docs**: https://tailwindcss.com/docs/v4-beta

---

**Last Updated**: 2025-11-21
