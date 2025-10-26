# Fido OS - Phase 4 Manual Testing Guide

**Purpose:** Validate routing logic using real ClickUp tasks and webhook triggers

**Prerequisites:**
- ✅ Service deployed: https://fido-unit-ticket-app-staging.up.railway.app
- ✅ Webhooks registered for 3 staging lists
- ✅ Security features enabled (HMAC, alerting, replay protection)
- ✅ Rate limiting disabled for testing

---

## Test Matrix Overview

### Security Tests (5)
1. ✅ Alert Trigger Mechanism - **PASSED** (verified in pre-flight)
2. ✅ Health Endpoints - **PASSED** (automated test)
3. ⏳ Replay Protection - **MANUAL TEST REQUIRED**
4. ⏳ HMAC Validation - **MANUAL TEST REQUIRED**
5. ⏳ Rate Limiting (disabled) - **VERIFIED**

### Routing Tests (20)
Tests require real ClickUp task creation to trigger webhooks

---

## Manual Test Procedures

### Security Test: Replay Protection

**Objective:** Verify duplicate webhook events are rejected with 409

**Steps:**
1. Create a task in ClickUp (any staging list)
2. Webhook fires automatically
3. Check Railway logs for "Signature validated successfully"
4. Manually re-send the same webhook payload (use ClickUp webhook history)
5. Verify second request returns 409 "Duplicate event (replay detected)"

**Evidence to collect:**
- Screenshot of Railway logs showing first request (200)
- Screenshot of Railway logs showing replay detection (409)

---

### Security Test: HMAC Validation

**Objective:** Verify invalid signatures are rejected with 401

**Steps:**
1. Use curl to send request with invalid signature:
```bash
curl -X POST https://fido-unit-ticket-app-staging.up.railway.app/webhook/clickup \
  -H "Content-Type: application/json" \
  -H "X-Signature: invalid_signature_test" \
  -d '{"event":"taskCreated","task_id":"test"}'
```
2. Verify response is 401 "Invalid webhook signature"
3. Check Railway logs for "invalid_signature" security event

**Evidence to collect:**
- Screenshot of curl command and 401 response
- Screenshot of Railway logs showing security event

---

### Routing Test 1: VIP Customer with CX Owner

**Objective:** Verify VIP customer tickets are routed to assigned CX owner

**Prerequisites:**
- Customer in CRM with VIP status = Yes
- Customer has CX owner assigned (Assignees field)
- Unit linked to this customer

**Steps:**
1. Create task in "Service Issues" list
2. Set Customer field to VIP customer
3. Set Unit field to unit owned by VIP customer
4. Webhook fires on task creation
5. Check task assignees - should include CX owner from customer record

**Expected behavior:**
- Task assigned to CX owner from customer's Assignees field
- No "Needs CX Routing" tag added
- Railway logs show: "VIP customer detected, using CX owner"

**Evidence to collect:**
- Screenshot of customer record showing VIP status and CX owner
- Screenshot of created task showing assignee
- Screenshot of Railway logs showing routing decision

---

### Routing Test 2: VIP Customer without CX Owner

**Objective:** Verify VIP tickets without CX owner are tagged for routing

**Prerequisites:**
- Customer in CRM with VIP status = Yes
- Customer has NO CX owner assigned (Assignees field empty)

**Steps:**
1. Create task in "Customer Inquiries" list
2. Set Customer field to VIP customer (no CX owner)
3. Webhook fires on task creation
4. Check task tags - should include "Needs CX Routing"

**Expected behavior:**
- No assignee added (customer has no CX owner)
- "Needs CX Routing" tag added
- Railway logs show: "VIP customer but no CX owner, tagging for routing"

**Evidence to collect:**
- Screenshot of customer record showing VIP status, no CX owner
- Screenshot of created task showing "Needs CX Routing" tag
- Screenshot of Railway logs

---

### Routing Test 3: Standard Customer with CX Owner

**Objective:** Verify standard customer tickets are auto-routed to CX owner

**Prerequisites:**
- Customer in CRM with VIP status = No (or blank)
- Customer has CX owner assigned

**Steps:**
1. Create task in "Unit Management" list
2. Set Customer field to standard customer with CX owner
3. Webhook fires on task creation
4. Check task assignees - should include CX owner

**Expected behavior:**
- Task assigned to CX owner from customer's Assignees field
- No tags added
- Railway logs show: "Standard customer, auto-routing to CX owner"

**Evidence to collect:**
- Screenshot of customer record
- Screenshot of task assignee
- Screenshot of Railway logs

---

### Routing Test 4: No Customer Assigned

**Objective:** Verify tickets without customer are tagged for routing

**Prerequisites:**
- None

**Steps:**
1. Create task in "Service Issues" list
2. Leave Customer field empty
3. Webhook fires on task creation
4. Check task tags - should include "Needs CX Routing"

**Expected behavior:**
- No assignee added
- "Needs CX Routing" tag added
- Railway logs show: "No customer assigned, tagging for routing"

**Evidence to collect:**
- Screenshot of task with no customer, showing tag
- Screenshot of Railway logs

---

### Routing Test 5: Market-Based Ops Routing

**Objective:** Verify Ops tickets are routed based on market ownership

**Prerequisites:**
- Market Ownership list configured with market-to-owner mappings
- Unit with market field set

**Steps:**
1. Create task in "Unit Management" list (Ops ticket type)
2. Set Unit field to unit with known market
3. Webhook fires on task creation
4. Check task assignees - should include Ops owner for that market

**Expected behavior:**
- Task assigned to Ops owner based on market
- Railway logs show: "Market-based Ops routing: [market] → [owner]"

**Evidence to collect:**
- Screenshot of unit showing market
- Screenshot of Market Ownership record
- Screenshot of task assignee
- Screenshot of Railway logs

---

## Evidence Collection Template

For each test, collect:

1. **Pre-conditions:**
   - Screenshot of relevant ClickUp records (customer, unit, etc.)
   - Configuration state

2. **Action:**
   - Screenshot of task creation
   - Timestamp of action

3. **Result:**
   - Screenshot of task after webhook processing
   - Screenshot of Railway logs (filter by timestamp)
   - Pass/Fail determination

4. **Logs:**
   - Copy relevant JSON log entries from Railway
   - Save to `/docs/phase4_evidence/test_[N]_logs.json`

---

## Test Execution Checklist

- [ ] Security Test: Replay Protection
- [ ] Security Test: HMAC Validation
- [ ] Routing Test 1: VIP with CX Owner
- [ ] Routing Test 2: VIP without CX Owner
- [ ] Routing Test 3: Standard with CX Owner
- [ ] Routing Test 4: No Customer Assigned
- [ ] Routing Test 5: Market-Based Ops Routing

---

## Automated Tests (Already Passed)

✅ **Alert Trigger Mechanism**
- 21 invalid signatures sent
- Alert fired after 20th failure
- Slack message received in C09NVLUNDL4
- Evidence: Slack screenshot from pre-flight test

✅ **Health Endpoints**
- `/health` returns 200 with status "healthy"
- `/ready` returns 200 with status "ready"
- Security config visible in `/ready` response
- Evidence: Automated test results

✅ **Rate Limiting**
- Feature flag working (ENABLE_RATE_LIMITING=false)
- Service accepts requests when disabled
- Evidence: Test suite results

---

## Next Steps

1. Execute manual tests following procedures above
2. Collect evidence (screenshots, logs)
3. Save evidence to `/docs/phase4_evidence/` directory
4. Update pass/fail status in test matrix
5. Generate Phase 4 Pulse Report with all evidence
6. Submit to Winston for review

