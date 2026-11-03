# Chrondle feature map

Navigation shared by verification and fitness. [SPEC.md](../SPEC.md) is the sole
intent home; inline US IDs resolve within its Classic section. Other sections
are referenced by anchor, not newly invented IDs. README features without a SPEC
contract (including remaining Duel/Order/archive/billing intent) are spec gaps,
not inferred acceptance. Setup/checks remain in [README](../README.md).

| SPEC reference | Reach and drive | Existing control |
| --- | --- | --- |
| [US-001–005](../SPEC.md#classic-player-journey) | Open `/`, choose today's Classic, inspect first clue and Hint, edit both range endpoints/eras, inspect invalid draft, correct it. Commit/result/reminder steps only on an authorized target; do not expose an unearned answer in proof. | `e2e/classic-range-entry.spec.ts`, `game-flow.spec.ts`, `daily-identity.spec.ts`, `habit-loop.spec.ts`; inspect Playwright target first. |
| [Player account privacy](../SPEC.md#player-account-privacy) | Existing sign-in/profile/settings/archive surfaces with separately approved identities; compare own/other/anonymous reads only in the authorized integration target. No email sends or account creation by default. | Existing auth/privacy tests and `verify:auth` scripts; configured production credentials are not authorization. |
| [Event operations](../SPEC.md#event-operations) | Operator/admin interface and README operator scripts; exercise missing-credential/forbidden/dry-run refusal locally. Generation/backfill are paid/write actions, not ordinary live QA. | Existing script and backend tests; never call provider generation just for screenshots. |
| [Privacy-safe measurement](../SPEC.md#privacy-safe-measurement) | Fresh browser navigation with supported DNT; use existing analytics checks for explicit collection/failure controls. | `src` analytics and backend tests; synthetic traffic is not adoption. |
| [Browser failure reporting](../SPEC.md#browser-failure-reporting) | Owned isolated app with explicit failure/recovery control; inspect authorized sink only when granted. | Existing error-reporting tests; a local mock is not remote delivery proof. |

Use `verify-chrondle`; retain actual commands, source/serving identity and inspected
media. Attach sanitized proof to card and PR, and name unwalked/spec-gap features.
