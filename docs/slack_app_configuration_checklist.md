# Slack App Configuration Checklist

**App:** Fido OS  
**Workspace:** getfido  
**Production Service:** fido-slack-bot-production.up.railway.app  
**Date:** October 27, 2025

---

## ✅ Slash Commands Configuration

All slash commands must point to: `https://fido-slack-bot-production.up.railway.app/slack/commands`

### Commands to Configure:

- [x] `/fido-issue`
  - **Request URL:** `https://fido-slack-bot-production.up.railway.app/slack/commands`
  - **Short Description:** Report a service issue
  - **Usage Hint:** `[property] [issue description]`

- [x] `/fido-inquiry`
  - **Request URL:** `https://fido-slack-bot-production.up.railway.app/slack/commands`
  - **Short Description:** Submit a customer inquiry
  - **Usage Hint:** `[customer name] [inquiry details]`

- [x] `/fido-unit-change`
  - **Request URL:** `https://fido-slack-bot-production.up.railway.app/slack/commands`
  - **Short Description:** Report a unit change
  - **Usage Hint:** `[unit] [change details]`

- [x] `/fido-ops-ticket`
  - **Request URL:** `https://fido-slack-bot-production.up.railway.app/slack/commands`
  - **Short Description:** Create an operations ticket
  - **Usage Hint:** `[market] [ticket details]`

---

## ✅ Interactivity & Shortcuts

- [x] **Interactivity:** ON
- [x] **Request URL:** `https://fido-slack-bot-production.up.railway.app/slack/interactive`
- [x] **Options Load URL:** (Leave empty)
- [x] **Select Menus:** (None configured)
- [x] **Message Menus:** (None configured)

---

## ✅ Event Subscriptions

- [x] **Enable Events:** OFF (Not required for current functionality)
- [ ] **Request URL:** `https://fido-slack-bot-production.up.railway.app/slack/events` (If enabled in future)

---

## ✅ OAuth & Permissions

### Bot Token Scopes (Required):
- [x] `chat:write` - Post messages to channels
- [x] `chat:write.public` - Post to public channels without joining
- [x] `commands` - Add slash commands
- [x] `users:read` - View user information
- [x] `channels:read` - View basic channel information
- [x] `groups:read` - View private channel information

### Installation:
- [x] App installed to workspace
- [x] Bot added to required channels:
  - `#fido-cx` (C07PN5F527N)
  - `#cx-unit-changes` (C08M77HMRT9)
  - `#fido-os-sys-alerts` (C09NVLUNDL4)

---

## ✅ App Credentials (Configured in Railway)

Environment variables set in `fido-slack-bot` service:

- [x] `SLACK_BOT_TOKEN` - Bot User OAuth Token (xoxb-...)
- [x] `SLACK_SIGNING_SECRET` - Signing Secret for request verification

---

## ✅ Testing Checklist

- [x] `/fido-issue` opens modal
- [x] Modal submission creates ClickUp task
- [x] ClickUp task link posted to Slack thread
- [x] Task appears in correct ClickUp list (Service Issues)
- [x] All custom fields populated correctly
- [x] Slack message formatting correct

---

## 🔧 Troubleshooting

### If slash command fails:
1. Check Railway logs for `fido-slack-bot` service
2. Verify `SLACK_SIGNING_SECRET` matches Slack App settings
3. Ensure bot is member of target channel
4. Check `DEBUG_CLICKUP=true` is set for detailed logging

### If ClickUp task creation fails:
1. Verify `CLICKUP_API_TOKEN` is valid
2. Check `CLICKUP_LIST_ID_*` variables match production lists
3. Review Railway logs for API error details
4. Test debug endpoint: `https://fido-slack-bot-production.up.railway.app/debug/clickup-test`

---

## 📋 Service URLs

- **Slack Bot Service:** https://fido-slack-bot-production.up.railway.app
- **Webhook Router Service:** https://fido-unit-ticket-app-production.up.railway.app
- **Slack App Management:** https://api.slack.com/apps/A09AXBCJEPL

---

**Last Updated:** October 27, 2025  
**Status:** ✅ All systems operational

