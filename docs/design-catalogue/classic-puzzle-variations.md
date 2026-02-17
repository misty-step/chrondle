# Classic Puzzle Page: Visual Design Variations

Five distinct visual treatments for the Chrondle Classic puzzle experience. Each maintains the core NYT Games simplicity while adding subtle depth through elevation, borders, and typographic refinement.

**Core Constraints:**

- NO gradients
- NO glow effects
- Shadows must be subtle (NYT-level restraint)
- Must work in both light and dark mode
- Typography: Outfit (display), Karla (body), SF Mono (numbers)
- Accent color: #2d6a4f (Classic green)

---

## Variation 1: Paper Stock

**Concept:** A clean archival paper aesthetic—think high-quality cardstock with subtle deckled edges and soft shadow elevation.

### Clue Card Treatment

- **Background:** `var(--bg)` (pure white in light, #121213 in dark)
- **Border:** 1px solid `var(--border)` with slightly thicker 2px top border in `var(--mode-classic-accent)` (#2d6a4f)
- **Shadow:** `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)` (light); `0 1px 3px rgba(0,0,0,0.2)` (dark)
- **Border-radius:** 6px (slightly softer than current 4px)
- **Padding:** 2.5rem (increased from current for breathing room)
- **Inner accent:** Subtle 1px dashed line in `var(--border)` at 50% opacity creating a "postage stamp" inner frame

### Take Hint Button

**Light Mode:**

- Background: transparent
- Border: 2px solid `var(--mode-classic-accent)` (#2d6a4f)
- Text: `var(--mode-classic-accent)` (#2d6a4f), font-weight: 600
- Hover: background fills with `#f0f7f4`, text remains accent
- Active: translateY(1px), shadow reduces

**Dark Mode:**

- Background: transparent
- Border: 2px solid `#6ee7b7` (brightened accent for visibility)
- Text: `#6ee7b7`
- Hover: background fills with `rgba(110,231,183,0.1)`
- Prevents "blending in" issue via brightened border/text

### Guess Input Area

- **Container:** Same "paper stock" treatment as clue card (white bg, subtle shadow, accent top border)
- **Year inputs:** Underline style (border-bottom only) with 3px thickness in `var(--border)`
- **Active state:** Underline transitions to `var(--mode-classic-accent)` (#2d6a4f)
- **Typography:** SF Mono at 2.25rem, letter-spacing: -0.02em
- **Era toggle:** Minimal pill style with 1px border

### CSS Tokens

```css
:root {
  --paper-shadow-light: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  --paper-shadow-dark: 0 1px 3px rgba(0, 0, 0, 0.2);
  --paper-accent-border: 2px solid var(--mode-classic-accent);
  --paper-border-radius: 6px;
  --paper-padding: 2.5rem;
  --input-underline: 3px solid var(--border);
  --input-underline-active: 3px solid var(--mode-classic-accent);
}
```

---

## Variation 2: Archival Ledger

**Concept:** A bound ledger aesthetic—ruled lines, official documentation feel, subtle depth through layered borders.

### Clue Card Treatment

- **Background:** `#fafafa` in light (slightly off-white for paper feel), `#1a1a1b` in dark
- **Border:** Double-border technique—outer 1px solid `var(--border)`, inner 4px padding then 1px dashed `var(--mode-classic-accent)` at 30% opacity
- **Shadow:** None (flat documentary style)
- **Structure:**
  - Header strip at top: `var(--mode-classic-bg)` background (#f0f7f4 in light)
  - "Primary Clue" label moved to this strip, left-aligned with subtle icon
  - Event text sits below with generous 2rem top padding

### Take Hint Button

**Light Mode:**

- Background: `var(--mode-classic-bg)` (#f0f7f4)
- Border: 1px solid `var(--mode-classic-accent)` (#2d6a4f)
- Text: `var(--mode-classic-accent)`, font-weight: 600, uppercase, letter-spacing: 0.05em
- Icon: Small document/unlock icon before text
- Hover: background shifts to white, border thickens to 2px

**Dark Mode:**

- Background: `#1a2f25` (subtle dark green tint)
- Border: 1px solid `#6ee7b7`
- Text: `#6ee7b7`
- Hover: background lightens to `#223a2e`

### Guess Input Area

- **Container:** Extends the ledger metaphor
  - Background: same off-white `#fafafa`
  - Top border: 1px solid `var(--border)`
  - Bottom border: Double line (2px solid `var(--mode-classic-accent)` + 4px gap + 1px solid `var(--border)`)
- **Year inputs:** Ruled line aesthetic
  - Background: white (slight contrast from container)
  - Border: 1px solid `var(--border)` on all sides
  - Border-radius: 2px (very subtle)
  - Focus: border-color transitions to `var(--mode-classic-accent)`
- **Labels:** Uppercase, letter-spacing: 0.1em, positioned above inputs with `var(--muted)` color

### CSS Tokens

```css
:root {
  --ledger-bg-light: #fafafa;
  --ledger-bg-dark: #1a1a1b;
  --ledger-header-bg: var(--mode-classic-bg);
  --ledger-double-border:
    1px solid var(--border), inset 0 0 0 4px var(--bg), inset 0 0 0 5px var(--mode-classic-accent);
  --ledger-input-bg: #ffffff;
  --ledger-input-bg-dark: #121213;
  --ledger-label-tracking: 0.1em;
}
```

---

## Variation 3: Museum Label

**Concept:** Gallery exhibit aesthetic—clean, authoritative, with museum-style typography and subtle inset depth.

### Clue Card Treatment

- **Background:** `var(--bg)` with subtle inner shadow creating "inset" feel
- **Shadow (inset):** `inset 0 2px 4px rgba(0,0,0,0.03)` (light); `inset 0 2px 4px rgba(0,0,0,0.2)` (dark)
- **Border:** 1px solid `var(--border)` with left accent bar (4px solid `var(--mode-classic-accent)`)
- **Border-radius:** 2px (sharp, museum-clean)
- **Typography:**
  - Event text: Outfit at 2.5rem, font-weight: 500, line-height: 1.2
  - Color: `var(--text)` (near-black for authority)
- **Header:** "Primary Clue" in Karla italic, `var(--muted)`, positioned top-right like a curator's note

### Take Hint Button

**Light Mode:**

- Background: white
- Border: 1px solid `var(--border)` on top/sides, 3px solid `var(--mode-classic-accent)` on bottom
- Text: `var(--text)`, font-weight: 500
- Hover: bottom border thickens to 4px, subtle lift via `translateY(-1px)`

**Dark Mode:**

- Background: `#1e1e1f` (elevated surface)
- Border: 1px solid `var(--border)` on top/sides, 3px solid `#6ee7b7` on bottom
- Text: `#e4e5f1`
- Hover: elevated surface lightens slightly, border brightens

### Guess Input Area

- **Container:** Same museum aesthetic
  - Background: `#fafafa` (light), `#1e1e1f` (dark)
  - Inset shadow for "plaque" feel
  - Left accent bar matching clue card
- **Year inputs:**
  - Background: `var(--bg)` (pure white in light)
  - Border: 2px solid `var(--border)`
  - Border-radius: 2px
  - Focus: border-color `var(--mode-classic-accent)`, shadow: `0 0 0 3px rgba(45,106,79,0.1)`
- **Submit button:** Filled `var(--mode-classic-accent)`, white text, sharp 2px radius
  - Hover: darken 10%, not lift (maintains museum stability)

### CSS Tokens

```css
:root {
  --museum-inset-light: inset 0 2px 4px rgba(0, 0, 0, 0.03);
  --museum-inset-dark: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  --museum-accent-bar: 4px solid var(--mode-classic-accent);
  --museum-border-radius: 2px;
  --museum-plaque-bg-light: #fafafa;
  --museum-plaque-bg-dark: #1e1e1f;
  --museum-input-bg: var(--bg);
  --museum-focus-ring: 0 0 0 3px rgba(45, 106, 79, 0.1);
}
```

---

## Variation 4: Index Card

**Concept:** Vintage library card catalog aesthetic—slight rotation, tangible paper feel, ink stamp influences.

### Clue Card Treatment

- **Background:** `#fffef8` (warm white, like aged paper) in light; `#1a1917` (warm dark) in dark
- **Border:** 1px solid `#e8e4d9` (warm gray) in light; `#2a2825` in dark
- **Shadow:** `0 2px 0 rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)` (paper lift effect)
- **Border-radius:** 3px 3px 3px 12px (asymmetric, hand-cut feel)
- **Rotation:** Slight `transform: rotate(-0.3deg)` on the card (subtle, not cartoonish)
- **Texture:** Optional subtle dot pattern overlay at 3% opacity (CSS background-image)
- **Top rule:** 1px solid `var(--mode-classic-accent)` spanning full width

### Take Hint Button

**Light Mode:**

- Background: `#fffef8` (match card)
- Border: 1px solid `#d4cfc2` (warm gray)
- Text: `var(--mode-classic-accent)`, Outfit font-weight: 600
- Shadow: `0 2px 0 #d4cfc2` (button press effect)
- Hover: translateY(1px), shadow reduces to `0 1px 0 #d4cfc2`
- Active: translateY(2px), shadow removed

**Dark Mode:**

- Background: `#1a1917`
- Border: 1px solid `#3a3835`
- Text: `#6ee7b7`
- Shadow: `0 2px 0 #000`
- Maintains warm, tactile feel in dark mode

### Guess Input Area

- **Container:** Same index card treatment as clue card
  - Slight opposite rotation: `transform: rotate(0.2deg)` (creates visual interest)
- **Year inputs:**
  - Background: transparent
  - Border-bottom: 2px dashed `var(--border)` (ruled line feel)
  - Focus: dashed border becomes solid `var(--mode-classic-accent)`
- **Typography:** SF Mono at 2rem, slightly more compact
- **Labels:** Written style—Karla italic, like handwritten notes
- **Submit button:** Stamp aesthetic
  - Filled `var(--mode-classic-accent)`
  - Border-radius: 2px
  - Text: uppercase, letter-spacing: 0.08em
  - Slight rotation on hover: `rotate(-1deg)` (like stamping motion)

### CSS Tokens

```css
:root {
  --card-warm-white: #fffef8;
  --card-warm-dark: #1a1917;
  --card-warm-border-light: #e8e4d9;
  --card-warm-border-dark: #2a2825;
  --card-shadow: 0 2px 0 rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.05);
  --card-border-radius: 3px 3px 3px 12px;
  --card-rotation: rotate(-0.3deg);
  --card-input-border: 2px dashed var(--border);
  --card-input-border-focus: 2px solid var(--mode-classic-accent);
}
```

---

## Variation 5: Editorial Slate

**Concept:** Premium editorial aesthetic—magazine-quality spacing, sophisticated typography, refined elevation through layering.

### Clue Card Treatment

- **Background:** White with subtle layered shadow system
- **Shadows (layered):**
  - `0 0 0 1px rgba(0,0,0,0.03)` (hairline border)
  - `0 1px 1px rgba(0,0,0,0.02)` (first lift)
  - `0 2px 4px rgba(0,0,0,0.03)` (soft depth)
  - `0 8px 16px rgba(0,0,0,0.03)` (ambient depth)
- **Border-radius:** 8px (more generous, editorial)
- **Structure:**
  - Event text centered with max-width: 40ch (optimal reading measure)
  - "Primary Clue" label as small caps, centered above with decorative hairlines
  - Vertical breathing room: 3rem padding top/bottom
- **Typography:**
  - Event: Outfit at 2.25rem, font-weight: 450 (slightly lighter), line-height: 1.25
  - Color: #1a1a1b (softer than pure black)

### Take Hint Button

**Light Mode:**

- Background: white
- Border: 1px solid `var(--border)`
- Shadow: `0 1px 2px rgba(0,0,0,0.04)` (micro-elevation)
- Text: `var(--text)`, font-weight: 500
- Hover:
  - Shadow increases: `0 4px 12px rgba(0,0,0,0.08)`
  - Border color: `var(--mode-classic-accent)`
  - Text color: `var(--mode-classic-accent)`

**Dark Mode:**

- Background: `#1e1e1f`
- Border: 1px solid `var(--border)`
- Shadow: `0 1px 2px rgba(0,0,0,0.2)`
- Text: `#e4e5f1`
- Hover:
  - Border: `#6ee7b7`
  - Text: `#6ee7b7`
  - Background: `#252527` (slight lift in brightness)

### Guess Input Area

- **Container:** Same editorial shadow system as clue card
  - No accent borders—purely shadow-defined elevation
  - Generous internal padding (2rem)
- **Year inputs:**
  - Background: `#fafafa` (slight contrast), dark: `#1a1a1b`
  - Border: none (clean look)
  - Shadow: `inset 0 1px 2px rgba(0,0,0,0.05)` (subtle input depth)
  - Border-radius: 6px
  - Focus: ring-2 `var(--mode-classic-accent)` with 2px offset
- **Section title:** "Your Guess" in small caps, letter-spacing: 0.1em, centered
- **Submit button:**
  - Filled `var(--mode-classic-accent)`
  - Full width, height: 3.5rem
  - Border-radius: 6px
  - Shadow: `0 2px 4px rgba(45,106,79,0.2)`
  - Hover: shadow increases, slight darken

### CSS Tokens

```css
:root {
  --editorial-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.03), 0 1px 1px rgba(0, 0, 0, 0.02), 0 2px 4px rgba(0, 0, 0, 0.03),
    0 8px 16px rgba(0, 0, 0, 0.03);
  --editorial-shadow-dark:
    0 0 0 1px rgba(255, 255, 255, 0.05), 0 1px 1px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.3),
    0 8px 16px rgba(0, 0, 0, 0.3);
  --editorial-border-radius: 8px;
  --editorial-input-bg-light: #fafafa;
  --editorial-input-bg-dark: #1a1a1b;
  --editorial-input-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  --editorial-padding-y: 3rem;
  --editorial-max-width-text: 40ch;
}
```

---

## Implementation Notes

### Recommended Priority

1. **Paper Stock** – Safest evolution from current design, minimal changes
2. **Museum Label** – Best for perceived quality/authority
3. **Editorial Slate** – Most modern/premium feel
4. **Archival Ledger** – Best for history/theme alignment
5. **Index Card** – Most distinctive/characterful (risk: polarizing)

### Dark Mode Considerations

All variations address the current dark mode issues:

- **Take Hint button:** Uses brightened accent (`#6ee7b7`) for visibility
- **Clue card:** Maintains elevation through adjusted shadow opacity
- **Input area:** Clear visual hierarchy via background contrast or borders

### Accessibility Requirements

- All focus states must maintain 3:1 contrast ratio
- Interactive elements need visible focus rings
- No information conveyed through shadow/elevation alone
- Reduced motion: disable transforms (rotations, lifts)

### Migration Path

1. Add CSS custom properties to `:root` in `globals.css`
2. Create variation-specific utility classes
3. Test one variation fully before implementing others
4. Consider feature flag for A/B testing variations
