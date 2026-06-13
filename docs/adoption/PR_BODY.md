# Adopt @misty-step/aesthetic as the design system

chrondle was already calm, scholarly, ink-on-paper — philosophically
the design system's own register. This adopts aesthetic as the
substrate: the Tailwind bridge, Geist, and the primitives, with the
scholar's green as the steering accent and the four game modes
preserved as **project tokens** under the steering doctrine.

## Steering — the scholar's green + game-mode project tokens

```css
:root {
  --ae-accent: #1f7a55; /* scholar's green */
  --ae-accent-dark: #6ee7b7;
  /* the game modes ride content as project tokens — never filled pills */
  --chrondle-order: #b45309; /* AA 4.89 / 11.22 */
  --chrondle-groups: #28587b; /* AA 7.38 / 10.47 */
  --chrondle-duel: #a81e3f; /* AA 7.00 / 6.96 */
}
```

Each game mode keeps its personality, but as a hue on the heading,
the mode glyph, and the call-to-action — not as a filled tinted card.
Every pair passes AA on both surfaces.

## What changed

- **`package.json`** — depends on `github:misty-step/aesthetic#v2.5.1`.
- **`app/globals.css`** — the bridge maps the canonical ADOPTING.md §5
  token names; chrondle's parallel CSS-variable layer collapses onto
  the `--ae-*` tokens plus the steering block. Radius scale → 0.
- **Fonts** — Geist + Geist Mono via `next/font` wired to
  `--ae-font`/`--ae-font-mono` (Outfit + Karla retire); years and
  puzzle numbers become tabular `.ae-num` mono.
- **Components** — `button`, `input`, `dialog`, `Card`, `Badge`
  (→ `.ae-tag`, no filled pill), `ThemeToggle` (→ `.ae-mode`), and
  `toaster` (→ `.ae-toast` slips, status on the glyph) re-costumed onto
  the system. Convex/Clerk flows untouched.

## Verification

- `bun run type-check` · `bun run lint` (fixed one leftover unused
  import) · `bun run build` — all green against the v2.5.1 tarball.
- Visual: home rendered in both modes (below); the auth- and
  Convex-backed game boards were left to manual review (they need a
  signed-in session).

### Before / after — the mode hub (light)

Filled tinted mode-cards (green / amber / blue washes, rounded) →
hairline-framed cards on paper, each mode's hue riding its glyph,
heading, and CTA as a project-token accent; radius 0; the registers
carry the hierarchy:

![before](docs/adoption/before-home-light.png)
![after](docs/adoption/after-home-light.png)

## One open question for review

The hero **"Chrondle"** wordmark is still set at display scale. The
strict reading of the one-size law makes it weight-800 at the body
size (loud by weight, not scale — the `.ae-strong` answer). It's left
at display size here as a brand-logotype judgment; happy to collapse
it if you'd rather hold the line.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
