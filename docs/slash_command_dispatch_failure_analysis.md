# Slash Command Dispatch Failure - Root Cause Analysis

**Issue:** `/fido-issue` and related Slack commands failing with `dispatch_failed` error  
**Date:** October 26, 2025  
**Severity:** High (Slack commands non-functional)  
**Prepared for:** Winston  
**Prepared by:** Manus AI

---

## Executive Summary

The `/fido-issue` slash command (and all related Slack commands) are failing with `dispatch_failed` error after Phase 5 production deployment. Root cause identified as inadvertent replacement of the Slack bot service with the webhook routing service during deployment. Two services exist with different responsibilities, but only one can run with current Railway configuration.

**Current Status:**
- ❌ Slack slash commands broken
- ✅ ClickUp webhook routing operational

**Recommended Solution:** Deploy two separate Railway services to restore full functionality.

---

## Issue Details

### Symptoms
- User executes `/fido-issue` in Slack
- Slack returns: `dispatch_failed` error
- No server logs generated (service not receiving requests)
- All slash commands affected: `/fido-issue`, `/fido-inquiry`, `/fido-unit-change`, `/fido-ops-ticket`

### Timeline
1. **Before Phase 5:** Single service running `app.js` handled both Slack commands and basic functionality
2. **During Phase 5:** Built new webhook routing service in `services/webhooks/staging/`
3. **Phase 5 Deployment:** Changed Railway start command to new webhook service
4. **Result:** Slash commands stopped working (service no longer running)

---

## Root Cause Analysis

### Configuration Change

**Original Configuration (Working):**
```json
{
  "deploy": {
    "startCommand": "node app.js"
  }
}
```

**Current Configuration (Broken Slash Commands):**
```json
{
  "deploy": {
    "startCommand": "node services/webhooks/staging/index.js"
  }
}
```

### Architecture Discovery

The codebase contains **two separate services** with different responsibilities:

#### Service 1: Slack Bot (`app.js`)

**Purpose:** Slack integration and user-initiated ticket creation

**Responsibilities:**
- Slash command handlers (`/fido-issue`, `/fido-inquiry`, `/fido-unit-change`, `/fido-ops-ticket`)
- Interactive modal rendering
- Button and dropdown action handlers
- User input validation
- Creating ClickUp tasks from Slack
- Slack event processing

**Technical Stack:**
- Slack Bolt framework
- Express receiver
- ClickUp API client

**Endpoints:**
- `/slack/commands` - Slash command receiver
- `/slack/events` - Slack event receiver
- `/slack/interactive` - Interactive component receiver
- `/health` - Health check

**Current Status:** ❌ **Not running** (replaced by webhook service)

---

#### Service 2: ClickUp Webhook Router (`services/webhooks/staging/index.js`)

**Purpose:** Automatic ticket routing based on ClickUp webhook events

**Responsibilities:**
- Receiving ClickUp webhook events (`taskCreated`, `taskUpdated`)
- HMAC-SHA256 signature validation
- Replay attack protection
- Rate limiting
- Intelligent routing logic:
  - VIP customer routing to assigned CX owner
  - Standard customer routing to CX owner
  - Market-based Ops routing
  - Fallback tagging for manual routing
- Security alerting to Slack (#fido-os-sys-alerts)
- Structured logging

**Technical Stack:**
- Express.js
- Custom middleware (HMAC, rate limiting, replay protection)
- ClickUp API client
- Slack Web API (for alerts)

**Endpoints:**
- `/webhook/clickup` - ClickUp webhook receiver
- `/health` - Health check
- `/ready` - Readiness check with security status

**Current Status:** ✅ **Running in production**

---

## Impact Assessment

### Currently Non-Functional
- ❌ All Slack slash commands
- ❌ User-initiated ticket creation from Slack
- ❌ Interactive modals for ticket forms
- ❌ Slack-based ticket workflows

### Currently Operational
- ✅ ClickUp webhook routing
- ✅ Automatic ticket assignment based on VIP/customer/market
- ✅ HMAC signature validation
- ✅ Security alerting (401 threshold alerts)
- ✅ Replay protection
- ✅ Rate limiting

### Business Impact
- **CX Team:** Cannot create tickets via Slack commands
- **Ops Team:** Cannot use `/fido-ops-ticket` workflow
- **Automated Routing:** Working as designed for webhook-triggered events

---

## Solution Options

### Option 1: Deploy Two Separate Railway Services ⭐ **RECOMMENDED**

**Approach:** Run both services independently in production

**Architecture:**
```
Railway Production Environment
├── Service 1: fido-slack-bot (app.js)
│   └── Handles: Slash commands, Slack events, user interactions
└── Service 2: fido-unit-ticket-app (webhook router)
    └── Handles: ClickUp webhooks, auto-routing, security
```

**Implementation Steps:**

1. **Keep Current Production Service Running**
   - Current service continues handling ClickUp webhooks
   - No changes needed to existing deployment

2. **Create New Railway Service for Slack Bot**
   - Service name: `fido-slack-bot`
   - Repository: `alexoffido/fido-unit-ticket-app`
   - Branch: `main`
   - Start command: `node app.js`
   - Health check: `/health`

3. **Configure Environment Variables (Copy from Current Service)**
   ```
   SLACK_BOT_TOKEN=(copy from current service)
   SLACK_SIGNING_SECRET=(copy from current service)
   CLICKUP_API_TOKEN=(copy from current service)
   CLICKUP_TEAM_ID=9013484736
   CLICKUP_LIST_ID=(copy all list IDs)
   CLICKUP_LIST_ID_INQUIRY=(copy)
   CLICKUP_LIST_ID_ISSUE=(copy)
   CLICKUP_LIST_ID_UNIT=(copy)
   NODE_ENV=production
   PORT=(Railway auto-provides)
   ```

4. **Update Slack App Configuration**
   - Go to Slack App settings (api.slack.com/apps)
   - Update **Slash Commands** URLs to new service:
     - `/fido-issue` → `https://fido-slack-bot-production.up.railway.app/slack/commands`
     - `/fido-inquiry` → `https://fido-slack-bot-production.up.railway.app/slack/commands`
     - `/fido-unit-change` → `https://fido-slack-bot-production.up.railway.app/slack/commands`
     - `/fido-ops-ticket` → `https://fido-slack-bot-production.up.railway.app/slack/commands`
   - Update **Interactivity & Shortcuts** → Request URL:
     - `https://fido-slack-bot-production.up.railway.app/slack/interactive`
   - Update **Event Subscriptions** → Request URL:
     - `https://fido-slack-bot-production.up.railway.app/slack/events`

5. **Verify Deployment**
   - Test health endpoint: `curl https://fido-slack-bot-production.up.railway.app/health`
   - Test slash command in Slack: `/fido-issue`
   - Verify webhook routing still works (create test ClickUp task)

**Pros:**
- ✅ Clean separation of concerns
- ✅ Independent scaling and monitoring
- ✅ No code changes required
- ✅ Both services remain fully operational
- ✅ Easy to debug and maintain
- ✅ Follows microservices best practices

**Cons:**
- Requires managing two Railway services
- Slightly higher infrastructure complexity
- Two services to monitor

**Estimated Time:** 15-20 minutes

**Cost Impact:** Minimal (Railway charges per service, but both are lightweight)

---

### Option 2: Merge Webhook Routing into app.js (Single Service)

**Approach:** Integrate webhook routing functionality into the Slack bot service

**Implementation Steps:**

1. **Add Webhook Endpoint to app.js**
   ```javascript
   // Add to app.js after Bolt app initialization
   const webhookRouter = require('./services/webhooks/staging/routes/webhook');
   const hmacMiddleware = require('./services/webhooks/staging/middleware/hmac');
   
   expressApp.post('/webhook/clickup', hmacMiddleware, webhookRouter);
   ```

2. **Import Required Modules**
   - Webhook routing logic
   - HMAC validation middleware
   - Rate limiting middleware
   - Replay protection
   - Alerting utilities

3. **Update railway.json**
   ```json
   {
     "deploy": {
       "startCommand": "node app.js"
     }
   }
   ```

4. **Add Environment Variables**
   - `WEBHOOK_HMAC_SECRET`
   - `ENABLE_RATE_LIMITING`
   - `ALERT_CHANNEL_ID`

5. **Test Integration**
   - Verify slash commands work
   - Verify webhook routing works
   - Test all security features

6. **Deploy to Production**

**Pros:**
- ✅ Single service deployment
- ✅ Simpler Railway configuration
- ✅ All functionality in one codebase
- ✅ Easier environment variable management

**Cons:**
- ❌ Requires code integration work
- ❌ Mixing concerns (Slack bot + webhook routing)
- ❌ Larger, more complex service
- ❌ Potential for conflicts between frameworks
- ❌ More difficult to scale independently
- ❌ Longer testing required

**Estimated Time:** 30-45 minutes (coding + testing)

**Risk:** Medium (integration complexity, potential bugs)

---

### Option 3: Quick Revert (Temporary Fix) ⚠️ **NOT RECOMMENDED**

**Approach:** Revert railway.json to restore slash commands

**Implementation:**
1. Change railway.json: `"startCommand": "node app.js"`
2. Redeploy production
3. Slash commands restored

**Pros:**
- ✅ Immediate fix (5 minutes)
- ✅ Minimal changes

**Cons:**
- ❌ **Breaks all ClickUp webhook routing** (Phase 2-5 work lost)
- ❌ **Loses automatic ticket assignment**
- ❌ **Loses security features** (HMAC validation, alerting, replay protection)
- ❌ Not a viable long-term solution
- ❌ Regression of production functionality

**Estimated Time:** 5 minutes

**Risk:** High (breaks critical functionality)

---

## Recommendation

### Deploy Option 1: Two Separate Railway Services

This approach is strongly recommended because it:

1. **Maintains All Functionality:** Both Slack commands and webhook routing remain operational
2. **Preserves Phase 2-5 Work:** All security features and routing logic remain intact
3. **Clean Architecture:** Proper separation of concerns between user-initiated and event-driven workflows
4. **Minimal Risk:** No code changes required, just configuration
5. **Fast Implementation:** Can be completed in 15-20 minutes
6. **Easy Rollback:** If issues arise, can quickly revert Slack App URLs

### Implementation Priority

**Immediate (Next 30 minutes):**
1. Create new Railway service for Slack bot
2. Configure environment variables
3. Update Slack App URLs
4. Test slash commands

**Short-term (Next 24 hours):**
1. Monitor both services for stability
2. Verify all workflows functioning
3. Update documentation

**Long-term (Phase 6):**
1. Add monitoring dashboards
2. Implement shared logging
3. Consider service mesh if complexity grows

---

## Environment Variables Reference

### Required for Both Services

| Variable | Purpose | Example/Notes |
|----------|---------|---------------|
| `SLACK_BOT_TOKEN` | Slack bot authentication | Starts with `xoxb-` |
| `SLACK_SIGNING_SECRET` | Slack request verification | From Slack App settings |
| `CLICKUP_API_TOKEN` | ClickUp API access | Starts with `pk_` |
| `CLICKUP_TEAM_ID` | ClickUp team identifier | `9013484736` |
| `NODE_ENV` | Environment flag | `production` |
| `PORT` | Server port | Railway auto-provides |

### Slack Bot Service Specific

| Variable | Purpose | Example/Notes |
|----------|---------|---------------|
| `CLICKUP_LIST_ID` | Default list ID | From staging |
| `CLICKUP_LIST_ID_INQUIRY` | Customer inquiries list | From staging |
| `CLICKUP_LIST_ID_ISSUE` | Service issues list | From staging |
| `CLICKUP_LIST_ID_UNIT` | Unit management list | From staging |

### Webhook Service Specific

| Variable | Purpose | Example/Notes |
|----------|---------|---------------|
| `WEBHOOK_HMAC_SECRET` | Webhook signature validation | 64-char hex string |
| `ENABLE_RATE_LIMITING` | Enable rate limiter | `true` |
| `ALERT_CHANNEL_ID` | Slack alert channel | `C09NVLUNDL4` |

---

## Testing Checklist

After implementing the solution:

### Slack Bot Service Tests
- [ ] `/fido-issue` opens modal
- [ ] `/fido-inquiry` opens modal
- [ ] `/fido-unit-change` opens modal
- [ ] `/fido-ops-ticket` opens modal
- [ ] Modal submission creates ClickUp task
- [ ] Health endpoint returns 200

### Webhook Service Tests
- [ ] ClickUp webhook received and validated
- [ ] VIP customer routed correctly
- [ ] Standard customer routed correctly
- [ ] Market-based Ops routing works
- [ ] Invalid signature returns 401
- [ ] Replay attack returns 409
- [ ] Security alert triggered at threshold
- [ ] Health and ready endpoints return 200

---

## Rollback Plan

If issues arise after implementation:

1. **Slack Bot Service Issues:**
   - Revert Slack App URLs to previous configuration
   - Stop problematic Railway service
   - Investigate logs

2. **Webhook Service Issues:**
   - Service continues running unchanged
   - No rollback needed

3. **Both Services Issues:**
   - Revert railway.json to `node app.js`
   - Temporarily lose webhook routing
   - Restore slash commands immediately
   - Investigate and fix issues before re-deploying

---

## Next Steps

1. **Awaiting approval** from Winston on solution approach
2. **Ready to implement** Option 1 immediately upon confirmation
3. **Estimated completion:** 20 minutes after approval

---

## Additional Notes

- All secrets and tokens should remain in Railway environment variables only
- No secrets should be committed to Git
- Both services can share the same environment variables (copy from existing service)
- Slack App URL updates may take 1-2 minutes to propagate
- Test in a non-production channel first if possible

---

**Prepared by:** Manus AI (Fido OS System Engineer)  
**Date:** October 26, 2025  
**Priority:** High  
**Status:** Awaiting approval to proceed

