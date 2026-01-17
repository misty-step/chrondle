#!/bin/bash
#
# verify-webhook-config.sh
#
# Verify Stripe webhook configuration before/after deployment.
# Run as: ./scripts/verify-webhook-config.sh
#
# Checks:
# 1. Webhook URL doesn't redirect (307/308/301/302)
# 2. Only one endpoint per URL (no duplicates)
# 3. Required events are enabled
# 4. Recent events have low pending_webhooks count
#
# Exit codes:
#   0 = All checks passed
#   1 = Critical issue (redirect, missing endpoint)
#   2 = Warning (duplicates, high pending_webhooks)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CANONICAL_DOMAIN="${CANONICAL_DOMAIN:-www.chrondle.app}"
WEBHOOK_PATH="/api/webhooks/stripe"
REQUIRED_EVENTS="checkout.session.completed customer.subscription.updated customer.subscription.deleted"

echo "🔍 Stripe Webhook Configuration Check"
echo "======================================"
echo ""

# Check for Stripe CLI
if ! command -v stripe &> /dev/null; then
    echo -e "${RED}❌ Stripe CLI not installed${NC}"
    echo "   Install: brew install stripe/stripe-cli/stripe"
    exit 1
fi

# Check for API key
if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
    # Try to load from .env.production
    if [[ -f ".env.production" ]]; then
        STRIPE_SECRET_KEY=$(grep STRIPE_SECRET_KEY .env.production | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\n')
    fi
fi

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
    echo -e "${RED}❌ STRIPE_SECRET_KEY not set${NC}"
    echo "   Set via environment or .env.production"
    exit 1
fi

FAILURES=0
WARNINGS=0

# ============================================
# Check 1: Redirect Detection (CRITICAL)
# ============================================
echo "1️⃣  Checking for redirects..."
WEBHOOK_URL="https://${CANONICAL_DOMAIN}${WEBHOOK_PATH}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -I -X POST "$WEBHOOK_URL" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" =~ ^3 ]]; then
    echo -e "   ${RED}❌ CRITICAL: $WEBHOOK_URL returns $HTTP_STATUS (redirect)${NC}"
    echo "   Stripe webhooks will NOT be delivered through redirects!"
    echo "   Fix: Use the canonical domain in Stripe webhook config"
    FAILURES=$((FAILURES + 1))
elif [[ "$HTTP_STATUS" == "000" ]]; then
    echo -e "   ${YELLOW}⚠️  Could not reach $WEBHOOK_URL${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "   ${GREEN}✅ $WEBHOOK_URL returns $HTTP_STATUS (no redirect)${NC}"
fi
echo ""

# ============================================
# Check 2: Endpoint Configuration
# ============================================
echo "2️⃣  Checking webhook endpoints..."
ENDPOINTS=$(stripe webhook_endpoints list --api-key "$STRIPE_SECRET_KEY" 2>/dev/null)

if [[ -z "$ENDPOINTS" ]]; then
    echo -e "   ${RED}❌ Could not fetch webhook endpoints${NC}"
    FAILURES=$((FAILURES + 1))
else
    # Count endpoints for our domain
    DOMAIN_ENDPOINTS=$(echo "$ENDPOINTS" | jq -r ".data[] | select(.url | contains(\"$CANONICAL_DOMAIN\")) | .url" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$DOMAIN_ENDPOINTS" -eq 0 ]]; then
        echo -e "   ${RED}❌ No webhook endpoint configured for $CANONICAL_DOMAIN${NC}"
        FAILURES=$((FAILURES + 1))
    elif [[ "$DOMAIN_ENDPOINTS" -gt 1 ]]; then
        echo -e "   ${YELLOW}⚠️  Multiple endpoints ($DOMAIN_ENDPOINTS) for $CANONICAL_DOMAIN${NC}"
        echo "   This can cause duplicate processing or secret confusion"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "   ${GREEN}✅ Single endpoint configured for $CANONICAL_DOMAIN${NC}"
    fi

    # Show endpoint details
    echo "$ENDPOINTS" | jq -r ".data[] | select(.url | contains(\"$CANONICAL_DOMAIN\")) | \"   - \\(.url) (status: \\(.status))\"" 2>/dev/null || true
fi
echo ""

# ============================================
# Check 3: Required Events
# ============================================
echo "3️⃣  Checking required events..."
ENDPOINT_EVENTS=$(echo "$ENDPOINTS" | jq -r ".data[] | select(.url | contains(\"$CANONICAL_DOMAIN\")) | .enabled_events[]" 2>/dev/null | sort -u)

MISSING_EVENTS=""
for EVENT in $REQUIRED_EVENTS; do
    if ! echo "$ENDPOINT_EVENTS" | grep -q "^$EVENT$"; then
        MISSING_EVENTS="$MISSING_EVENTS $EVENT"
    fi
done

if [[ -n "$MISSING_EVENTS" ]]; then
    echo -e "   ${YELLOW}⚠️  Missing events:$MISSING_EVENTS${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "   ${GREEN}✅ All required events enabled${NC}"
fi
echo ""

# ============================================
# Check 4: Recent Delivery Health
# ============================================
echo "4️⃣  Checking recent delivery health..."
RECENT_EVENTS=$(stripe events list --limit 10 --api-key "$STRIPE_SECRET_KEY" 2>/dev/null)

if [[ -n "$RECENT_EVENTS" ]]; then
    PENDING_COUNT=$(echo "$RECENT_EVENTS" | jq '[.data[] | select(.pending_webhooks > 0)] | length' 2>/dev/null || echo "0")

    if [[ "$PENDING_COUNT" -gt 3 ]]; then
        echo -e "   ${YELLOW}⚠️  $PENDING_COUNT of last 10 events have pending webhooks${NC}"
        echo "   This may indicate delivery failures"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "   ${GREEN}✅ Recent events delivered ($PENDING_COUNT with pending)${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  Could not fetch recent events${NC}"
fi
echo ""

# ============================================
# Summary
# ============================================
echo "======================================"
if [[ $FAILURES -gt 0 ]]; then
    echo -e "${RED}❌ FAILED: $FAILURES critical issues found${NC}"
    exit 1
elif [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}⚠️  WARNING: $WARNINGS issues found${NC}"
    exit 2
else
    echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
    exit 0
fi
