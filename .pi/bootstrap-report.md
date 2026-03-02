# Pi Bootstrap Report (Verified)

- Domain: chrondle
- Repo: [ROOT_DIR]/chrondle
- Generated: 2026-03-02
- Package manager: bun
- Stack hints: convex, nextjs, react, tailwindcss, typescript, vitest

## Context Digest

### Core Conventions

1. **Package manager**: Bun is strictly required. `pnpm` and `npm` are blocked.
2. **Core game invariant**: Never leak answer through UI. BC/AD toggle must never auto-select.
3. **Canonical code**: `useRangeGame` is the active hook; `useChrondle` is dead code.
4. **Scoring formula**: Quadratic interpolation with 4% minimum floor as documented in `AGENTS.md`.
5. **Stack**: Next.js 15, React 19, Convex, Tailwind CSS v4.

## Critical Infrastructure Findings (To be Addressed)

1. **Deploy Race Condition**: `deploy.yml` runs in parallel with CI. This should be gated.
2. **CI Validation Gaps**: `validate-puzzles` CI job may silently pass if Convex is unreachable.
3. **Environment Security**: Ensure `.env.production` and `.env.vercel` are never accidentally tracked.

## High-Value References

- **Next.js 15 Caching**: Un-cached by default (`no-store`).
- **React 19 Forms**: Use `useActionState` and `useFormStatus`.
- **Convex React 19**: Clean boundaries between Server and Client components.
- **Tailwind CSS v4**: CSS variable-based theme configuration.
