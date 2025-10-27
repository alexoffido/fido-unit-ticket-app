# Slash Command Failure - Updated Root Cause Analysis

**Issue:** `/fido-issue` and all Slack commands failing with `dispatch_failed`  
**Date:** October 26, 2025  
**Status:** Root cause identified - Configuration conflict  
**Prepared for:** Winston  
**Prepared by:** Manus AI

---

## Executive Summary

The `/fido-issue` slash command failure is caused by **railway.json configuration conflict**. The repository contains a single `railway.json` file that applies to ALL services in the project, forcing every service to run `node services/webhooks/staging/index.js` (webhook router) instead of allowing individual services to run different start commands.

**Current State:**
- ❌ Slack slash commands non-functional
- ✅ ClickUp webhook routing operational
- ⚠️ Second service created but running wrong code due to railway.json override

**Impact:** User attempted to create separate service for Slack bot, but railway.json forced it to run webhook service instead.

---

## Root Cause: Railway.json Configuration Conflict

### The Problem

Railway uses a configuration hierarchy:
1. **railway.json** in repository (highest priority)
2. Service-specific settings in Railway UI (lower priority)
3. Railway defaults (lowest priority)

**Current railway.json:**
```json
{
  "deploy": {
    "startCommand": "node services/webhooks/staging/index.js"
  }
}
```

This configuration **applies to ALL services** deployed from the repository, regardless of individual service settings in the Railway UI.

### What Happened

**Phase 5 Deployment (October 26):**
1. Changed railway.json from `node app.js` to `node services/webhooks/staging/index.js`
2. Deployed to production
3. **Result:** Broke Slack slash commands (app.js no longer running)

**Recovery Attempt:**
1. User created new service "heartfelt-balance" 
2. Set start command to `node app.js` in Railway UI
3. **Result:** Service still runs webhook router due to railway.json override
4. Slash commands remain broken

### Evidence

**Railway API Query Results:**

**Service: heartfelt-balance (intended Slack bot)**
```json
{
  "startCommand": "node app.js",  // ← UI setting (ignored)
  "status": "SUCCESS"
}
```

**Health Check Response:**
```bash
$ curl https://heartfelt-balance-production.up.railway.app/health
{
  "service": "fido-clickup-routing-staging"  // ← Actually running webhook service!
}
```

**Slack Endpoint Test:**
```bash
$ curl -X POST https://heartfelt-balance-production.up.railway.app/slack/commands
{"error":"Not found"}  // ← Slack endpoints don't exist
```

---

## Architecture Overview

### Repository Structure

```
fido-unit-ticket-app/
├── app.js                          # Slack bot (slash commands)
├── services/
│   └── webhooks/
│       └── staging/
│           └── index.js            # ClickUp webhook router
├── railway.json                    # ⚠️ APPLIES TO ALL SERVICES
└── ...
```

### Two Services Required

| Service | Purpose | Start Command | Status |
|---------|---------|---------------|--------|
| **Slack Bot** | Slash commands, modals, user interactions | `node app.js` | ❌ Not running |
| **Webhook Router** | ClickUp webhooks, auto-routing, security | `node services/webhooks/staging/index.js` | ✅ Running |

### Current Production Services

| Railway Service | Intended Purpose | Actual Running | URL |
|----------------|------------------|----------------|-----|
| fido-unit-ticket-app | Webhook router | ✅ Webhook router | fido-unit-ticket-app-production.up.railway.app |
| heartfelt-balance | Slack bot | ❌ Webhook router | heartfelt-balance-production.up.railway.app |

**Problem:** Both services running the same code (webhook router) due to railway.json.

---

## Solution Options

### Option 1: Remove railway.json ⭐ **RECOMMENDED**

**Approach:** Delete railway.json and configure each service individually via Railway UI

**Implementation:**

1. **Remove railway.json from repository**
   ```bash
   cd /home/ubuntu/fido-unit-ticket-app
   git rm railway.json
   git commit -m "Remove railway.json to allow per-service configuration"
   git push origin main
   ```

2. **Configure fido-unit-ticket-app service (webhook router)**
   - In Railway UI → Service Settings
   - Start Command: `node services/webhooks/staging/index.js`
   - Health Check Path: `/health`

3. **Configure heartfelt-balance service (Slack bot)**
   - In Railway UI → Service Settings  
   - Start Command: `node app.js`
   - Health Check Path: `/health`

4. **Redeploy both services**
   - Railway will auto-deploy after git push
   - Or trigger manual redeploy in Railway UI

5. **Update Slack App URLs**
   - Slash Commands → `https://heartfelt-balance-production.up.railway.app/slack/commands`
   - Interactivity → `https://heartfelt-balance-production.up.railway.app/slack/interactive`
   - Events → `https://heartfelt-balance-production.up.railway.app/slack/events`

**Pros:**
- ✅ Clean separation - each service configured independently
- ✅ No code changes required
- ✅ Railway UI provides full control
- ✅ Easy to maintain different configurations
- ✅ Fast implementation (10 minutes)

**Cons:**
- Configuration not in version control (must document separately)
- Need to manually configure each new service

**Estimated Time:** 10-15 minutes

---

### Option 2: Use Service-Specific Railway.json Files

**Approach:** Create separate railway.json files for each service using Railway's root directory feature

**Implementation:**

1. **Restructure repository**
   ```
   fido-unit-ticket-app/
   ├── slack-bot/
   │   ├── railway.json          # startCommand: node app.js
   │   └── (symlink to app.js)
   ├── webhook-router/
   │   ├── railway.json          # startCommand: node services/webhooks/staging/index.js
   │   └── (symlink to services/)
   └── ...
   ```

2. **Configure Railway services**
   - Set "Root Directory" for each service
   - Each service reads its own railway.json

**Pros:**
- ✅ Configuration in version control
- ✅ Service-specific settings

**Cons:**
- ❌ Complex repository structure
- ❌ Requires symlinks or code duplication
- ❌ More difficult to maintain

**Estimated Time:** 30-45 minutes

---

### Option 3: Use Different Branches

**Approach:** Deploy each service from a different branch with its own railway.json

**Implementation:**

1. **Create service-specific branches**
   - `main` → Slack bot (app.js)
   - `webhook-router` → Webhook service

2. **Configure different railway.json per branch**

3. **Deploy services from different branches**

**Pros:**
- ✅ Configuration in version control
- ✅ Clear separation

**Cons:**
- ❌ Branch management complexity
- ❌ Code synchronization issues
- ❌ Difficult to maintain shared code

**Estimated Time:** 20-30 minutes

---

### Option 4: Merge Services into Single Application

**Approach:** Add webhook endpoints to app.js so one service handles everything

**Implementation:**

1. **Add webhook routes to app.js**
   ```javascript
   // Add to app.js
   const webhookRouter = require('./services/webhooks/staging/routes/webhook');
   expressApp.post('/webhook/clickup', webhookRouter);
   ```

2. **Update railway.json**
   ```json
   {
     "deploy": {
       "startCommand": "node app.js"
     }
   }
   ```

3. **Deploy single service**

**Pros:**
- ✅ Single service to manage
- ✅ Simpler deployment

**Cons:**
- ❌ Requires code integration
- ❌ Mixing concerns (Slack + webhooks)
- ❌ Larger service footprint
- ❌ Testing complexity

**Estimated Time:** 45-60 minutes

---

## Recommendation

### Option 1: Remove railway.json

This is the cleanest and fastest solution:

1. **Immediate impact:** Restores slash commands within 15 minutes
2. **No code changes:** Just configuration
3. **Clear separation:** Each service does one thing well
4. **Easy rollback:** Can restore railway.json if needed
5. **Railway best practice:** Service-specific configuration via UI

### Implementation Plan

**Step 1: Remove railway.json (2 minutes)**
```bash
cd /home/ubuntu/fido-unit-ticket-app
git rm railway.json
git commit -m "Remove railway.json - configure services individually via Railway UI"
git push origin main
```

**Step 2: Configure Services in Railway UI (5 minutes)**

**Service: fido-unit-ticket-app (webhook router)**
- Settings → Start Command: `node services/webhooks/staging/index.js`
- Settings → Health Check Path: `/health`
- Settings → Health Check Timeout: 300

**Service: heartfelt-balance (Slack bot)**
- Settings → Start Command: `node app.js`  
- Settings → Health Check Path: `/health`
- Settings → Health Check Timeout: 300

**Step 3: Verify Environment Variables (3 minutes)**

Both services need these variables (already configured):
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `CLICKUP_API_TOKEN`
- `CLICKUP_TEAM_ID`
- All `CLICKUP_LIST_ID_*` variables
- `NODE_ENV=production`

**Webhook service only:**
- `WEBHOOK_HMAC_SECRET`
- `ENABLE_RATE_LIMITING=true`
- `ALERT_CHANNEL_ID`

**Step 4: Trigger Redeployment (2 minutes)**
- Railway will auto-deploy after git push
- Or manually trigger in Railway UI

**Step 5: Test Services (3 minutes)**

**Webhook service:**
```bash
curl https://fido-unit-ticket-app-production.up.railway.app/health
# Should return: {"service":"fido-clickup-routing-staging"}
```

**Slack bot:**
```bash
curl https://heartfelt-balance-production.up.railway.app/health  
# Should return: {"status":"ok"} (from app.js)
```

**Step 6: Update Slack App Configuration (5 minutes)**

Go to [api.slack.com/apps](https://api.slack.com/apps) → Your App

**Slash Commands:**
- `/fido-issue` → `https://heartfelt-balance-production.up.railway.app/slack/commands`
- `/fido-inquiry` → `https://heartfelt-balance-production.up.railway.app/slack/commands`
- `/fido-unit-change` → `https://heartfelt-balance-production.up.railway.app/slack/commands`
- `/fido-ops-ticket` → `https://heartfelt-balance-production.up.railway.app/slack/commands`

**Interactivity & Shortcuts:**
- Request URL: `https://heartfelt-balance-production.up.railway.app/slack/interactive`

**Event Subscriptions:**
- Request URL: `https://heartfelt-balance-production.up.railway.app/slack/events`

**Step 7: Test Slash Commands (2 minutes)**
- Run `/fido-issue` in Slack
- Should open modal successfully

---

## Testing Checklist

After implementation:

### Webhook Service Tests
- [ ] Health endpoint returns correct service name
- [ ] ClickUp webhook received and processed
- [ ] HMAC validation working
- [ ] Security alerts triggering correctly
- [ ] Routing logic functioning

### Slack Bot Service Tests
- [ ] Health endpoint responds
- [ ] `/fido-issue` opens modal
- [ ] `/fido-inquiry` opens modal
- [ ] `/fido-unit-change` opens modal
- [ ] `/fido-ops-ticket` opens modal
- [ ] Modal submission creates ClickUp task
- [ ] Interactive components working

---

## Rollback Plan

If issues arise:

**Quick Rollback:**
```bash
cd /home/ubuntu/fido-unit-ticket-app
git revert HEAD  # Restore railway.json
git push origin main
```

This will restore the webhook service but break slash commands again. Use only if webhook routing fails.

**Full Rollback:**
1. Restore railway.json with `node app.js`
2. Temporarily lose webhook routing
3. Investigate and fix issues
4. Re-implement solution

---

## Documentation Updates Needed

After successful implementation:

1. **Update deployment documentation**
   - Document that railway.json was removed
   - Document service-specific configuration in Railway UI
   - Add screenshots of Railway service settings

2. **Update README**
   - Explain two-service architecture
   - Document which service handles what
   - Provide URLs for each service

3. **Create runbook**
   - How to deploy each service
   - How to update Slack App URLs
   - Troubleshooting guide

---

## Long-Term Considerations

### Service Naming
Current names are Railway-generated. Consider renaming for clarity:
- `heartfelt-balance` → `fido-slack-bot`
- `fido-unit-ticket-app` → `fido-webhook-router`

### Monitoring
- Set up separate monitoring for each service
- Track slash command response times
- Monitor webhook processing times
- Alert on service-specific failures

### Scaling
- Slack bot: Scale based on user interaction volume
- Webhook router: Scale based on ClickUp event volume
- Independent scaling allows cost optimization

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Redeployment fails | Low | High | Test in staging first |
| Slack URLs not updated | Medium | High | Checklist + verification |
| Environment variables missing | Low | High | Copy from existing service |
| Railway.json removal breaks other services | Low | Medium | Only two services affected, both configured |

---

## Next Steps

1. **Awaiting approval** from Winston
2. **Ready to implement** Option 1 immediately
3. **Estimated completion:** 20 minutes after approval

---

## Additional Context

### Why This Happened

During Phase 5 deployment, we focused on the webhook routing service and updated railway.json to deploy it. This was correct for a single-service architecture, but we didn't account for the need to run both services simultaneously.

### Lessons Learned

1. **Railway.json applies globally** - affects all services in a repo
2. **Service separation requires configuration separation** - can't use single railway.json for multiple services
3. **UI configuration preferred** for multi-service repos
4. **Test service endpoints** after deployment, not just health checks

### Future Recommendations

1. **Remove railway.json** for multi-service repos
2. **Use Railway UI** for service-specific configuration
3. **Document configuration** in separate docs (not version controlled)
4. **Consider monorepo tools** if services grow in number

---

**Status:** Awaiting approval to proceed with Option 1  
**Prepared by:** Manus AI  
**Date:** October 26, 2025  
**Priority:** High

