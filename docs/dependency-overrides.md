# Dependency Overrides

## Overview

This repository uses Bun and keeps transitive security remediations in the top-level
`package.json` `overrides` field. These overrides exist to force patched versions
of vulnerable transitive packages when upstream dependencies have not yet caught up.

## Current Policy

- Prefer direct dependency upgrades first.
- Use `overrides` only for transitive fixes we need immediately.
- Keep production audit green with `bun audit --production --audit-level moderate`.
- Remove overrides once upstream ranges make them unnecessary.

## Current Commands

```bash
bun install
bun run audit:prod
bun why esbuild
bun why ws
```

## Maintenance

Review overrides when any of these happen:

- `bun audit --production --audit-level moderate` reports a new advisory.
- Bun, Next.js, Vitest, Dagger, or other high-fanout tooling gets upgraded.
- An override starts conflicting with Bun install behavior or lockfile resolution.

To test removal of a specific override:

```bash
# 1. Remove the override from package.json
# 2. Reinstall from scratch
rm -rf node_modules bun.lock
bun install

# 3. Re-run the production audit
bun run audit:prod
```

If the advisory reappears, restore the override and keep tracking the parent dependency.

## Notes

- Bun does not support every package-manager-specific override feature, so keep
  overrides flat and simple.
- CI and local Dagger quality gates both run the production audit, so broken or
  stale overrides fail fast.

_Last updated: April 9, 2026_
