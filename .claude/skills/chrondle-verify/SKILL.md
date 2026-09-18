---
name: chrondle-verify
description: >
  Run before claiming any chrondle change is done. Runs the fast local gate
  and the Dagger-wrapped CI-equivalent gate — the same two things
  .github/workflows/ci.yml enforces on every PR — so "green locally" and
  "green in CI" mean the same thing. Use when finishing a change, before
  opening a PR, or when asked to "verify", "run the gate", "run CI locally",
  or "check this is ready to ship".
---

# chrondle-verify

Chrondle is gated by two loops, not one. `AGENTS.md`'s pre-commit line
(`bun run lint && bun run type-check && bun run test`) is the fast local
loop. `.github/workflows/ci.yml` actually gates PRs with the **Dagger**
wrapped equivalent (`dagger call quality --check=lint|type-check` and
`dagger call test-coverage-artifacts`) — a different execution path that can
catch things the raw `bun run` commands don't (e.g. coverage thresholds).
Run both before calling a change done; the fast loop first (cheap, tight
iteration), the Dagger loop before opening or merging a PR.

## Fast local gate (iterate on this)

```bash
bun run lint && bun run type-check && bun run test
```

Matches `package.json`'s `lint` / `type-check` / `test` scripts exactly.
This is the loop to run in a tight edit-test cycle.

## CI-equivalent gate (Dagger — matches what actually gates the PR)

Requires the `dagger` CLI and a working Docker/Colima backend
(`scripts/dagger-local.sh` auto-detects Colima via `CHRONDLE_COLIMA_PROFILE`,
default `default`).

```bash
bun run ci:dagger:lint          # dagger call quality --check=lint
bun run ci:dagger:type-check    # dagger call quality --check=type-check
bun run ci:dagger:coverage      # dagger call test-coverage-artifacts --output=coverage
```

These three map 1:1 to the `quality-checks` matrix (`lint`, `type-check`,
`test`) in `.github/workflows/ci.yml`. Run all three before opening a PR if
Dagger/Docker is available locally; if it isn't, say so explicitly rather than
treating the fast local gate as CI-equivalent proof — they are not the same
gate.

Other `ci:dagger:*` scripts exist for the non-matrix CI jobs:
`ci:dagger:validation`, `ci:dagger:docs`.

## Known gaps (do not paper over)

- If `bun run lint`/`type-check`/`test` fails on files you did not touch
  (e.g. stray scratch files from another agent session at repo root), that is
  pre-existing pollution, not your regression — name it explicitly in your
  proof rather than silently treating the run as green or quietly fixing
  unrelated files.
- A fast-local pass is not proof the PR will go green — only the Dagger gate
  or the actual CI run is.

## Deployed-surface checks (separate from the code gate)

Not part of the merge gate, but the discoverable commands for verifying the
live app — see "Deployed Surfaces" in `AGENTS.md` for when to run each of
`bun run deploy:verify`, `bun run deployment:check`, and
`bun run validate-puzzles`.
