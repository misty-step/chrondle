# src/components/kit — Chrondle's bespoke UI kit

Reusable, game-agnostic-ish building blocks that are **not** managed by the
shadcn registry: `Card`, `Badge`, `EraToggle`, `SubmitButton`, `ShareButton`,
`ProgressBar`, the icon adapter (`icons/`), etc.

**Contract**

- Files here are hand-authored and safe from `bunx shadcn add` regeneration,
  which only writes into `src/components/ui/` (the `components.json` `ui`
  alias). That split exists because the filesystem is case-insensitive:
  keeping a customized `Badge.tsx` next to registry-owned lowercase files
  meant a future `shadcn add badge` could overwrite it.
- Components must be token-driven: use semantic tokens from
  `src/app/globals.css` (`feedback-*`, `surface-*`, `mode-*`, `border`,
  `foreground`, ...), never raw hex or primitive Tailwind palette colors.
- Feature-specific compositions (game boards, modals, screens) belong in
  `src/components/` proper, not here.
