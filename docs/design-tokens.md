# Design Tokens Guide

**Purpose**: This document codifies Chrondle's **Museum Reading Room** aesthetic into reusable tokens. By documenting the typography, shadow, border radius, color, and surface systems, we prevent developers from inventing one-off tokens like `shadow-warm` or `rounded-xl`.

**Design Philosophy**: Warm, sophisticated archival aesthetic inspired by library reading rooms, conservation labs, and museum archives under golden hour lighting. NOT theatrical or piratey.

**Philosophy**: Design tokens create a three-layer architecture:

1. **Primitives** → Raw values (colors, sizes)
2. **Semantic tokens** → Meaning-based aliases (surface, outline, feedback)
3. **Component patterns** → Reusable abstractions (GameCard, SubmitButton)

---

## Typography System

### Museum Reading Room Typeface Hierarchy

Chrondle uses a refined 5-font system that creates intellectual warmth without theatrical camp:

| Font Variable    | Typeface       | Usage                                  | Rationale                                                     |
| ---------------- | -------------- | -------------------------------------- | ------------------------------------------------------------- |
| `--font-display` | Newsreader     | Page titles, hero text                 | Elegant editorial serif (NOT theatrical like IM Fell English) |
| `--font-heading` | Archivo Narrow | Section titles, labels                 | Clean, condensed sans for structure                           |
| `--font-body`    | IBM Plex Sans  | UI elements, buttons, interactive text | Technical precision, excellent readability                    |
| `--font-serif`   | Crimson Text   | Hint text, narrative content           | Refined body serif for storytelling                           |
| `--font-mono`    | JetBrains Mono | Years, stats, technical data           | Tabular numerals for data                                     |

### Implementation (globals.css:415-424)

```css
@theme {
  --font-display: "Newsreader", "Georgia", serif;
  --font-heading: "Archivo Narrow", "Helvetica Neue", sans-serif;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
  --font-serif: "Crimson Text", "Georgia", serif;
  --font-mono: "JetBrains Mono", "Courier New", monospace;
}
```

### Font Loading (layout.tsx:47)

```tsx
<link
  href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Archivo+Narrow:wght@400;500;600;700&family=Newsreader:ital,wght@0,300..800;1,300..800&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap"
  rel="stylesheet"
/>
```

### Typography Utility Classes

| Class                 | Purpose              | Font           | Size                     |
| --------------------- | -------------------- | -------------- | ------------------------ |
| `.text-display`       | Hero titles          | Newsreader     | clamp(2rem, 5vw, 3rem)   |
| `.text-section-title` | Section headers      | Archivo Narrow | 0.75rem (12px) uppercase |
| `.text-ui`            | Interactive elements | IBM Plex Sans  | Inherited                |
| `.font-serif`         | Hint text            | Crimson Text   | Inherited                |
| `.font-mono`          | Data/stats           | JetBrains Mono | Inherited                |

### Usage Guidelines

✅ **Correct:**

```tsx
// Page title
<h1 className="text-display font-medium">Puzzle Archive</h1>

// Section title
<h3 className="text-section-title">Target Range</h3>

// UI button text (automatically uses --font-body via class="text-ui")
<Button>Submit Range</Button>

// Hint narrative
<p className="font-serif text-lg">War of Spanish Succession begins...</p>

// Year display
<span className="font-mono tabular-nums">1701 AD</span>
```

❌ **Incorrect:**

```tsx
// NEVER use removed fonts
<h1 className="font-['IM_Fell_English']">...</h1> // ❌ Removed - too theatrical

// NEVER mix display and body fonts randomly
<button className="font-display">Submit</button> // ❌ Use font-body for UI
<h1 className="font-mono">Chrondle</h1> // ❌ Use font-display for titles

// NEVER use generic font-sans
<p className="font-sans">...</p> // ❌ Use font-body explicitly
```

**Why This System?**

- **Newsreader** (display): Elegant, editorial, intellectual - replaces theatrical IM Fell English
- **IBM Plex Sans** (body/UI): Humanist warmth + technical precision - better legibility than generic system fonts
- **Archivo Narrow** (headings): Structural clarity without being cold
- **Clear hierarchy**: Display → Heading → Body → Serif → Mono creates readable information architecture

**Migration Notes:**

- **IM Fell English REMOVED**: Replace all instances with `font-display` (Newsreader)
- **Generic font-sans**: Replace with explicit `font-body` where UI clarity matters
- **Footer legibility fix**: All footer text now `text-sm` (14px) instead of `text-xs` (12px)

---

## Color System

### Museum Taupe Background

Replaced cool gray "newsprint" with warm umber "museum wall" color:

| Token                  | Value                       | Purpose               |
| ---------------------- | --------------------------- | --------------------- |
| `--color-museum-taupe` | `oklch(0.82 0.028 60)`      | Warm umber wall color |
| `--background`         | `var(--color-museum-taupe)` | Primary background    |
| `--card`               | `oklch(0.98 0.012 80)`      | Crisp parchment cards |

**Contrast Improvement:**

- **Before**: Background `0.88` → Card `0.97` = 0.09 luminance difference (poor)
- **After**: Background `0.82` → Card `0.98` = **0.16 luminance difference** (excellent)

### Implementation (globals.css:30-31, 67-71)

```css
:root {
  --color-museum-taupe: oklch(0.82 0.028 60);

  --background: var(--color-museum-taupe);
  --card: oklch(0.98 0.012 80); /* 16% better contrast */
}
```

✅ **What This Fixes:**

- Background no longer feels "dull/boring/depressing"
- Cards pop against background with proper contrast
- Warm museum aesthetic vs cold newsprint
- Better readability across all UI elements

---

## Shadow System

### Available Classes

Chrondle uses a **hard shadow system** inspired by archival documents and print design:

| Class             | Offset            | Use Case                               |
| ----------------- | ----------------- | -------------------------------------- |
| `.shadow-hard`    | 4px + 6px layered | Standard card elevation                |
| `.shadow-hard-sm` | 2px + 3px layered | Compact UI (mobile hints)              |
| `.shadow-hard-lg` | 6px + 9px layered | Emphasized elements (buttons on hover) |

### Implementation (globals.css:727-741)

Each shadow is **two-layer**:

1. **Base layer**: Border color at main offset
2. **Tint layer**: Primary color at 10% opacity, slightly further offset

```css
.shadow-hard {
  box-shadow:
    4px 4px 0px var(--border),
    6px 6px 0px color-mix(in oklch, var(--primary) 10%, transparent);
}
```

### Usage Guidelines

✅ **Correct:**

```tsx
// Cards
<GameCard>Content</GameCard> // Automatically gets shadow-hard

// Buttons (hover state)
<SubmitButton onClick={submit}>Commit</SubmitButton> // Gets shadow-hard-lg on hover

// Compact UI
<div className="shadow-hard-sm">Compact hint panel</div>
```

❌ **Incorrect:**

```tsx
// NEVER invent shadow tokens
<div className="shadow-warm">...</div> // ❌ Doesn't exist
<div className="shadow-soft">...</div> // ❌ Breaks archival aesthetic
<div className="shadow-lg">...</div> // ❌ Use shadow-hard-lg instead
```

**Why no `shadow-warm`?**
Developers invented `shadow-warm` because the shadow system wasn't documented. It was never implemented in CSS, causing cards to render without shadows. Use `shadow-hard` instead.

---

## Number Badge Pattern

### Vermilion Circle for Event Numbering

Chrondle uses **vermilion circular badges** for event numbering and ordered lists:

| Class           | Purpose                               | Visual                           |
| --------------- | ------------------------------------- | -------------------------------- |
| `.number-badge` | Event/card numbering, step indicators | Vermilion circle with white text |

### Implementation (globals.css:743-749)

```css
.number-badge {
  @apply flex h-8 w-8 items-center justify-center;
  @apply bg-primary rounded-sm text-white;
  @apply text-lg leading-none font-bold;
  @apply shadow-hard-sm;
}
```

### Usage Guidelines

✅ **Correct:**

```tsx
// Event numbering in Order Mode
<div className="number-badge">1</div>
<div className="number-badge">{index + 1}</div>

// Step indicators in multi-step flows
<div className="number-badge">{currentStep}</div>
```

❌ **Incorrect:**

```tsx
// NEVER inline number styling
<div className="flex h-8 w-8 rounded-full bg-vermilion-500...">1</div> // ❌ Use .number-badge

// NEVER use rounded-full for numbers (breaks angular aesthetic)
<div className="rounded-full bg-primary">1</div> // ❌ Numbers use rounded-sm

// NEVER use different colors for numbers
<div className="number-badge bg-blue-500">1</div> // ❌ Always vermilion (--primary)
```

**Why `.number-badge` utility?**
Prevents styling divergence. Before this utility, developers used inconsistent number styling (plain text, different colors, rounded-full circles). The utility class ensures ALL numbers look identical across the UI.

**What it provides:**

- Vermilion (--primary) background for brand consistency
- White text for maximum contrast
- 8×8 pixel size (h-8 w-8) for readability
- Angular corners (rounded-sm) matching archival aesthetic
- Subtle elevation (shadow-hard-sm)
- Bold typography (font-bold text-lg)

---

## Border Radius System

### Archival Angular Aesthetic

Chrondle uses **minimal border radius** to evoke archival documents and vintage print:

| Class         | Radius         | Use Case                                    |
| ------------- | -------------- | ------------------------------------------- |
| `.rounded-sm` | 0.125rem (2px) | **Standard for all cards, buttons, inputs** |

### Usage Guidelines

✅ **Correct:**

```tsx
// Cards - always rounded-sm
<GameCard>Content</GameCard> // Automatically uses rounded-sm

// Buttons - always rounded-sm
<SubmitButton onClick={submit}>Submit</SubmitButton> // Automatically uses rounded-sm

// Custom components
<div className="rounded-sm border-2">Angular archival aesthetic</div>
```

❌ **Incorrect:**

```tsx
// NEVER use soft, rounded corners
<div className="rounded-xl">...</div> // ❌ Too soft, breaks aesthetic
<div className="rounded-lg">...</div> // ❌ Too soft
<div className="rounded-full">...</div> // ❌ Only for avatars/badges, NOT buttons
<button className="rounded-full">Submit</button> // ❌ Use SubmitButton instead
```

**Why `rounded-sm` everywhere?**
The archival night reading aesthetic is inspired by old documents, ledgers, and newspapers—all of which have angular corners. Rounded corners (rounded-xl, rounded-lg) feel modern and digital, breaking immersion.

**Exception**: Avatars, status badges, and circular indicators MAY use `rounded-full`, but these are rare.

---

## Surface Token System

### Three-Layer Architecture

Chrondle surfaces follow a clear elevation hierarchy:

| Token                 | CSS Variable                           | Use Case                   |
| --------------------- | -------------------------------------- | -------------------------- |
| `bg-surface-primary`  | `--surface-primary` (= `--background`) | Page background            |
| `bg-surface-elevated` | `--surface-elevated` (= `--card`)      | Cards, modals, elevated UI |
| `bg-surface-overlay`  | `--surface-overlay` (= `--popover`)    | Dropdowns, tooltips        |

### Usage Guidelines

✅ **Correct:**

```tsx
// Cards - always bg-surface-elevated
<GameCard>Content</GameCard> // Automatically uses bg-surface-elevated

// Page background
<div className="bg-surface-primary">...</div>

// Dropdowns
<Select.Content className="bg-surface-overlay">...</Select.Content>
```

❌ **Incorrect:**

```tsx
// NEVER use translucent backgrounds
<div className="bg-card/90">...</div> // ❌ Use bg-surface-elevated instead
<div className="bg-background/80">...</div> // ❌ Breaks solid surface system

// NEVER use direct color variables
<div className="bg-card">...</div> // ⚠️ Use bg-surface-elevated for semantic clarity
```

**Why solid backgrounds?**
Translucent backgrounds (`/90`, `/80`) create visual noise and break the archival aesthetic. Documents and ledgers have opaque pages—we mirror that with solid surfaces.

---

## Border System

### Outline Tokens

Chrondle uses semantic border tokens:

| Token                    | CSS Variable                       | Width | Use Case                     |
| ------------------------ | ---------------------------------- | ----- | ---------------------------- |
| `border-outline-default` | `--outline-default` (= `--border`) | 2px   | Standard card/button borders |
| `border-outline-focus`   | `--outline-focus` (= `--ring`)     | 2px   | Focus rings (accessibility)  |

### Usage Guidelines

✅ **Correct:**

```tsx
// Cards - always border-outline-default with border-2
<GameCard>Content</GameCard> // Automatically uses border-outline-default border-2

// Focus rings
<button className="focus-visible:ring-2 focus-visible:ring-outline-focus">
  Action
</button>
```

❌ **Incorrect:**

```tsx
// NEVER use thin borders (breaks archival aesthetic)
<div className="border">...</div> // ❌ Use border-2 instead

// NEVER use direct border color without semantic token
<div className="border-gray-300">...</div> // ❌ Use border-outline-default
```

**Why `border-2` everywhere?**
Archival documents and ledgers have bold, confident lines. Single-pixel borders feel digital and weak. Use `border-2` for all cards and buttons.

---

## Complete Archival Card Pattern

**The canonical archival card** combines all tokens:

```tsx
<section className="bg-surface-elevated // Solid elevated background border-outline-default // Semantic color // Bold archival // Angular corners shadow-hard // Hard elevation // Responsive padding rounded-sm border border-2 p-4 shadow md:p-6">
  Card content
</section>
```

**Prefer using GameCard instead:**

```tsx
<GameCard padding="default">Card content</GameCard>
```

Why? **Information hiding**—all 6 styling decisions above are internal to GameCard. Developers can't accidentally use `shadow-warm` or `rounded-xl` because they never touch those tokens.

---

## Anti-Patterns (Hall of Shame)

### ❌ Shadow Invention: `shadow-warm`

**What happened:**
Developers created Order Mode and invented `shadow-warm` because the shadow system wasn't documented. They assumed "warm" meant a softer shadow.

**Actual result:**
`shadow-warm` was never defined in CSS → cards rendered with NO shadow → visual inconsistency.

**Fix:**
Replace all `shadow-warm` with `shadow-hard`.

### ❌ Rounded Divergence: `rounded-full` on Submit Button

**What happened:**
Order Mode's submit button used `rounded-full`, while Classic Mode used `rounded-sm`.

**Why wrong:**
Rounded buttons feel "bubbly" and modern, breaking the archival angular aesthetic.

**Fix:**
Use `<SubmitButton>` component—architecturally guarantees `rounded-sm`.

### ❌ Translucent Chaos: `bg-card/90`

**What happened:**
Hint panels used `bg-card/90` for "subtle layering."

**Why wrong:**
Translucency creates visual noise. Archival documents have opaque pages.

**Fix:**
Use `bg-surface-elevated` (solid) instead.

---

## Enforcement Strategy

### 1. Component Abstraction (Preferred)

**Deep modules hide token decisions:**

| Component        | Hidden Tokens                                                                |
| ---------------- | ---------------------------------------------------------------------------- |
| `GameCard`       | `shadow-hard`, `rounded-sm`, `border-outline-default`, `bg-surface-elevated` |
| `SubmitButton`   | `shadow-hard-lg`, `rounded-sm`, `bg-vermilion-500`                           |
| `GameModeLayout` | Page structure, Footer guarantee                                             |

**Result**: Developers can't use wrong tokens because they never touch tokens directly.

### 2. Grep Audits (Secondary)

**Find violations:**

```bash
# Find invented shadows
rg "shadow-warm" --type css --type tsx

# Find soft corners on cards
rg "rounded-xl.*border.*p-\d" --type tsx

# Find translucent backgrounds on cards
rg "bg-card/\d{2}" --type tsx
```

### 3. Code Review Checklist

Before merging:

- [ ] No hardcoded card styling (use `<GameCard>`)
- [ ] No hardcoded submit buttons (use `<SubmitButton>`)
- [ ] No `shadow-warm`, `rounded-xl`, `rounded-full` (on buttons), `bg-card/90`
- [ ] All new cards use `shadow-hard` + `rounded-sm` + `border-2` OR `<GameCard>`

---

## Migration Guide

### Migrating Existing Code

**From**: Hardcoded card styling
**To**: `<GameCard>` component

```diff
- <section className="bg-card/90 shadow-warm rounded-xl border p-4">
+ <GameCard padding="default">
    Card content
- </section>
+ </GameCard>
```

**From**: Inconsistent submit buttons
**To**: `<SubmitButton>` component

```diff
- <Button
-   type="button"
-   onClick={handleSubmit}
-   className="rounded-full shadow-lg w-full"
- >
+ <SubmitButton onClick={handleSubmit}>
    Submit My Timeline
- </Button>
+ </SubmitButton>
```

---

## References

- **globals.css:727-741**: Shadow system implementation
- **GameCard component**: `src/components/ui/GameCard.tsx`
- **SubmitButton component**: `src/components/ui/SubmitButton.tsx`
- **GameModeLayout component**: `src/components/GameModeLayout.tsx`
- **CLAUDE.md**: Archival night reading aesthetic philosophy

---

_Last Updated: 2025-11-24_
_Maintained by: Design System Team_
