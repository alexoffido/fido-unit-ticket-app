# Production Environment Variables Template

**⚠️ SECURITY NOTICE:** This template contains placeholders. Never commit actual secrets to Git.

---

## Required Variables (Copy from Staging + Production-Specific)

### ClickUp Configuration
```
CLICKUP_API_TOKEN=(copy from staging)
CLICKUP_TEAM_ID=9013484736
CLICKUP_LIST_ID=(copy from staging)
CLICKUP_LIST_ID_INQUIRY=(copy from staging)
CLICKUP_LIST_ID_ISSUE=(copy from staging)
CLICKUP_LIST_ID_OPS_TICKETS=(copy from staging)
CLICKUP_LIST_ID_UNIT=(copy from staging)
FIELD_MANIFEST_PATH=/clickup/config/field_manifest.json
```

### Slack Configuration
```
SLACK_BOT_TOKEN=(copy from staging - starts with xoxb-)
ALERT_CHANNEL_ID=C09NVLUNDL4
```

### Security Configuration (PRODUCTION-SPECIFIC)
```
WEBHOOK_HMAC_SECRET=ca9d5e98d71c8b1fb215c70ecce9678b1f27faa0e81ad9e4deda2a6fc1586983
ENABLE_RATE_LIMITING=true
```

### Application Configuration
```
NODE_ENV=production
PORT=3000
```

---

## Optional Variables

### Feature Flags
```
CX_ROUTING_MODE=auto
```

### Additional Configuration
```
(Add any other variables from staging that are needed)
```

---

## Verification Checklist

After setting variables in Railway:

- [ ] All ClickUp variables copied from staging
- [ ] SLACK_BOT_TOKEN present (xoxb-...)
- [ ] ALERT_CHANNEL_ID set to C09NVLUNDL4
- [ ] **NEW** WEBHOOK_HMAC_SECRET (not staging secret)
- [ ] ENABLE_RATE_LIMITING set to `true`
- [ ] NODE_ENV set to `production`
- [ ] No variables contain "test" or "staging" values

---

## Quick Copy Format (for Railway JSON import)

If copying from staging as JSON, update these values after import:

```json
{
  "WEBHOOK_HMAC_SECRET": "ca9d5e98d71c8b1fb215c70ecce9678b1f27faa0e81ad9e4deda2a6fc1586983",
  "ENABLE_RATE_LIMITING": "true",
  "NODE_ENV": "production"
}
```

---

## Security Notes

1. **Never reuse staging HMAC secret** - Always generate new for production
2. **Enable rate limiting** - Protection against abuse
3. **Verify Slack bot token** - Must have access to production alert channel
4. **Double-check list IDs** - Ensure pointing to production ClickUp lists
5. **Keep secrets in Railway only** - Never commit to Git or share in plain text

