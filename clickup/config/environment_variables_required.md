# Required Environment Variables for Fido OS Phase 1

## Shared Variables (Cross-Service Access)

### ClickUp API Access
- **Name**: `CLICKUP_API_TOKEN`
- **Placement**: Shared (used by webhook service, CSV importer, schema scripts)
- **Purpose**: ClickUp API authentication for all operations

- **Name**: `CLICKUP_TEAM_ID`
- **Placement**: Shared (used by all ClickUp integrations)
- **Purpose**: ClickUp workspace identifier (9013484736)

### Slack API Access
- **Name**: `SLACK_BOT_TOKEN`
- **Placement**: Shared (used by notification systems)
- **Purpose**: Slack API authentication for import summaries and notifications

- **Name**: `SLACK_SIGNING_SECRET`
- **Placement**: Shared (used by webhook verification)
- **Purpose**: Slack webhook signature verification

## Service-Specific Variables

### Webhook Service (Phase 2)
- **Name**: `WEBHOOK_HMAC_SECRET`
- **Placement**: Service-specific (fido-clickup-routing-staging)
- **Purpose**: ClickUp webhook signature verification for security

### CSV Importer Service (Phase 3)
- **Name**: `CSV_UPLOAD_SECRET`
- **Placement**: Service-specific (fido-csv-importer-staging)
- **Purpose**: Import app authentication and security

- **Name**: `GOOGLE_OAUTH_CLIENT_ID`
- **Placement**: Service-specific (fido-csv-importer-staging)
- **Purpose**: Google OAuth authentication for admin access control

- **Name**: `GOOGLE_OAUTH_CLIENT_SECRET`
- **Placement**: Service-specific (fido-csv-importer-staging)
- **Purpose**: Google OAuth configuration

## Configuration Variables

### Field Manifest Path
- **Name**: `FIELD_MANIFEST_PATH`
- **Placement**: Shared (used by all automation scripts)
- **Purpose**: Path to field ID configuration file (/clickup/config/field_manifest.json)

### Notification Channels
- **Name**: `SLACK_CRM_IMPORTS_CHANNEL`
- **Placement**: Shared (used by import notifications)
- **Purpose**: Slack channel ID for CSV import summaries

- **Name**: `SLACK_PAYROLL_SUMMARY_CHANNEL`
- **Placement**: Shared (used by payroll automation)
- **Purpose**: Slack channel ID for payroll summaries

## Phase 1 Immediate Requirements

For Phase 1 schema creation, only these variables are required:
- `CLICKUP_API_TOKEN`
- `CLICKUP_TEAM_ID`

Additional variables will be needed as we progress to Phase 2 and Phase 3.

