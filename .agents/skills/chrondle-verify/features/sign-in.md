# Owner sign-in

The owner signs in to production chrondle with an emailed one-time code and
reaches the owner-only admin dashboard. Clerk (`clerk.chrondle.app`) offers
email code and Google; this journey uses the email code because an agent can
read the owner's inbox.

## Sub-features

- `sign-in-request-code` asks Clerk to email a code to the owner.
- `sign-in-wrong-code` refuses a wrong code and stays on the code step.
- `sign-in-owner-session` creates a session for the owner identity.
- `sign-in-owner-page` renders `/settings` and the owner-only `/admin/dashboard`.
- `sign-in-owner-streak` shows the owner's server-side streak in the header (read only).
- `sign-in-reused-code` refuses a spent code in a new sign-in attempt.

## How to get to it (user POV)

- Choose the sign-in icon in the header, or open any signed-in page
  (`/settings`, `/admin/dashboard`), which redirects to
  `/sign-in?redirect_url=…`.
- Enter `phraznikov@gmail.com`, choose `Continue`, type the 6-digit code from
  the email sent by `noreply@chrondle.app`.

## Driving it with chrondle-verify

Preconditions:

- `pass-env run -e FASTMAIL_API_TOKEN=workstation/FASTMAIL_API_TOKEN -- node $H doctor`
  passes, including `owner inbox reachable`.
- Owner identity: `phraznikov@gmail.com` (Clerk production user with
  `publicMetadata.role = "admin"`). Gmail forwards it to phaedrus's Fastmail
  account, which the token reads over JMAP.

Run `pass-env run -e FASTMAIL_API_TOKEN=workstation/FASTMAIL_API_TOKEN -- node $H sign-in`.

- **Request code.** Open `/sign-in`, fill `Email address`, choose `Continue`.
  The code step appears (`input[name="code"]`).
- **Wrong code.** Type `000000`. An "incorrect code" message appears and no
  session exists. Evidence: `sign-in-wrong-code.png`.
- **Real code.** The helper polls the owner inbox for a 6-digit code from
  `chrondle.app` received after the request (up to 180 s) and types it. The
  value is never printed. `window.Clerk.user` exists and its primary email is
  the owner's.
- **Owner pages.** `/settings` shows the `Settings` heading;
  `/admin/dashboard` stays on that path and shows the `Admin Dashboard`
  heading. Evidence: `sign-in-admin-dashboard.png`.
- **Owner streak.** `/classic` header shows `Current streak: N day streak`
  from the owner's account, or nothing when it is 0. No guess is made.
- **Reused code.** Clear the session, request a new code, type the spent
  code. It is refused and the browser stays signed out.
- **Writes.** `check backend writes` lists only `users:getOrCreateCurrentUser`
  (and puzzle ensure calls), which signing in itself causes.

## Gotchas

- The fresh browser profile matters: signing in from a profile with
  anonymous play merges that play and streak into the owner's production
  account (`users:mergeAnonymousState`, `users:mergeAnonymousStreak`). The
  helper always uses a new context; never reuse one that played.
- No code in the inbox means Clerk did not send it, not that the agent was
  slow. On 2026-10-20 this was the failure: the 2026-10-13 move of chrondle.app
  DNS to Cloudflare kept only `clerk.chrondle.app` and dropped the other four
  CNAMEs Clerk requires (`accounts`, `clkmail`, `clk._domainkey`,
  `clk2._domainkey`), so Clerk said a code was sent and none arrived. Compare
  the zone against Clerk's `dns_targets` (Clerk Backend API `GET /v1/domains`)
  before suspecting the helper.
- The four records were restored at 22:47Z on 2026-10-20. Codes still did not
  arrive at 23:25Z, so Clerk also needs its domain email configuration
  re-verified (Clerk Dashboard → chrondle production → Domains → Email).
  Until that happens, this journey fails at "read the code" and owner sign-in
  stays unproven.
- phaedrus normally signs in with Google: the owner user's only linked
  provider is `oauth_google`. Email code is the agent's route to the same
  identity, so it matters even when Google works.
- Each run sends phaedrus two code emails and a new-device notice. Run once
  per proof, not in a loop.
- Expired code (Clerk codes last 10 minutes) is not driven: waiting it out
  costs a run 10 minutes and another email. Reused and wrong codes are.
- Wrong identity (a signed-in non-admin opening `/admin/dashboard` is sent
  to `/?error=unauthorized`) needs a second real account; the manual GitHub
  workflow `clerk-live-verification.yml` creates and deletes a synthetic
  user but does not check the admin redirect.
- Google sign-in is not driven: it needs the owner's Google session.
