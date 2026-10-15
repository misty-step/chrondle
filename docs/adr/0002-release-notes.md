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

Render `/changelog` and the existing release-detail URLs at build time from
CHANGELOG.md in the checked-out source. Remove the stale content snapshot and
its parallel types. The footer and health response report the newest generated
version in that same artifact, not the private package manifest. The legacy
`/releases` index redirects to `/changelog`. Unknown release details return 404.
No GitHub request, credential or synthesis is needed to serve or build notes.

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
