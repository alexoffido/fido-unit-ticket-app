#!/bin/bash
# Register a single ClickUp webhook
# Usage: ./register_single_webhook.sh <list_id> <list_name>

LIST_ID="$1"
LIST_NAME="$2"

if [ -z "$LIST_ID" ] || [ -z "$LIST_NAME" ]; then
  echo "Usage: $0 <list_id> <list_name>"
  echo "Example: $0 901318355853 'Service Issues'"
  exit 1
fi

API_TOKEN="${CLICKUP_API_TOKEN}"
TEAM_ID="${CLICKUP_TEAM_ID:-9013484736}"
WEBHOOK_URL="https://fido-unit-ticket-app-production.up.railway.app/webhook/clickup"
WEBHOOK_SECRET="${WEBHOOK_HMAC_SECRET}"

if [ -z "$API_TOKEN" ]; then
  echo "Error: CLICKUP_API_TOKEN not set"
  exit 1
fi

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "Error: WEBHOOK_HMAC_SECRET not set"
  exit 1
fi

echo "Registering webhook for: $LIST_NAME"
echo "List ID: $LIST_ID"
echo "Endpoint: $WEBHOOK_URL"
echo ""

RESPONSE=$(curl -s -X POST "https://api.clickup.com/api/v2/team/${TEAM_ID}/webhook" \
  -H "Authorization: ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"endpoint\": \"${WEBHOOK_URL}\",
    \"events\": [\"taskCreated\", \"taskUpdated\"],
    \"list_id\": \"${LIST_ID}\",
    \"secret\": \"${WEBHOOK_SECRET}\"
  }")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"id"'; then
  echo "✅ Webhook registered successfully!"
else
  echo "❌ Webhook registration failed"
  exit 1
fi

