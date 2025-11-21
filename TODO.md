# TODO

> **"Atomic. Actionable. Done."**

## Now (This Week)

- [x] **Architect Semantic Design Token System**

  - **Context**: The current system mixes generic shadcn tokens (`--primary`, `--card`) with one-off aesthetic overrides. `GamesGallery` uses hardcoded hexes. We need a single source of truth that maps "Materials" and "Intents" to primitives.
  - **Action**:
    1.  Update `globals.css` to define semantic layers:
        - **Primitives**: Define the raw palette (e.g., `--color-vermilion-500`, `--color-parchment-100`).
        - **Materials**: Define surface types (e.g., `--material-paper-warm`, `--material-ink-primary`).
        - **Intents**: Map semantic roles (e.g., `--action-primary`, `--feedback-success`) to materials.
    2.  Update `tailwind.config.mjs` to expose these as first-class Tailwind classes (e.g., `bg-paper-warm`, `text-ink-primary`).
    3.  Include the specific `Classic` and `Order` mode themes from `GamesGallery` as standard tokens.
  - **Files**: `src/app/globals.css`, `tailwind.config.mjs`

- [x] **Create "Deep" Component Library**

  - **Context**: Components currently leak implementation details (e.g., requiring `className` overrides for basic styling). They should encapsulate the "Archival" aesthetic completely.
  - **Action**:
    1.  **Refactor Button**: Create a deep `<Button>` that handles its own "ink bleed", border weights, and uppercase tracking based on `variant` props.
    2.  **Refactor Card**: Create a `<Card>` that includes the paper texture layer and hard shadow automatically.
    3.  **Create Typography Components**: Introduce `<Heading>`, `<Prose>`, `<Handwriting>` components that encapsulate font families and scales, removing the need for manual `font-serif text-xl` chains.
  - **Files**: `src/components/ui/button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/typography.tsx` (new)

- [x] **Implement Material Utilities**
  - **Context**: Textures and shadows are currently applied via disparate CSS classes or inline styles.
  - **Action**: Create composed utility classes in `globals.css` (layer `utilities`) that apply multiple properties at once:
    - `.material-paper`: Applies background color + noise texture + subtle border.
    - `.material-stamp`: Applies rotation + scale + fade-in animation.
  - **Files**: `src/app/globals.css`

## Next (This Month)

- [x] **Apply Design System to GamesGallery**

  - **Context**: `GamesGallery.tsx` has hardcoded values that should now be redundant.
  - **Action**: Refactor `GamesGallery.tsx` to use the new Semantic Design Tokens.

- [x] **Stamp Animation for Guess Commit**

  - **Context**: The visual feedback for locking in a guess is currently generic.
  - **Action**: Implement a Framer Motion variant for the "commit" action using the new `.material-stamp` utility concept.
  - **Files**: `src/components/GameLayout.tsx`

- [x] **Interactive Timeline**
  - **Context**: The range slider is generic.
  - **Action**: Replace with a custom component that uses the "Ruler" metaphor (ticks, sliding indicator) using the new design tokens.
