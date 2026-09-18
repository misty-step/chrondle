# src/components/ui — shadcn registry primitives ONLY

This directory is the `ui` alias target in `components.json`. Everything in it
is owned by the shadcn registry: `bunx shadcn add <component>` writes lowercase
files (`button.tsx`, `dialog.tsx`, ...) directly into this folder and may
overwrite what is here.

**Contract**

- Only registry-managed, lowercase-named primitives live here.
- Chrondle-specific composed components live in `src/components/kit/`
  (see its README). Never add PascalCase custom components here — on a
  case-insensitive filesystem `shadcn add card` would silently clobber a
  custom `Card.tsx`.
- Local edits to these files are allowed (tokens, variants) but must be
  reviewed against the registry diff whenever a component is re-added or
  updated.
