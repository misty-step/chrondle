# Chrondle behavior

## Player account privacy

- As a first-time signed-in player, my account is created on demand from my
  verified Clerk identity. Returning authenticated requests reuse that account
  and preserve its progress and entitlement. Anonymous requests cannot create an
  account. Account provisioning does not require a Clerk webhook or sync secret.
- As a signed-in player, I can read my own profile, account-existence result,
  subscription entitlement, Classic progress and completed puzzles, and Order
  progress and completed plays. Ownership comes from my verified sign-in, never
  from a player ID supplied in a request.
- Anonymous callers and other players cannot read my account details, discover
  whether my account exists, or retrieve either mode's progress or history.
  Unauthorized single-record reads return no record; history reads return an
  empty list and entitlement checks return false.
- Existing clients may still supply their own account/player ID. Supplying
  another player's ID never changes the authenticated owner or exposes that
  player's state.
- Server-rendered archives and settings, checkout trial checks and billing
  portal requests use the requesting player's verified identity. A server-side
  request without a verified player token has no additional account access.
- Verified identity and billing webhooks can continue their existing trusted
  internal account operations without exposing those operations as public
  account/history reads. Ordinary callers cannot invoke internal operations or
  bypass billing webhook verification. There is no Clerk webhook endpoint.

## Event operations

- As an operator, I can update event metadata and manually run year-event
  generation or metadata backfill using my authenticated admin identity.
- Anonymous callers and signed-in players without the admin role cannot perform
  these operations. Rejection happens before reading backfill work, changing
  metadata, or starting a paid generation request. Caller-supplied user IDs or
  role arguments do not grant access.
- Operational scripts authenticate with the same operator identity as the admin
  interface. Missing credentials fail before doing work. Metadata backfill uses
  the server's shared backfill pipeline, not a separate client-side paid path.
- Scheduled internal generation and backfill continue without a player identity.

## Classic player journey

- US-001: As a player, I can open today's classic puzzle without signing in,
  see its first historical clue and independent start/end year inputs. Today is
  my local calendar day. A ready puzzle emits `game_loaded` once per puzzle visit,
  including readiness after loading, not on every render.
- US-002: I can deliberately reveal the next available clue before submitting.
  The UI shows revealed clues and their scoring cost without suggesting the
  target year or era. Each reveal emits `hint_viewed` with its ordinal only.
- US-003: I can type both range endpoints and independently select BC/AD. Invalid
  input cannot be committed. Deliberately locking a valid range accepts one
  classic attempt and emits `guess_submitted`; rejected commits do not. Anonymous
  play stays local; signed-in play uses authenticated persistence.
- US-004: After an accepted commit I see the result, score and earned answer,
  with focus on the result. `game_completed` fires once for that commit, not on
  restoring an already completed puzzle or merely revisiting its result.
- US-005: After daily completion I see the local-midnight countdown and can
  request an all-day calendar reminder. Clicking it emits `reminder_optin` with
  game mode, never calendar content or account details.

## Privacy-safe measurement

Page visits and these five story events use one anonymous, host-scoped browser
identifier and SDK sessions. They include `app=chrondle`, source revision,
environment and a synthetic-traffic flag. Isolated builds and detected automation
are synthetic; usage consumers exclude synthetic/non-production events.

Only route templates, bounded counts, booleans and enumerated modes are sent.
Never send account IDs, emails, input/clue text, guessed/target years, raw private
paths, URL queries/fragments, referrers, identifying IPs or user-agent strings.
No person profiles, autocapture, session recording, surveys or exception capture.
Respect Do Not Track. The anonymous cookie expires after 30 days. Missing keys,
failed SDK loads and analytics outages never block gameplay. The official SDK
owns transport, batching and retries, not a second event collector.

## Browser failure reporting

- As a player, handled application errors, uncaught browser errors and unhandled
  promise rejections reach the existing remote error service with the build's
  exact source revision and environment, so an operator can identify the release.
- Reports redact emails and credentials before leaving the browser. They do not
  collect account identity, cookies, request headers, page query strings, replay,
  analytics or interaction breadcrumbs.
- The existing owned alert intake receives new errors and unhandled failures.
  An unavailable or rejecting error service never blocks gameplay; later errors
  can be reported once the service recovers. No persistent retry queue is kept.

The game's remaining observable behavior still needs specification; absence here
does not establish new gameplay, billing or persistence intent.
