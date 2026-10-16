# 0003 — Deleting Rust web slices on the existing Worker

The first route family is public discovery (`robots.txt`, `sitemap.xml`) and
permanent legacy links (`groups`, `archive/groups`, `releases`). These contracts
are now in SPEC.md; the retired TypeScript sitemap, Next redirect declarations
and release-index component are removed together with their replacement.

Use the same workers-rs layout as Overmind: a native-testable renderer with a
`cfg(wasm32)` fetch entry, the official worker-build output, and the existing
Cloudflare release identity. `web/entry.mjs` is only an adapter between the
workers-rs and retained OpenNext runtimes. An unmarked response falls through;
Rust owns its route table once. Forward the original request to OpenNext without
reading its body or changing headers, preserving existing auth, POST, analytics,
assets and UI behavior. No second Worker, service binding, domain or data store
is introduced. OpenNext's named exports remain available through the adapter.

Discovery reads the existing anonymous Convex-compatible HTTP query boundary,
using only the configured backend origin and fixed count queries. Caller
credentials and query parameters are never forwarded. Provider errors retain
the static sitemap and log only a bounded diagnostic, not an upstream body.
No billing, account, accepted-state or backend migration occurs in this slice.

These machine-readable routes have no interactive UI; rendering them as XML/text
needs no Leptos island or browser JavaScript. Interactive replacements use the
shared Leptos 0.8 CSR-island decision rather than introducing another UI stack.
Legal/marketing/release HTML stays on its current shell until its controls,
themes, authentication and telemetry can be replaced without a regression.

Build once with `bun run build:cf`. Wrangler's source-owned main is the adapter;
both the native checks and release route verification consume that same main and
its assets, not a separately rebuilt artifact. Rust carries the same build-time
`CHRONDLE_REVISION` as Next. Worker version rollback restores both bundled
runtimes atomically; the backend-origin compatibility rule in the deployment
guide still applies. Native Next development alone no longer owns the replaced
routes; `bun run preview:cf` runs the whole application.
