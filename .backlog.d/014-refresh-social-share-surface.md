# Refresh social share surface

Priority: low
Status: ready
Estimate: S

## Goal
Make the social preview and share image feel crisp, legible, and intentionally branded instead of oversized or muddy.

## Non-Goals
- Rebuild the whole marketing site
- Change the metadata plumbing that already exists
- Fold Product Hunt kit maintenance into the same diff unless directly needed for the share surface

## Oracle
- [ ] [behavioral] The OG/share image reads cleanly at common social-preview sizes and reflects the product’s current visual language.
- [ ] [behavioral] The updated share asset is wired through the existing metadata surface without regressions.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#191`
- Evidence: issue `#191` remains an open qualitative complaint about the current share image even though the metadata plumbing is already in place.
- Touchpoints: `public/og-image.png` or generator source, `src/app/(app)/layout.tsx`, any supporting asset-generation scripts.
