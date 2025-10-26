# Production Environment Variable Updates

**Date:** October 26, 2025  
**Action:** Update copied staging variables for production use

---

## Variables to Update in Railway Production Environment

### 1. WEBHOOK_HMAC_SECRET (CRITICAL)

**Current Value:** (copied from staging)  
**New Production Value:**
```
ca9d5e98d71c8b1fb215c70ecce9678b1f27faa0e81ad9e4deda2a6fc1586983
```

**Why:** Never reuse staging secrets in production. This new secret must be used when registering production webhooks.

---

### 2. ENABLE_RATE_LIMITING

**Current Value:** `false` (from staging)  
**New Production Value:** `true`

**Why:** Production should have rate limiting enabled to protect against abuse.

---

### 3. NODE_ENV (Should already be correct)

**Expected Value:** `production`

**Why:** Already set in railway.json, but verify it's not overridden by copied staging variables.

---

## Verification After Update

After updating these variables, Railway will automatically redeploy. Verify:

1. Service redeploys successfully
2. Check logs for "Server listening on port 3000"
3. Test health endpoint: `curl https://[production-url]/health`
4. Test ready endpoint: `curl https://[production-url]/ready`

---

## Next Steps After Verification

1. Register production webhooks with new HMAC secret
2. Run smoke tests
3. Verify Slack alerts
4. Confirm production deployment complete

