## TODO

- [x] Add Sentry bootstrap (client/server) helpers  
       Files: `src/observability/sentry.client.ts`, `src/observability/sentry.server.ts`, optional `src/observability/hash.ts`  
       Goal: Initialize Sentry (no-op if DSN missing), expose `captureClientException`, `captureServerException`, `setUserContext` with hashed IDs, sampling/env/release wiring.  
       Approach: (1) Import `@sentry/nextjs`; (2) configure DSN/env/release/sampling from env; (3) hash userId/clerkId; (4) guard on missing DSN; (5) add redaction for ordering arrays >10 items.  
       Success: Init does not throw when DSN absent; capture helpers callable in dev/prod; user/tags redacted.  
       Tests: unit for hashing/redaction + no-op when DSN undefined.  
       Estimate: 1.25h

- [x] Replace placeholder Toaster with real toast system  
       Files: `src/components/ui/Toaster.tsx`, `src/hooks/use-toast.ts` (ensure addToast always present), `src/components/ui/__tests__/Toaster.test.tsx`  
       Goal: Visible, accessible toast queue with destructive variant and optional action.  
       Approach: (1) Context + reducer for queue; (2) portal render; (3) aria-live polite; (4) auto-dismiss 6–8s; (5) expose `addToast/removeToast`; (6) style with existing tokens.  
       Success: Toast renders in app layout; `useToast()` never returns undefined; tests cover render + dismissal.  
       Tests: RTL unit for add/dismiss/action callback.  
       Estimate: 1.5h

- [x] Mutation error adapter for Convex calls
      Files: `src/observability/mutationErrorAdapter.ts`
      Goal: Normalize mutation errors (validation/auth/network/server) after retries, capture once via Sentry client helper.
      Approach: classify errors, map to `{code,message,retryable,traceId?}`, call capture on final failure, return `[result,error]` tuple helper.
      Success: Adapter returns structured error; only one capture per failure path; retryable flag set correctly.
      Tests: unit classify + capture guard.
      Estimate: 1h

- [x] Wire order submit flow to adapter + toast Files: `src/hooks/useOrderGame.ts`, `src/components/order/OrderGameIsland.tsx`  
       Goal: Surface Convex submit failures to user and Sentry; keep success path intact.  
       Approach: wrap `submitOrderPlayMutation` with adapter; return commit result; in `OrderGameIsland` show destructive toast on error; keep retries; log via logger.  
       Success: On validation/auth failure toast shows server message within 1s; success path unchanged.  
       Tests: integration/unit updating `useOrderGame.auth-submit.test.tsx` to expect structured error + toast call (mock).  
       Depends: Mutation error adapter, Toaster.  
       Estimate: 1.25h

- [x] Convex observability wrapper and apply to `submitOrderPlay`
      Files: `convex/lib/observability.ts`, `convex/orderPuzzles/mutations.ts`
      Goal: Capture/metric errors with reason tags; optional Slack webhook; rethrow original.
      Approach: create `withObservability` decorator; classify reasons; call Sentry server helper; emit `order.submit.failure` metric; optional Slack post; wrap handler.
      Success: Mutation behavior unchanged on success; errors logged+captured; metrics increment; tests (Convex action/mutation unit) validate wrap classification.
      Depends: Sentry server helper.
      Estimate: 1.25h
- [x] Deploy workflow: Sentry release + sourcemaps
      Files: `.github/workflows/deploy.yml`
      Goal: Create Sentry release per commit; upload Next (and Convex if path known) source maps; pass release/env into build.
      Approach: add getsentry/action-release step; export `SENTRY_RELEASE=${{ github.sha }}` env; add sourcemap upload commands; keep cache steps intact.
      Success: Workflow interpolates release version; steps gated on secrets; does not break build.
      Tests: dry-run via workflow syntax check (CI), local lint of YAML if available.
      Estimate: 0.75h
- [ ] Env/docs updates  
       Files: `.env.example`, `docs/observability.md` (or new section), `README.md` short note if needed  
       Goal: Document new envs (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, sampling vars, optional `ORDER_FAILURE_SLACK_WEBHOOK`).  
       Success: Templates list all required/optional vars; no secrets committed.  
       Estimate: 0.5h

- [ ] Test sweep + quality gates  
       Files: new/modified test files; ensure `pnpm lint`, `pnpm type-check`, targeted `pnpm test:unit`/`test:integration` for new suites  
       Goal: Validate new modules; ensure no CI regressions.  
       Success: Lint/type/tests green locally; coverage for new logic; no snapshot reliance.  
       Depends: prior tasks.  
       Estimate: 0.75h

### Out of scope (leave in BACKLOG if desired)

- Session replay enablement toggle beyond env wiring.
- Broad OTEL trace correlation changes outside submit flow.
- Additional UI polish for non-order toasts.
