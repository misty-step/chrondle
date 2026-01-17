# INCIDENT: Stripe Subscription Not Unlocking Archive

**Reported**: 2026-01-17 15:51 CST
**Reporter**: phraznikov@gmail.com (project owner)
**Status**: RESOLVED
**Severity**: P1 (Revenue-impacting, customer-facing)
**Duration**: ~30 minutes (customer impact), ~25 minutes (investigation)

---

## Executive Summary

A paying customer completed Stripe checkout but their subscription was not activated. The root cause was a **307 redirect** from `chrondle.app` to `www.chrondle.app` that broke Stripe webhook delivery. The investigation initially pursued a red herring (duplicate webhook endpoints) before the actual cause was identified through systematic verification. Customer was unblocked via manual sync within 15 minutes; infrastructure fix completed within 30 minutes.

**Key Lesson**: Configuration is not reality. Verification with observables (logs, metrics) must happen before declaring any incident resolved.

---

## Timeline (UTC)

| Time             | Event                                                               |
| ---------------- | ------------------------------------------------------------------- |
| 2026-01-16 16:28 | First webhook endpoint created for `chrondle.app` (non-www)         |
| 2026-01-17 17:57 | Second webhook endpoint created (same URL, different secret)        |
| 2026-01-17 21:00 | Stripe env vars added to Vercel production                          |
| 2026-01-17 21:18 | Production deployment with new env vars                             |
| 2026-01-17 21:51 | Customer completed Stripe checkout                                  |
| 2026-01-17 21:51 | Webhook delivery failed silently (307 redirect)                     |
| 2026-01-17 21:51 | Customer reported archive still locked                              |
| 2026-01-17 21:58 | Investigation started                                               |
| 2026-01-17 22:02 | **False hypothesis**: "duplicate endpoints causing secret mismatch" |
| 2026-01-17 22:05 | Customer unblocked via manual Convex sync                           |
| 2026-01-17 22:08 | Duplicate endpoint deleted (premature "fix")                        |
| 2026-01-17 22:12 | User challenged: "how confident are you?"                           |
| 2026-01-17 22:15 | Verified webhooks NOT reaching Vercel (no logs)                     |
| 2026-01-17 22:15 | **Actual root cause found**: `curl -I` revealed 307 redirect        |
| 2026-01-17 22:16 | Webhook URL updated to `www.chrondle.app`                           |
| 2026-01-17 22:16 | **Verified fix**: `pending_webhooks` decreased, logs appeared       |

---

## Root Cause Analysis

### The Actual Problem

```
chrondle.app → 307 Redirect → www.chrondle.app
```

The Stripe webhook endpoint was configured for `https://chrondle.app/api/webhooks/stripe`, but:

1. Vercel redirects all `chrondle.app` traffic to `www.chrondle.app` (307)
2. **Stripe does NOT follow redirects for webhook POST requests**
3. The webhook never reached the application
4. No errors logged because the request never arrived

### The Red Herring

Two webhook endpoints existed for the same URL with different signing secrets. This looked suspicious and was deleted as a "fix" - but it was NOT the cause. Duplicate endpoints would cause double-processing, not non-delivery.

### Evidence Chain

| Check                                          | Expected  | Actual                           | Conclusion            |
| ---------------------------------------------- | --------- | -------------------------------- | --------------------- |
| Vercel logs during webhook                     | Log entry | Nothing                          | Request never arrived |
| `curl -I chrondle.app/api/webhooks/stripe`     | 200 OK    | 307 Redirect                     | **ROOT CAUSE**        |
| `curl -I www.chrondle.app/api/webhooks/stripe` | 200 OK    | 405 (method not allowed for GET) | Correct endpoint      |
| `pending_webhooks` after URL fix               | Decrease  | 4 → 3                            | **Fix verified**      |

---

## 5 Whys Analysis

1. **Why didn't the subscription sync?**
   → The webhook never reached the application

2. **Why didn't the webhook reach the application?**
   → The domain returned a 307 redirect, which Stripe doesn't follow

3. **Why was the webhook configured for a redirecting domain?**
   → Manual configuration without validation; the non-www URL "looked right"

4. **Why was there no validation?**
   → No automated check that webhook URLs use the canonical domain
   → No pre-deploy verification of webhook reachability

5. **Why was there no monitoring for failed webhooks?**
   → Silent failure architecture - system relied on Stripe pushing data without verifying delivery
   → No reconciliation job to catch missed updates

---

## Investigation Anti-Patterns (What We Did Wrong)

### 1. Plausible Explanation Bias

Found duplicate endpoints → assumed this was the cause → stopped investigating. The duplicate endpoints _could_ cause problems, so we treated "possible cause" as "confirmed cause."

### 2. Configuration-as-Truth Fallacy

Checked env vars, checked Stripe dashboard, checked code - all looked correct. But we never verified the **runtime behavior** (actual HTTP requests).

### 3. Premature Declaration of Victory

Deleted the duplicate endpoint and declared "fixed" without:

- Watching logs during a test webhook
- Checking if `pending_webhooks` decreased
- Verifying the customer's subscription actually synced

### 4. AI Amplification of Bias

The AI assistant (Claude) agreed with the plausible explanation and endorsed the fix without demanding observable verification. AIs generate confident prose around weak evidence, which can reinforce human confirmation bias.

---

## Correct Investigation Framework: OODA-V

**O**bserve → **O**rient → **D**ecide → **A**ct → **V**erify

### 1. OBSERVE (Gather raw data, no assumptions)

```bash
# Check if webhook URL is reachable (THE CHECK WE SKIPPED)
curl -I https://chrondle.app/api/webhooks/stripe

# Check Stripe event delivery
stripe events list --limit 5

# Tail production logs
vercel logs chrondle.app --json | grep webhook
```

### 2. ORIENT (Generate hypotheses with tests)

| Hypothesis                 | Likelihood | Test Command                         |
| -------------------------- | ---------- | ------------------------------------ |
| Redirect breaking delivery | High       | `curl -I [url]`                      |
| Secret mismatch            | Medium     | Check Vercel env vs Stripe dashboard |
| Duplicate endpoints        | Low        | `stripe webhook_endpoints list`      |

### 3. DECIDE (Pick highest-likelihood hypothesis)

### 4. ACT (Implement minimal fix)

### 5. VERIFY (MANDATORY - No verification = No fix)

```bash
# Resend webhook
stripe events resend evt_xxx --webhook-endpoint we_xxx

# Watch for logs
vercel logs chrondle.app --json | grep webhook

# Check metrics
stripe events retrieve evt_xxx | jq '.pending_webhooks'

# Verify database state
npx convex run --prod users/queries:getUserByClerkId '{"clerkId": "..."}'
```

**GATE**: If observables don't confirm fix, revert and loop back to OBSERVE.

---

## What Went Well

- **Fast customer unblock**: Manual sync restored access within 15 minutes
- **Systematic initial data gathering**: Checked env vars, Stripe config, Convex data
- **Receptive to challenge**: When asked "how confident are you?", we re-verified instead of defending
- **Real-time documentation**: Incident log created during investigation
- **Root cause persistence**: Didn't stop at "it works now" - found the actual infrastructure issue

---

## What Went Wrong

- **Skipped the basics**: A simple `curl -I` would have revealed the redirect in 2 seconds
- **Confirmation bias**: Duplicate endpoints "looked like" the problem, so we stopped there
- **No verification gate**: Declared "fixed" without observable proof
- **Silent failure architecture**: No alerting on webhook delivery failures
- **Manual webhook setup**: Configuration done via dashboard, not IaC
- **AI endorsement of weak hypothesis**: Claude agreed without demanding verification

---

## Systemic Failures

### 1. Lack of Infrastructure as Code for Webhooks

Webhook endpoint was created manually via CLI/dashboard. This removed configuration from version control and peer review.

### 2. Silent Failure Architecture

System relied entirely on Stripe pushing data. No mechanism to detect when pushes fail.

### 3. Missing Environment Validation

Deployment pipeline didn't verify that external integrations match the canonical domain.

### 4. No Reconciliation Safety Net

No cron job to compare Stripe subscription state with database state.

---

## Stripe Webhook Best Practices (What We Violated)

| Best Practice                    | What We Did Wrong                            |
| -------------------------------- | -------------------------------------------- |
| Use canonical URL (no redirects) | Used `chrondle.app` which redirects to `www` |
| Single endpoint per environment  | Had duplicate endpoints                      |
| Automated provisioning (IaC)     | Manual CLI/dashboard configuration           |
| Async processing (queue events)  | Direct processing in handler                 |
| Reconciliation jobs              | No safety net for missed webhooks            |
| Delivery monitoring              | No alerting on failures                      |

---

## Fix Applied

### Immediate (Customer Unblock)

```bash
npx convex run --prod stripe/webhookAction:processWebhookEvent '{
  "secret": "[SYNC_SECRET]",
  "eventType": "checkout.session.completed",
  "payload": {
    "clerkId": "user_32c05GWQGtryVGYBPcaykuwZXwV",
    "stripeCustomerId": "cus_ToK3qZhYJKA62l",
    "subscriptionStatus": "active",
    "subscriptionPlan": "monthly",
    "subscriptionEndDate": 1771278701000
  }
}'
```

### Root Cause Fix

```bash
# Update webhook URL to canonical domain
stripe webhook_endpoints update we_1SqdkVDIyumDtWyUyYaNIeTg \
  --url "https://www.chrondle.app/api/webhooks/stripe"
```

### Verified With

```bash
# 1. Resend webhook
stripe events resend evt_1SqhPKDIyumDtWyU1V0ZRU7F --webhook-endpoint we_1SqdkVDIyumDtWyUyYaNIeTg

# 2. Watch logs (SAW: "[INFO] [stripe-webhook] Received event")
vercel logs chrondle.app --json

# 3. Check delivery (pending_webhooks: 4 → 3)
stripe events retrieve evt_1SqhPKDIyumDtWyU1V0ZRU7F | jq '.pending_webhooks'
```

### Cleanup

```bash
# Delete duplicate endpoint
stripe webhook_endpoints delete we_1SqFsrDIyumDtWyUzh6dMOOU
```

---

## Follow-up Actions

### Immediate (This Sprint)

| Action                                    | Owner     | Status     |
| ----------------------------------------- | --------- | ---------- |
| Fix webhook URL (non-www → www)           | —         | ✅ Done    |
| Delete duplicate endpoint                 | —         | ✅ Done    |
| Fix Order archive lock icons (UI bug)     | —         | ✅ Done    |
| Create `/stripe-health` debugging skill   | @phaedrus | 🔲 Pending |
| Create `/verify-fix` verification command | @phaedrus | 🔲 Pending |
| Add webhook URL validation script         | @phaedrus | 🔲 Pending |

### Short-term (Next 2 Weeks)

| Action                                       | Owner     | Priority |
| -------------------------------------------- | --------- | -------- |
| Add DEBUG MODE protocol to global CLAUDE.md  | @phaedrus | High     |
| Create webhook reconciliation cron job       | @phaedrus | High     |
| Add Stripe webhook health monitoring         | @phaedrus | High     |
| Document webhook setup in deployment runbook | @phaedrus | Medium   |

### Long-term (Backlog)

| Action                                           | Owner     | Priority |
| ------------------------------------------------ | --------- | -------- |
| Migrate webhook config to IaC (Terraform/Pulumi) | @phaedrus | Medium   |
| Add Sentry integration for webhook errors        | @phaedrus | Low      |
| Build admin dashboard for subscription health    | @phaedrus | Low      |

---

## Artifacts Created

### Prevention Checklist (Webhook Setup)

```bash
# Before configuring ANY webhook endpoint:
1. curl -I -X POST https://your-domain/webhook/path  # Check for redirects (expect 4xx, NOT 3xx)
2. Use canonical domain (www if that's where traffic goes)
3. Verify only ONE endpoint exists: stripe webhook_endpoints list | grep your-domain
4. Test delivery: stripe trigger checkout.session.completed
5. Watch logs: vercel logs your-app --json | grep webhook
6. Verify metrics: stripe events list --limit 1 | jq '.[0].pending_webhooks'
```

### AI Investigation Protocol (Add to CLAUDE.md)

```markdown
## DEBUG MODE: Incident Investigation

When debugging production issues, ALWAYS follow OODA-V:

1. **OBSERVE**: Gather raw data before forming hypotheses
   - Check logs first: "Is the request hitting our server?"
   - If no logs, it's network/routing/redirects, not application code

2. **ORIENT**: List 3 hypotheses with specific test commands
   - Rank by likelihood
   - Include "what would disprove this?"

3. **DECIDE**: Pick highest-likelihood hypothesis

4. **ACT**: Implement minimal fix

5. **VERIFY**: (MANDATORY) No fix is complete without observables
   - Show me the log entry
   - Show me the metric change
   - "Confidence: LOW until verified"

**Anti-patterns to avoid:**

- Agreeing a fix "should work" without seeing proof
- Declaring resolved before metrics confirm
- Endorsing plausible explanations without tests
```

---

## Meta-Lessons

### "Configuration is not Reality"

Looking at env vars, dashboards, and code shows **intent**. Looking at logs, metrics, and `curl` shows **reality**. Never assume configuration has taken effect until you've observed runtime behavior.

### "Verification is the Only Truth"

A fix is just a hypothesis until proven by metrics. The gate for closing any incident is observable evidence, not "that should fix it."

### "Challenge Confident Explanations"

When someone (human or AI) says "I found the problem," ask: "How do we verify this fixes the symptom we're seeing?" If there's no test, there's no fix.

---

## Appendix: Technical Details

### Stripe Event

- Event ID: `evt_1SqhPKDIyumDtWyU1V0ZRU7F`
- Type: `checkout.session.completed`
- Customer: `cus_ToK3qZhYJKA62l`
- Subscription: `sub_1SqhPIDIyumDtWyU17WMnnmq`

### User Record

- Clerk ID: `user_32c05GWQGtryVGYBPcaykuwZXwV`
- Email: `phraznikov@gmail.com`
- Convex ID: `jh73v7k7r3jm62fdj0zy8gghq97qh2ds`

### Webhook Endpoints

- Kept: `we_1SqdkVDIyumDtWyUyYaNIeTg` → `https://www.chrondle.app/api/webhooks/stripe`
- Deleted: `we_1SqFsrDIyumDtWyUzh6dMOOU` (duplicate)
