#!/bin/bash
# Fido OS - Phase 4: Alert Simulation Test
# 
# Generates 21 invalid signature requests within 5 minutes
# to trigger the security alerting system (threshold: 20)

SERVICE_URL="https://fido-unit-ticket-app-staging.up.railway.app"
WEBHOOK_PATH="/webhook/clickup"
TARGET_URL="${SERVICE_URL}${WEBHOOK_PATH}"

echo "🧪 Alert Simulation Test"
echo "========================"
echo "Target: $TARGET_URL"
echo "Goal: Generate 21 invalid signature requests"
echo "Expected: Single Slack alert after 20th failure"
echo ""

# Function to send invalid request
send_invalid_request() {
  local request_num=$1
  
  # Send request with invalid HMAC signature
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "$TARGET_URL" \
    -H "Content-Type: application/json" \
    -H "X-Signature: invalid_signature_${request_num}" \
    -d '{
      "event": "taskCreated",
      "task_id": "test_task_'${request_num}'",
      "webhook_id": "alert_simulation_test"
    }')
  
  http_code=$(echo "$response" | tail -n1)
  
  if [ "$http_code" = "401" ]; then
    echo "✓ Request $request_num: 401 (as expected)"
  else
    echo "✗ Request $request_num: $http_code (expected 401)"
  fi
}

# Send 21 invalid requests
echo "Sending 21 invalid signature requests..."
echo ""

for i in {1..21}; do
  send_invalid_request $i
  
  # Alert should trigger after 20th request
  if [ $i -eq 20 ]; then
    echo ""
    echo "⚠️  Threshold reached (20 failures) - Alert should be sent now!"
    echo ""
  fi
  
  # Small delay to avoid overwhelming the service
  sleep 0.2
done

echo ""
echo "✅ Simulation complete!"
echo ""
echo "Expected outcome:"
echo "- 21 requests sent with invalid signatures"
echo "- All should return 401"
echo "- Single Slack alert sent after 20th failure"
echo "- Alert cooldown: 15 minutes (no duplicate alerts)"
echo ""
echo "Next steps:"
echo "1. Check Slack channel C09NVLUNDL4 for alert"
echo "2. Verify alert contains:"
echo "   - Failure count: 21 (or 20+)"
echo "   - Service: fido-clickup-routing-staging"
echo "   - Top failure reason: signature_missing or invalid_signature"
echo ""

