#!/bin/bash

# Fido OS - Phase 3: Security Hardening
# Regression Test Script
#
# Tests all security features against live Railway deployment

set -e

WEBHOOK_URL="https://fido-unit-ticket-app-staging.up.railway.app"
HMAC_SECRET="${WEBHOOK_HMAC_SECRET}"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║  Fido OS - Phase 3 Security Regression Tests         ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Test 1: Valid Signature
echo "Test 1: Valid signature (should succeed)"
PAYLOAD='{"event":"taskCreated","task_id":"test123","event_id":"evt_valid_'$(date +%s)'"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | awk '{print $2}')

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/clickup" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$PAYLOAD")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" != "401" ]; then
  echo "✅ PASS - Valid signature accepted (status: $STATUS)"
else
  echo "❌ FAIL - Valid signature rejected with 401"
  exit 1
fi
echo ""

# Test 2: Invalid Signature
echo "Test 2: Invalid signature (should return 401)"
PAYLOAD='{"event":"taskCreated","task_id":"test123","event_id":"evt_invalid_'$(date +%s)'"}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/clickup" \
  -H "Content-Type: application/json" \
  -H "X-Signature: invalid_signature_12345" \
  -d "$PAYLOAD")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "401" ]; then
  echo "✅ PASS - Invalid signature rejected with 401"
else
  echo "❌ FAIL - Invalid signature not rejected (status: $STATUS)"
  exit 1
fi
echo ""

# Test 3: Replay Detection
echo "Test 3: Replay detection (should return 409 on duplicate)"
EVENT_ID="evt_replay_$(date +%s)"
PAYLOAD='{"event":"taskCreated","task_id":"test123","event_id":"'$EVENT_ID'"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | awk '{print $2}')

# First request
curl -s -X POST "$WEBHOOK_URL/webhook/clickup" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$PAYLOAD" > /dev/null

sleep 1

# Duplicate request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/clickup" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$PAYLOAD")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "409" ]; then
  echo "✅ PASS - Replay detected and rejected with 409"
else
  echo "❌ FAIL - Replay not detected (status: $STATUS)"
  exit 1
fi
echo ""

# Test 4: Header Case Normalization
echo "Test 4: Header case normalization (lowercase x-signature)"
PAYLOAD='{"event":"taskCreated","task_id":"test123","event_id":"evt_lowercase_'$(date +%s)'"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | awk '{print $2}')

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/clickup" \
  -H "Content-Type: application/json" \
  -H "x-signature: $SIGNATURE" \
  -d "$PAYLOAD")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" != "401" ]; then
  echo "✅ PASS - Lowercase header accepted (status: $STATUS)"
else
  echo "❌ FAIL - Lowercase header rejected with 401"
  exit 1
fi
echo ""

# Test 5: Signature Value Case Normalization
echo "Test 5: Signature value case normalization (uppercase signature)"
PAYLOAD='{"event":"taskCreated","task_id":"test123","event_id":"evt_uppercase_'$(date +%s)'"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | awk '{print $2}' | tr '[:lower:]' '[:upper:]')

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/clickup" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$PAYLOAD")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" != "401" ]; then
  echo "✅ PASS - Uppercase signature accepted (status: $STATUS)"
else
  echo "❌ FAIL - Uppercase signature rejected with 401"
  exit 1
fi
echo ""

# Test 6: Rate Limiting (if enabled)
if [ "${ENABLE_RATE_LIMITING}" = "true" ]; then
  echo "Test 6: Rate limiting (burst limit)"
  echo "Sending 11 requests rapidly..."
  
  RATE_LIMITED=false
  for i in {1..11}; do
    PAYLOAD='{"event":"taskCreated","task_id":"test123","event_id":"evt_rate_'$i'_'$(date +%s)'"}'
    SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | awk '{print $2}')
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/clickup" \
      -H "Content-Type: application/json" \
      -H "X-Signature: $SIGNATURE" \
      -d "$PAYLOAD")
    
    STATUS=$(echo "$RESPONSE" | tail -n1)
    if [ "$STATUS" = "429" ]; then
      RATE_LIMITED=true
      break
    fi
  done
  
  if [ "$RATE_LIMITED" = true ]; then
    echo "✅ PASS - Rate limiting triggered with 429"
  else
    echo "⚠️  WARN - Rate limiting not triggered (may need adjustment)"
  fi
  echo ""
else
  echo "Test 6: Rate limiting (SKIPPED - not enabled)"
  echo ""
fi

# Test 7: Health Endpoints
echo "Test 7: Health endpoints"
HEALTH=$(curl -s "$WEBHOOK_URL/health")
if echo "$HEALTH" | grep -q "healthy"; then
  echo "✅ PASS - /health endpoint working"
else
  echo "❌ FAIL - /health endpoint not working"
  exit 1
fi

READY=$(curl -s "$WEBHOOK_URL/ready")
if echo "$READY" | grep -q "ready"; then
  echo "✅ PASS - /ready endpoint working"
else
  echo "❌ FAIL - /ready endpoint not working"
  exit 1
fi
echo ""

echo "╔═══════════════════════════════════════════════════════╗"
echo "║  All Regression Tests PASSED ✅                       ║"
echo "╚═══════════════════════════════════════════════════════╝"

