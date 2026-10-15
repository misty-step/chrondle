# ADR 0002: Build public release notes from the generator's changelog

- Status: Accepted for the notes-consumer slice; release publication repair remains pending.
- Date: 2026-10-15
- Release unit: the Chrondle application.

## Context

The semantic-release tag history reaches v1.7.3 (source
3728e292264ed49f6e298283c91724e14c87681d). Its generated CHANGELOG.md is
maintained, but the public release view read a separately authored v1.0.0
snapshot. The private package manifest also stayed at v1.0.0.

## Decision

Keep semantic-release as the only version generator and follow the shared
[release convention](https://github.com/misty-step/harness/blob/master/docs/release-convention.md)
and [foundations](https://foundations.mistystep.io/).

Read CHANGELOG.md only in next.config.ts at build time, embedding its public
Markdown as CHRONDLE_CHANGELOG in the compiled bundle. `/changelog` and the existing
release-detail URLs render from that constant, including on-demand rendering in
the Worker; they never read repository files at runtime. No site-wide cache change
is needed. Remove the stale content snapshot and its parallel types.
The footer and health response report the newest generated
version in that same artifact, not the private package manifest. The legacy
`/releases` index redirects to `/changelog`. Unknown release details return 404.
No GitHub request, credential or synthesis is needed to serve or build notes.

`bun run test:worker-routes` ports the isolated native workerd check from
[Linejam PR577](https://github.com/misty-step/linejam/pull/577). It exercises the
already-built OpenNext artifact with deployed compatibility settings, no real
credentials, and all outbound requests denied. It checks notes, every known
release, the alias redirect and an unknown-version 404, rejecting streamed render
errors and runtime error logs. PR CI runs it and production runs it between the
existing frontend build and activation, without rebuilding the tested bytes.

## Scope and remaining work

This slice repairs the consumer only. It does not change the existing backend-first
Cloudflare CD, semantic-release configuration or published history. Until the next
slice removes semantic-release's default-branch release commits and binds generated
notes to the build, a source build reports the releases already in its checkout;
it does not claim a later release-bot commit is deployed. Keep the immutable v1.7.3
baseline; do not hand-edit versions or retag history. Backend data is not restored
by a frontend code rollback.

The repository has no SPEC.md. This verification uses README's existing anonymous
Classic draft and theme behavior plus the notes consumer's tested behavior; it
records the missing product spec rather than inventing product stories.
