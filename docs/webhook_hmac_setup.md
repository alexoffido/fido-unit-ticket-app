# ClickUp Webhook HMAC Setup Guide

## HMAC Secret Management

**⚠️ CRITICAL SECURITY:**
- HMAC secrets are sensitive credentials
- Never commit secrets to Git
- Store only in Railway environment variables
- Rotate immediately if exposed

---

## Generating a New HMAC Secret

Use OpenSSL to generate a secure 256-bit hex secret:

```bash
openssl rand -hex 32
```

This will output a 64-character hexadecimal string.

---

## Step 1: Add to Railway Environment Variables

1. Go to Railway project: `gregarious-ambition`
2. Select service: `staging`
3. Go to "Variables" tab
4. Click "+ New Variable"
5. Add:
   - **Name:** `WEBHOOK_HMAC_SECRET`
   - **Value:** `<your-generated-secret>`
6. Click "Add"
7. Railway will auto-redeploy

---

## Step 2: Register ClickUp Webhooks with Secret

### Via Registration Script (Recommended):

```bash
export CLICKUP_API_TOKEN="<your-token>"
export CLICKUP_TEAM_ID="<your-team-id>"
export WEBHOOK_HMAC_SECRET="<your-generated-secret>"
export WEBHOOK_URL="https://fido-unit-ticket-app-staging.up.railway.app/webhook/clickup"

node scripts/clickup/register_webhook_staging.js
```

The script will:
- Register webhooks for all staging lists
- Include the HMAC secret in each registration
- Verify successful registration

### Via ClickUp UI (Manual):

1. Go to ClickUp Settings → Integrations → Webhooks
2. Click "Create Webhook"
3. Fill in:
   - **Endpoint URL:** `https://fido-unit-ticket-app-staging.up.railway.app/webhook/clickup`
   - **Secret:** `<your-generated-secret>`
   - **Events:** Select `taskCreated` and `taskUpdated`
   - **Workspace/List:** Select the staging lists
4. Click "Create"

---

## How HMAC Validation Works

1. **ClickUp sends webhook** with `X-Signature` header containing HMAC-SHA256 hash
2. **Our service receives webhook** and extracts signature from header
3. **Service computes HMAC** using the shared secret and RAW request body
4. **Signatures are compared** using timing-safe comparison
5. **Request is accepted** only if signatures match exactly

This ensures:
- ✅ Requests are from ClickUp (not spoofed)
- ✅ Payload hasn't been tampered with
- ✅ Replay attacks are prevented

---

## HMAC Middleware Implementation

The middleware validates signatures before processing:

```javascript
// Extract signature from header
const signature = req.headers['x-signature'];

// Compute HMAC over RAW body (before JSON parsing)
const expectedSignature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody)  // Raw buffer, not parsed JSON
  .digest('hex');

// Timing-safe comparison
const isValid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);
```

**Key Security Features:**
- ✅ Uses raw request body (no pre-parsing)
- ✅ Timing-safe comparison prevents timing attacks
- ✅ Equal-length buffer comparison
- ✅ Rejects invalid signatures with 401 Unauthorized

---

## Secret Rotation Procedure

If a secret is compromised or exposed:

1. **Generate new secret** using `openssl rand -hex 32`
2. **Update Railway** environment variable
3. **Wait for auto-redeploy** (service will use new secret)
4. **Re-register all webhooks** with new secret
5. **Verify** webhooks are receiving events
6. **Remove old secret** from any documentation

---

## Testing HMAC Validation

### Test Valid Signature:
Create a test ticket in a staging list and check Railway logs:

```
[HMAC] Signature validated successfully
[Webhook] Received event: taskCreated
[Webhook] Routing task 123456...
```

### Test Invalid Signature:
Send a POST with incorrect signature:

```bash
curl -X POST https://fido-unit-ticket-app-staging.up.railway.app/webhook/clickup \
  -H "Content-Type: application/json" \
  -H "X-Signature: invalid_signature_here" \
  -d '{"event":"taskCreated"}'
```

Expected response: `401 Unauthorized`

Expected log:
```
[HMAC] Invalid signature received
```

---

## Security Best Practices

- ⚠️ **Never log the secret** - Only log validation success/failure
- ⚠️ **Never commit secrets to Git** - Use environment variables only
- ⚠️ **Rotate secrets periodically** - Every 90 days minimum
- ⚠️ **Use different secrets** for staging/production
- ⚠️ **Monitor failed validations** - Alert on repeated failures
- ⚠️ **Audit webhook access** - Review registered webhooks regularly

---

## Troubleshooting

### Webhook receives 401 Unauthorized:
- Secret mismatch between Railway and ClickUp
- Webhook not re-registered after secret rotation
- Request not from ClickUp (spoofed)

### Webhook not triggering:
- Check webhook is registered in ClickUp
- Verify list ID matches staging lists
- Check Railway service is running
- Review Railway logs for errors

### HMAC validation always fails:
- Ensure using RAW body (not parsed JSON)
- Verify signature header name is correct (`X-Signature`)
- Check secret is correctly set in Railway
- Confirm webhooks were re-registered with current secret

---

**Last Updated:** 2025-10-24  
**For:** Fido OS Phase 2 - Routing Webhook Service  
**Security Level:** CRITICAL - Handle with care

