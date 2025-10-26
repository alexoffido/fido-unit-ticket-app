# Railway Production Setup - Quick Reference

**Project:** gregarious-ambition  
**Environment:** production  
**Service Name:** fido-unit-ticket-app

---

## Step-by-Step Setup

### 1. Switch to Production Environment
- Open Railway dashboard
- Select project: `gregarious-ambition`
- Click environment dropdown (top right)
- Select: **production**

### 2. Clean Up Existing Services (if any)
- Look for any existing `fido-unit-ticket-app` services
- If found: Click service → Settings → Delete Service
- Confirm deletion

### 3. Create New Service
- Click **+ Create**
- Select **Deploy from GitHub Repo**
- Choose repository: `alexoffido/fido-unit-ticket-app`
- Select branch: `main`
- Wait for initial build

### 4. Configure Environment Variables

**Option A - Copy from Staging (Recommended):**
1. Go to staging environment
2. Click Variables tab
3. Click ⋮ menu → **Copy as JSON**
4. Go back to production environment
5. Click Variables tab → **Import JSON**
6. Paste and save

**Option B - Manual Entry:**

| Variable | Value |
|----------|-------|
| `CLICKUP_API_TOKEN` | (same as staging) |
| `CLICKUP_TEAM_ID` | `9013484736` |
| `SLACK_BOT_TOKEN` | (same as staging) |
| `ALERT_CHANNEL_ID` | `C09NVLUNDL4` |
| `WEBHOOK_HMAC_SECRET` | `ca9d5e98d71c8b1fb215c70ecce9678b1f27faa0e81ad9e4deda2a6fc1586983` |
| `ENABLE_RATE_LIMITING` | `true` |
| `NODE_ENV` | `production` |

**Additional variables from staging:**
- `CLICKUP_LIST_ID`
- `CLICKUP_LIST_ID_INQUIRY`
- `CLICKUP_LIST_ID_ISSUE`
- `CLICKUP_LIST_ID_OPS_TICKETS`
- `CLICKUP_LIST_ID_UNIT`
- `FIELD_MANIFEST_PATH`
- `PORT`
- Any other ClickUp-related variables

### 5. Set Start Command
- Go to service Settings
- Find **Start Command** section
- Enter: `node services/webhooks/staging/index.js`
- Save

### 6. Deploy
- Click **Deploy** (if not auto-deployed)
- Wait for build to complete
- Check logs for: "Server listening on port 3000"

### 7. Get Production URL
- Copy the Railway-generated URL
- Should be: `https://fido-unit-ticket-app-production.up.railway.app`
- Or similar Railway domain

---

## Verification Checklist

After deployment, verify:

- [ ] Service status: **Active**
- [ ] Build logs: No errors
- [ ] Runtime logs: "Server listening on port 3000"
- [ ] Environment variables: All configured
- [ ] HMAC secret: New production secret set
- [ ] Rate limiting: Enabled (`true`)

---

## Next Steps After Deployment

Once service is running:
1. Test health endpoints
2. Register production webhooks
3. Run smoke tests
4. Verify Slack alerts

---

## Troubleshooting

**Build fails:**
- Check start command is correct
- Verify `main` branch is selected
- Check build logs for missing dependencies

**Service crashes:**
- Check environment variables are set
- Look for missing required variables in logs
- Verify `NODE_ENV=production`

**Can't access service:**
- Check Railway generated the public URL
- Verify service is running (not crashed)
- Check firewall/network settings

---

## Important Notes

- **Never reuse staging HMAC secret in production**
- **Always enable rate limiting in production**
- **Keep staging service running** (for rollback if needed)
- **Production URL will be different from staging**
- **Webhooks must be re-registered** with new URL and secret

