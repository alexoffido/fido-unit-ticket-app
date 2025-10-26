# Phase 5: Production Deployment Checklist

**Date:** October 26, 2025  
**Environment:** Railway → Project `gregarious-ambition` → Production  
**Service:** fido-unit-ticket-app (production)

---

## Pre-Deployment

- [x] **Step 1: Branch Merge**
  - [x] Merged `feature/clickup-os-v2` into `main`
  - [x] Pushed to GitHub
  - [x] All Phase 1-4 changes now in main branch

---

## Production Environment Setup

- [ ] **Step 2: Railway Environment**
  - [ ] Switched to **production** environment
  - [ ] Deleted legacy production services (if any)
  - [ ] Created new service from GitHub repo

- [ ] **Step 3: Service Configuration**
  - [ ] Repository: `alexoffido/fido-unit-ticket-app`
  - [ ] Branch: `main`
  - [ ] Start command: `node services/webhooks/staging/index.js`

---

## Environment Variables

- [ ] **Step 4: Configure Variables**

### Required Variables

| Variable | Value | Status |
|----------|-------|--------|
| `CLICKUP_API_TOKEN` | (copy from staging) | ⏳ |
| `CLICKUP_TEAM_ID` | `9013484736` | ⏳ |
| `SLACK_BOT_TOKEN` | (copy from staging) | ⏳ |
| `ALERT_CHANNEL_ID` | `C09NVLUNDL4` | ⏳ |
| `WEBHOOK_HMAC_SECRET` | **NEW SECRET** (see below) | ⏳ |
| `ENABLE_RATE_LIMITING` | `true` | ⏳ |
| `NODE_ENV` | `production` | ⏳ |

### Production HMAC Secret (NEW - DO NOT REUSE STAGING)

```
ca9d5e98d71c8b1fb215c70ecce9678b1f27faa0e81ad9e4deda2a6fc1586983
```

**⚠️ IMPORTANT:** This secret must be used when registering production webhooks.

---

## Deployment & Verification

- [ ] **Step 5: Deploy Service**
  - [ ] Triggered deployment in Railway
  - [ ] Deployment successful
  - [ ] Service running

- [ ] **Step 6: Health Check**
  - [ ] `/health` returns `{"status":"healthy"}`
  - [ ] `/ready` returns `{"status":"ready"}`
  - [ ] Security config visible in `/ready` response

---

## Webhook Registration

- [ ] **Step 7: Register Production Webhooks**

### Lists to Register

1. **Service Issues** (production list ID: TBD)
2. **Customer Inquiries** (production list ID: TBD)
3. **Unit Management** (production list ID: TBD)

### Webhook Configuration

- **Endpoint:** `https://fido-unit-ticket-app-production.up.railway.app/webhook/clickup`
- **Events:** `taskCreated`, `taskUpdated`
- **Secret:** `ca9d5e98d71c8b1fb215c70ecce9678b1f27faa0e81ad9e4deda2a6fc1586983`

---

## Smoke Tests

- [ ] **Step 8: Execute Smoke Tests**

### Test 1: Health Endpoints
```bash
curl https://fido-unit-ticket-app-production.up.railway.app/health
curl https://fido-unit-ticket-app-production.up.railway.app/ready
```
- [ ] Both return 200 OK

### Test 2: Invalid Signature (401)
```bash
curl -X POST https://fido-unit-ticket-app-production.up.railway.app/webhook/clickup \
  -H "X-Signature: invalid" \
  -d '{"event":"taskCreated"}'
```
- [ ] Returns 401 Unauthorized

### Test 3: Replay Protection (409)
- [ ] Send same payload twice
- [ ] Second request returns 409

### Test 4: Alert Simulation
- [ ] Send 21 invalid signature requests
- [ ] Slack alert appears in `#fido-os-sys-alerts` (C09NVLUNDL4)
- [ ] Alert shows correct failure count and details

### Test 5: Rate Limiting
- [ ] `/ready` shows `rate_limiting_enabled: true`
- [ ] Rapid requests trigger 429 (if enabled)

---

## Production Verification

- [ ] **Step 9: Log Verification**
  - [ ] "Server listening on port 3000" in logs
  - [ ] `security_event` entries visible
  - [ ] No errors in startup logs

- [ ] **Step 10: Final Confirmation**
  - [ ] All smoke tests passed
  - [ ] Webhooks registered successfully
  - [ ] Slack alerts working
  - [ ] Service healthy and ready

---

## Post-Deployment

- [ ] **Announcement**
  - [ ] Post to team: "Fido OS Production Deployment complete — routing active."

- [ ] **Documentation**
  - [ ] Update deployment guide with production URL
  - [ ] Save production HMAC secret securely (Railway only)
  - [ ] Archive staging service (keep for rollback)

---

## Rollback Plan (if needed)

1. Switch Railway to staging service
2. Update ClickUp webhooks to point to staging URL
3. Investigate production issues
4. Re-deploy when fixed

---

## Notes

- Production HMAC secret generated: `ca9d5e98d71c8b1fb215c70ecce9678b1f27faa0e81ad9e4deda2a6fc1586983`
- Never commit secrets to Git
- All secrets stored in Railway environment variables only
- Staging service remains active for testing/development

