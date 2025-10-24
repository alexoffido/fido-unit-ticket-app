# Fido OS Phase 2 - Railway Deployment Guide

## Service Configuration

**Service Name:** `fido-clickup-routing-staging`  
**Railway Project:** gregarious-ambition (ID: b8e0b88a-1d04-40e8-b0ee-56e2267209a0)  
**GitHub Branch:** `feature/clickup-os-v2`  
**Start Command:** `node services/webhooks/staging/index.js`  

---

## Environment Variables

The following environment variables must be configured in Railway:

| Variable | Value | Notes |
|----------|-------|-------|
| `CLICKUP_API_TOKEN` | `pk_126011920_Y50RJ3IRJVI24Y80UYOM7B8WYBOAURJI` | ClickUp API authentication |
| `CLICKUP_TEAM_ID` | `9013484736` | Team context |
| `WEBHOOK_HMAC_SECRET` | *(Alex to provide)* | HMAC signature validation |
| `DEFAULT_CX_USER_ID` | *(Alex to provide)* | Fallback CX owner user ID |
| `PORT` | `3000` | Service port (Railway auto-assigns) |
| `NODE_ENV` | `staging` | Environment mode |
| `SLACK_BOT_TOKEN` | *(Alex to provide)* | Optional: for debug alerts |

---

## Deployment Steps

### 1. Create Railway Service

```bash
# Via Railway CLI (if available)
railway init
railway link b8e0b88a-1d04-40e8-b0ee-56e2267209a0
railway service create fido-clickup-routing-staging
```

Or via Railway Dashboard:
1. Go to project `gregarious-ambition`
2. Click "+ New Service"
3. Select "GitHub Repo"
4. Choose `alexoffido/fido-unit-ticket-app`
5. Select branch `feature/clickup-os-v2`

### 2. Configure Build Settings

**Root Directory:** `/`  
**Build Command:** *(leave empty, no build needed)*  
**Start Command:** `node services/webhooks/staging/index.js`  
**Watch Paths:** `services/webhooks/staging/**`

### 3. Add Environment Variables

Add all variables listed above via Railway Dashboard:
1. Go to service settings
2. Click "Variables" tab
3. Add each variable with its value
4. Click "Deploy" to apply changes

### 4. Deploy Service

Railway will auto-deploy when:
- Environment variables are added
- Code is pushed to `feature/clickup-os-v2` branch

Monitor deployment:
- Check "Deployments" tab for build logs
- Verify service starts successfully
- Check for any errors in logs

### 5. Get Service URL

Once deployed, Railway provides a public URL:
- Format: `https://fido-clickup-routing-staging-production.up.railway.app`
- Copy this URL for webhook registration

### 6. Verify Endpoints

Test health endpoints:

```bash
# Health check
curl https://[railway-url]/health

# Readiness check
curl https://[railway-url]/ready
```

Expected responses:
- `/health`: `{"status":"healthy",...}`
- `/ready`: `{"status":"ready",...}`

---

## Webhook Registration

After deployment, register the webhook:

```bash
export CLICKUP_API_TOKEN="pk_126011920_Y50RJ3IRJVI24Y80UYOM7B8WYBOAURJI"
export CLICKUP_TEAM_ID="9013484736"
export WEBHOOK_URL="https://[railway-url]/webhook/clickup"

node scripts/clickup/register_webhook_staging.js
```

This will register webhooks for:
- Service Issues (901318355853)
- Customer Inquiries (901318355854)
- Unit Management (901318355855)

---

## Monitoring

### View Logs

```bash
# Via Railway CLI
railway logs

# Or via Railway Dashboard
# Go to service → Deployments → Click deployment → View logs
```

### Check Webhook Activity

Logs are written to `/logs/phase-2/`:
- `webhook.log` - All webhook requests/responses
- `routing.log` - Routing decisions
- `errors.log` - Error details

Access logs via Railway shell:
```bash
railway shell
cat logs/phase-2/webhook.log
```

---

## Troubleshooting

### Service Won't Start

1. Check environment variables are set correctly
2. View deployment logs for errors
3. Verify start command: `node services/webhooks/staging/index.js`
4. Check `/ready` endpoint for missing variables

### Webhook Not Receiving Events

1. Verify webhook registration succeeded
2. Check HMAC secret matches ClickUp configuration
3. View `webhook.log` for incoming requests
4. Test with manual POST to `/webhook/clickup`

### Routing Failures

1. Check `routing.log` for routing decisions
2. Verify customer/unit/market data exists in ClickUp
3. Check `errors.log` for API errors
4. Validate field IDs in `field_manifest.json`

---

## Rollback Plan

If deployment fails:

1. **Revert to previous deployment:**
   ```bash
   railway rollback
   ```

2. **Or redeploy previous commit:**
   ```bash
   git revert HEAD
   git push origin feature/clickup-os-v2
   ```

3. **Disable webhooks:**
   - Delete webhooks via ClickUp API
   - Or pause Railway service

---

## Security Notes

- ✅ All webhook requests validated with HMAC
- ✅ Secrets stored in Railway environment variables
- ✅ Logs sanitized before writing
- ✅ No secrets in code or Git repository
- ✅ HTTPS only (enforced by Railway)

---

## Next Steps After Deployment

1. ✅ Verify service is running (`/health`, `/ready`)
2. ✅ Register ClickUp webhooks
3. ✅ Create test tickets to validate routing
4. ✅ Monitor logs for errors
5. ✅ Generate Phase 2 Pulse Report

---

**Deployment Status:** Ready for Railway deployment  
**Last Updated:** 2025-10-24  
**Engineer:** Manus

