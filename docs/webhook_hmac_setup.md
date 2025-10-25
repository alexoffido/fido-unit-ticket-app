# ClickUp Webhook HMAC Setup Guide

## Generated HMAC Secret

```
0e6da9ad72788ceea282cc31e445b7e1c386fe32d1f7bab9517eed4f6db0c985
```

**⚠️ IMPORTANT:** This secret must be added to BOTH Railway and ClickUp

---

## Step 1: Add to Railway Environment Variables

1. Go to Railway project: `gregarious-ambition`
2. Select service: `staging`
3. Go to "Variables" tab
4. Click "+ New Variable"
5. Add:
   - **Name:** `WEBHOOK_HMAC_SECRET`
   - **Value:** `0e6da9ad72788ceea282cc31e445b7e1c386fe32d1f7bab9517eed4f6db0c985`
6. Click "Add"
7. Railway will auto-redeploy

---

## Step 2: Add to ClickUp Webhook Registration

When registering webhooks via API or ClickUp UI, include this secret:

### Via API (using our script):

The webhook registration script will automatically use the secret from the `WEBHOOK_HMAC_SECRET` environment variable.

```bash
export WEBHOOK_HMAC_SECRET="0e6da9ad72788ceea282cc31e445b7e1c386fe32d1f7bab9517eed4f6db0c985"
node scripts/clickup/register_webhook_staging.js
```

### Via ClickUp UI:

1. Go to ClickUp Settings → Integrations → Webhooks
2. Click "Create Webhook"
3. Fill in:
   - **Endpoint URL:** `https://fido-unit-ticket-app-staging.up.railway.app/webhook/clickup`
   - **Secret:** `0e6da9ad72788ceea282cc31e445b7e1c386fe32d1f7bab9517eed4f6db0c985`
   - **Events:** Select `taskCreated` and `taskUpdated`
   - **Workspace/List:** Select the staging lists
4. Click "Create"

---

## How HMAC Validation Works

1. **ClickUp sends webhook** with `X-Signature` header containing HMAC-SHA256 hash
2. **Our service receives webhook** and extracts signature from header
3. **Service computes HMAC** using the shared secret and request body
4. **Signatures are compared** using timing-safe comparison
5. **Request is accepted** only if signatures match

This ensures:
- ✅ Requests are from ClickUp (not spoofed)
- ✅ Payload hasn't been tampered with
- ✅ Replay attacks are prevented

---

## Security Notes

- ⚠️ **Never commit this secret to Git**
- ⚠️ **Store only in Railway environment variables**
- ⚠️ **Rotate secret if compromised**
- ⚠️ **Use different secrets for staging/production**

---

## Testing HMAC Validation

After setup, test with a real ClickUp event:

1. Create a test ticket in a staging list
2. Check Railway logs for HMAC validation success
3. Verify webhook response is 200 OK

Expected log output:
```
[HMAC] Signature validated successfully
[Webhook] Received event: taskCreated
[Webhook] Routing task 123456...
```

If HMAC fails:
```
[HMAC] Invalid signature received
```

This means either:
- Secret mismatch between Railway and ClickUp
- Request not from ClickUp
- Payload was modified in transit

---

**Generated:** 2025-10-24  
**For:** Fido OS Phase 2 - Routing Webhook Service

