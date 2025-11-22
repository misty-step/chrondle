# TODO - Chrondle Technical Debt & Future Work

## Completed: Aesthetic Fixes (2025-11-22)

### Issues Resolved ✅

1. **Order game hard to read in dark mode** - Fixed `.paper-texture` (undefined) → `bg-background`
2. **Loading screens always light mode** - Fixed `text-ink-900` (static) → `text-foreground`
3. **Mode dropdown showing wrong label** - Added explicit `placeholder` to SelectValue
4. **CHRONDLE wordmark not left-aligned** - Added `align` prop, applied to Order mode
5. **Order styling differs today/archive** - Unified with consistent theme tokens

### Architecture Improvements ✅

- **Semantic Token Layer** - Created abstraction layer in globals.css (surface/text/interactive/border tokens)
- **Tailwind Utilities** - Exposed semantic tokens as utility classes
- **LoadingScreen Component** - DRY replacement for duplicate `renderShell` functions

---

## Technical Debt: Primitive Token Migration

### Overview

Audit found **40+ components** still using primitive tokens (`text-ink-900`, `bg-parchment-*`, etc.) instead of semantic tokens. These cause theme adaptation issues but aren't currently visible in user-facing flows.

### Priority 1: High-Traffic Components

#### GameLayout.tsx (Classic Mode)

**Lines:** 150, 185-186, 193, 203, 206

```tsx
// Current (primitive tokens)
"border-ink-900 text-ink-900"; // Line 150
"border-parchment-300"; // Lines 185-186
"text-ink-900 font-serif"; // Line 193
"text-ink-500 mb-1.5 font-sans"; // Line 203
"text-ink-900 font-serif"; // Line 206

// Recommended (semantic tokens)
"border-outline-default text-primary";
"border-outline-default";
"text-primary font-serif";
"text-secondary mb-1.5 font-sans";
"text-primary font-serif";
```

**Impact:** Main game area - affects all Classic mode users
**Estimate:** 30 minutes

#### GamesGallery.tsx (Landing Page)

**Lines:** 44, 60, 83, 86, 88, 90, 99, 111, 113, 115

```tsx
// Current (primitive tokens)
"bg-mode-classic-text text-mode-classic-bg hover:bg-ink-900";
"bg-parchment-100 dark:bg-ink-900";
"border-ink-900/10 bg-parchment-50/80";
"text-ink-900/80 dark:text-parchment-50/80";

// Recommended (semantic tokens)
"bg-interactive-accent text-inverse hover:bg-interactive-accent-hover";
"bg-surface-primary";
"border-outline-default bg-surface-elevated";
"text-primary";
```

**Impact:** First impression - landing page users see
**Estimate:** 45 minutes

#### RangeInput.tsx (Classic Mode Input)

**Lines:** 179-286 (20+ instances)

```tsx
// High-frequency primitives
"border-parchment-300"; // → "border-outline-default"
"text-ink-700"; // → "text-secondary"
"text-ink-900"; // → "text-primary"
"bg-parchment-50"; // → "bg-surface-elevated"
"text-ink-500"; // → "text-tertiary"
"text-parchment-300"; // → "text-tertiary"
```

**Impact:** Every Classic mode guess
**Estimate:** 1 hour

### Priority 2: Order Mode Components

#### DraggableEventCard.tsx

**Lines:** 168

```tsx
"font-event text-ink-900"; // → "font-event text-primary"
```

**Estimate:** 5 minutes

#### DocumentHeader.tsx

**Lines:** 58

```tsx
"text-ink-900 font-year"; // → "text-primary font-year"
```

**Estimate:** 5 minutes

#### ComparisonGrid.tsx

**Lines:** 84, 141, 206, 243

```tsx
"text-ink-900 font-event"; // → "text-primary font-event"
```

**Estimate:** 10 minutes

#### HintDisplay.tsx

**Lines:** 36, 61, 204, 320, 375

```tsx
"text-ink-900 font-semibold"; // → "text-primary font-semibold"
"text-ink-900 text-sm"; // → "text-primary text-sm"
```

**Estimate:** 15 minutes

### Priority 3: UI Components

#### AppHeader.tsx

**Lines:** 154

```tsx
"text-ink-900 h-4 w-4"; // → "text-primary h-4 w-4"
```

**Estimate:** 5 minutes

#### ModeDropdown.tsx

**Lines:** 87, 128

```tsx
"text-sm font-medium text-ink-900"; // → "text-sm font-medium text-primary"
```

**Estimate:** 5 minutes

#### ThemeToggle.tsx

**Lines:** 84, 86, 88

```tsx
"text-ink-900"; // → "text-primary"
```

**Estimate:** 5 minutes

#### NavbarButton.tsx

**Lines:** 56

```tsx
"text-ink-900"; // → "text-primary"
```

**Estimate:** 5 minutes

#### button.tsx (variant="outline")

**Lines:** 23

```tsx
"bg-transparent text-ink-900 border-2 border-ink-900 hover:bg-ink-900 hover:text-parchment-50";
// → "bg-transparent text-primary border-2 border-outline-default hover:bg-interactive-accent hover:text-inverse"
```

**Estimate:** 10 minutes

#### typography.tsx

**Lines:** 7, 16-17, 45, 53-54, 80

```tsx
// headingVariants
"text-ink-900"; // → "text-primary"
"text-ink-700"; // → "text-secondary"

// proseVariants
"text-ink-900"; // → "text-primary"
"text-ink-500"; // → "text-tertiary"

// handwritingVariants
"text-ink-700"; // → "text-secondary"
```

**Estimate:** 15 minutes

#### Card.tsx

**Lines:** 33

```tsx
"text-ink-900 font-serif"; // → "text-primary font-serif"
```

**Estimate:** 5 minutes

---

## Migration Strategy

### Approach: Gradual Component-by-Component

Migrate one component at a time to avoid regression risk. Follow this workflow:

1. **Before Migration:**

   ```bash
   # Take visual screenshot of component in both themes
   # Dark mode + Light mode
   ```

2. **During Migration:**

   - Replace primitive tokens with semantic equivalents
   - Run tests: `pnpm test`
   - Type-check: `pnpm type-check`

3. **After Migration:**
   - Visual regression test (compare screenshots)
   - Test in both light/dark modes
   - Commit immediately

### Testing Checklist

- [ ] Light mode renders correctly
- [ ] Dark mode renders correctly
- [ ] No console errors/warnings
- [ ] All tests passing (`pnpm test`)
- [ ] Type-check passing (`pnpm type-check`)

### Total Estimated Effort

**Priority 1:** ~2 hours 15 minutes
**Priority 2:** ~40 minutes
**Priority 3:** ~65 minutes
**Total:** ~4 hours

---

## Future Enhancements

### Design System

- [ ] Extend semantic tokens for feedback states (success/error/warning)
- [ ] Add animation duration tokens (currently scattered constants)
- [ ] Create spacing scale tokens (consistent gaps/padding)
- [ ] Define elevation tokens (shadow system)

### Component Quality

- [ ] Extract more duplicate `renderShell` patterns (Classic mode may have some)
- [ ] Audit for other DRY violations
- [ ] Consider extracting common card patterns into reusable components

### Performance

- [ ] Audit bundle size impact of motion library usage
- [ ] Consider lazy-loading Order mode components (only used by subset of users)

### Documentation

- [ ] Create design token usage guide for new components
- [ ] Document when to use semantic vs primitive tokens
- [ ] Add visual reference for all semantic tokens

---

## Notes

**Why Semantic Tokens?**

- **Information Hiding:** Components shouldn't know about color primitives (ink-900, parchment-100)
- **Theme Flexibility:** Can change entire color scheme by updating semantic token mappings
- **Maintainability:** One place to update visual intent, not 40+ components
- **Clarity:** `text-primary` conveys intent better than `text-ink-900`

**Migration Philosophy:**
Favor **incremental improvements** over **big bang refactors**. Each small PR reduces debt and can be tested/deployed independently.

**Reference:**

- Semantic tokens defined: `src/app/globals.css:30-49`
- Tailwind utilities: `src/app/globals.css:493-539`
- Example migration: OrderGameIsland.tsx (completed)
