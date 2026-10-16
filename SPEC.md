# Chrondle behavior

## Player account privacy

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
  bypass the webhook's existing verification boundary.

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

This initial contract covers account privacy and event operations. The existing
game's complete observable behavior still needs specification; absence here does
not establish new gameplay, billing or persistence intent.
