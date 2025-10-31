// app.js (production w/ Ops → CX added)
require('dotenv').config();
const { App, ExpressReceiver } = require('@slack/bolt');

/* ──────────────────────────────────────────────────────────────────────────
   Env diagnostics (non-fatal so health still works)
────────────────────────────────────────────────────────────────────────── */
const env = (k) => process.env[k];
const REQUIRED_FOR_SLACK = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'];
const missingSlack = REQUIRED_FOR_SLACK.filter(k => !env(k));
if (missingSlack.length) {
  console.warn(`[BOOT] Missing Slack env vars: ${missingSlack.join(', ')}`);
}

const NODE_ENV = env('NODE_ENV') || 'production';
const DIAG = env('FIDO_DIAG') === '1'; // set FIDO_DIAG=1 to print more
const PORT = parseInt(env('PORT') || '3000', 10);

/* ──────────────────────────────────────────────────────────────────────────
   Safe ClickUp loader (never throw at boot)
   NOTE: Your ClickUp service must support createTask('ops', ...)
────────────────────────────────────────────────────────────────────────── */
function buildClickUpServiceSafe() {
  try {
    const need = ['CLICKUP_API_TOKEN', 'CLICKUP_TEAM_ID'];
    const missing = need.filter(k => !env(k));
    if (missing.length) {
      console.warn(`[BOOT] ClickUp disabled (missing: ${missing.join(', ')})`);
      return { isEnabled: false, async createTask() { return { success: false, error: 'ClickUp disabled (missing env)' }; } };
    }
    const ClickUpService = require('./services/clickup'); // your file
    const svc = new ClickUpService();
    if (typeof svc.createTask !== 'function') {
      console.warn('[BOOT] ClickUp disabled (no createTask function)');
      return { isEnabled: false, async createTask() { return { success: false, error: 'ClickUp disabled (bad service)' }; } };
    }
    console.log('[BOOT] ClickUp enabled');
    return { isEnabled: true, createTask: svc.createTask.bind(svc) };
  } catch (err) {
    console.warn(`[BOOT] ClickUp disabled (constructor error): ${err.message}`);
    return { isEnabled: false, async createTask() { return { success: false, error: 'ClickUp disabled (constructor error)' }; } };
  }
}
const clickupService = buildClickUpServiceSafe();

/* ──────────────────────────────────────────────────────────────────────────
   Explicit ExpressReceiver with known paths
────────────────────────────────────────────────────────────────────────── */
const receiver = new ExpressReceiver({
  signingSecret: env('SLACK_SIGNING_SECRET') || 'missing',
  endpoints: {
    events: '/slack/events',
    commands: '/slack/commands',
    interactive: '/slack/interactive',
  },
});

// Very early probe/health routes BEFORE Bolt middleware
const expressApp = receiver.app;
expressApp.get('/', (_req, res) => res.status(200).send('ok'));
['/health', '/healthz', '/live', '/ready', '/status'].forEach(p => {
  expressApp.get(p, (_req, res) => res.status(200).type('text/plain').send('ok'));
  expressApp.head(p, (_req, res) => res.sendStatus(200));
});

// Debug endpoint for ClickUp testing (always available)
expressApp.get('/debug/clickup-test', async (_req, res) => {
  try {
    const result = await clickupService.createTask('issue', {
      ticketId: 'DEBUG-TEST',
      property: 'Debug Test Property',
      clientName: 'Debug Test Client',
      market: 'test',
      issueType: 'Debug Test',
      priority: 'normal',
      description: 'This is a debug test task',
      source: 'debug',
      sourceDetails: 'debug endpoint',
      dateStr: new Date().toISOString()
    }, 'https://debug.test', 'U000000');
    
    res.status(200).json({
      clickupServiceEnabled: clickupService.isEnabled,
      result: result,
      env: {
        CLICKUP_API_TOKEN: !!env('CLICKUP_API_TOKEN'),
        CLICKUP_API_TOKEN_LENGTH: env('CLICKUP_API_TOKEN')?.length || 0,
        CLICKUP_TEAM_ID: !!env('CLICKUP_TEAM_ID'),
        CLICKUP_LIST_ID_ISSUE: !!env('CLICKUP_LIST_ID_ISSUE'),
        CLICKUP_LIST_ID_ISSUE_VALUE: env('CLICKUP_LIST_ID_ISSUE'),
        DEBUG_CLICKUP: env('DEBUG_CLICKUP')
      }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      clickupServiceEnabled: clickupService.isEnabled
    });
  }
});

// Optional env sanity endpoint (only when DIAG=1)
if (DIAG) {
  expressApp.get('/diag/env', (_req, res) => {
    res.status(200).json({
      node: process.versions.node,
      env: {
        SLACK_BOT_TOKEN: !!env('SLACK_BOT_TOKEN'),
        SLACK_SIGNING_SECRET: !!env('SLACK_SIGNING_SECRET'),
        CLICKUP_API_TOKEN: !!env('CLICKUP_API_TOKEN'),
        CLICKUP_TEAM_ID: !!env('CLICKUP_TEAM_ID'),
        PORT: env('PORT'),
        NODE_ENV,
        OPS_COMMAND: '/fido-ops-ticket', // quick reminder
      }
    });
  });
}

// Request logger to catch route + timing
expressApp.use((req, _res, next) => {
  if (DIAG) console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

/* ──────────────────────────────────────────────────────────────────────────
   Build App
────────────────────────────────────────────────────────────────────────── */
const app = new App({
  token: env('SLACK_BOT_TOKEN') || 'missing',
  signingSecret: env('SLACK_SIGNING_SECRET') || 'missing',
  socketMode: false,
  receiver,
});

// Ack timing guard: log if we ever miss the 3s window
app.use(async ({ next, logger, body, payload, command }) => {
  const started = Date.now();
  try {
    await next();
  } finally {
    const ms = Date.now() - started;
    if (DIAG && ms > 2500) {
      logger.warn(`[ACK] Slow handler ~${ms}ms for type=${body?.type || command?.command || payload?.type || 'unknown'}`);
    }
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   Constants
────────────────────────────────────────────────────────────────────────── */
const CHANNELS = {
  FIDO_CX: env('FIDO_CX_CHANNEL_ID') || 'C07PN5F527N',
  CX_UNIT_CHANGES: env('CX_UNIT_CHANGES_CHANNEL_ID') || 'C08M77HMRT9',
};
const SUBTEAMS = {
  BP_OPERATIONS: env('BP_OPERATIONS_SUBTEAM_ID') || 'SXXXXBP',
  CX: env('CX_SUBTEAM_ID') || 'SXXXXCX',
  BPO_MGMT: env('BPO_MGMT_SUBTEAM_ID') || 'SXXXXBPO',
};

// Add FO- prefix for Ops → CX
function generateTicketId(type) {
  const prefix =
    type === 'issue'   ? 'FI' :
    type === 'inquiry' ? 'FQ' :
    type === 'unit'    ? 'FU' :
    type === 'ops'     ? 'FO' : 'FX';
  const ts = Date.now().toString().slice(-6);
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${ts}${rnd}`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Modal Schemas (existing)
────────────────────────────────────────────────────────────────────────── */
const MARKET_OPTIONS = [
  ['ATX','Austin, TX'],['ANA','Anaheim, CA'],['CHS','Charleston, SC'],['CLT','Charlotte, NC'],
  ['DEN','Denver, CO'],['DFW','Dallas/Fort Worth, TX'],['FLL','Fort Lauderdale, FL'],['GEG','Spokane, WA'],
  ['HOT','Hot Springs, AR'],['JAX','Jacksonville, FL'],['LAX','Los Angeles, CA'],['LIT','Little Rock, AR'],
  ['PHX','Phoenix, AZ'],['PIE','St. Petersburg/Clearwater, FL'],['SAN','San Diego, CA'],['SAT','San Antonio, TX'],
  ['SDX','Sedona, AZ'],['SEA','Seattle, WA'],['SLC','Salt Lake City, UT'],['SRQ','Sarasota, FL'],
  ['STA','St. Augustine, FL'],['STS','Santa Rosa/Sonoma, CA'],['VPS','Destin/Fort Walton Beach, FL'],
  ['MISC','Other Market (MISC)']
].map(([code, name]) => ({
  text: { type: 'plain_text', text: `${name} (${code})` },
  value: code.toLowerCase()
}));
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_OPTS = d => ({ text: { type: 'plain_text', text: `🗓️ ${d}` }, value: d.toLowerCase() });
const RECYCLING_OPTS = [
  { text: { type: 'plain_text', text: '🔄 Same as Trash Day' }, value: 'same_as_trash' },
  ...DAYS.map(d => ({ text: { type: 'plain_text', text: `♻️ ${d}` }, value: d.toLowerCase() })),
  { text: { type: 'plain_text', text: '🚫 No Recycling Service' }, value: 'none' }
];

/* ──────────────────────────────────────────────────────────────────────────
   Views (existing flows)
────────────────────────────────────────────────────────────────────────── */
const serviceIssueModal = (originChannel) => ({
  type: 'modal',
  callback_id: 'fido_issue_modal',
  private_metadata: originChannel,
  title: { type: 'plain_text', text: 'Report Service Issue' },
  submit: { type: 'plain_text', text: 'Create Ticket' },
  close: { type: 'plain_text', text: 'Cancel' },
  blocks: [
    { type: 'input', block_id: 'property_block',
      label: { type: 'plain_text', text: '🏠 Property Address' },
      element: { type: 'plain_text_input', action_id: 'property_input', min_length: 10, max_length: 200,
        placeholder: { type: 'plain_text', text: 'e.g., 1903 Albury Cove Unit D, Austin TX 78704' } } },
    { type: 'input', block_id: 'client_block',
      label: { type: 'plain_text', text: '👤 Client/Property Manager' },
      element: { type: 'plain_text_input', action_id: 'client_input', min_length: 2, max_length: 100,
        placeholder: { type: 'plain_text', text: 'e.g., Vacasa, Nomad STR, RedAwning' } } },
    { type: 'input', block_id: 'market_block',
      label: { type: 'plain_text', text: '📍 Service Market' },
      element: { type: 'static_select', action_id: 'market_select', placeholder: { type: 'plain_text', text: 'Select service market' }, options: MARKET_OPTIONS } },
    { type: 'input', block_id: 'issue_type_block',
      label: { type: 'plain_text', text: '🏷️ Issue Type' },
      element: { type: 'static_select', action_id: 'issue_type_select', options: [
        { text: { type: 'plain_text', text: '🗑️ Bin Placement Issue' }, value: 'bin_placement' },
        { text: { type: 'plain_text', text: '🚪 Property Access Problem' }, value: 'access_problem' },
        { text: { type: 'plain_text', text: '📅 Schedule Conflict' }, value: 'schedule_conflict' },
        { text: { type: 'plain_text', text: '🏠 Property Logistics Issue' }, value: 'property_logistics' },
        { text: { type: 'plain_text', text: '⚠️ Service Quality Issue' }, value: 'service_quality' },
        { text: { type: 'plain_text', text: '💬 Customer Complaint' }, value: 'customer_complaint' },
        { text: { type: 'plain_text', text: '🔧 Equipment Issue' }, value: 'equipment_issue' },
        { text: { type: 'plain_text', text: '❓ Other Issue' }, value: 'other' }
      ] } },
    { type: 'input', block_id: 'priority_block',
      label: { type: 'plain_text', text: '⚡ Priority Level' },
      element: { type: 'static_select', action_id: 'priority_select', options: [
        { text: { type: 'plain_text', text: '🔴 URGENT - Immediate Action Required' }, value: 'urgent' },
        { text: { type: 'plain_text', text: '🟠 HIGH - Same Day Resolution' }, value: 'high' },
        { text: { type: 'plain_text', text: '🟡 NORMAL - Next Business Day' }, value: 'normal' },
        { text: { type: 'plain_text', text: '🟢 LOW - When Available' }, value: 'low' }
      ] } },
    { type: 'input', block_id: 'description_block',
      label: { type: 'plain_text', text: '📝 Issue Description' },
      element: { type: 'plain_text_input', action_id: 'description_input', multiline: true, min_length: 20, max_length: 1000,
        placeholder: { type: 'plain_text', text: 'What happened? Where? Impact? Any special circumstances?' } } },
    { type: 'input', block_id: 'source_block',
      label: { type: 'plain_text', text: '📞 How was this reported?' },
      element: { type: 'static_select', action_id: 'source_select', options: [
        { text: { type: 'plain_text', text: '📱 OpenPhone Text Message' }, value: 'openphone_text' },
        { text: { type: 'plain_text', text: '☎️ Phone Call' }, value: 'phone_call' },
        { text: { type: 'plain_text', text: '📧 Email' }, value: 'email' },
        { text: { type: 'plain_text', text: '💬 Slack Message' }, value: 'slack_message' },
        { text: { type: 'plain_text', text: '🌐 Website Contact Form' }, value: 'website_form' },
        { text: { type: 'plain_text', text: '👥 In-Person Report' }, value: 'in_person' },
        { text: { type: 'plain_text', text: '🔧 Internal Discovery' }, value: 'internal' }
      ] } },
    { type: 'input', block_id: 'source_details_block', optional: true,
      label: { type: 'plain_text', text: '🔗 Source Reference (Optional)' },
      element: { type: 'plain_text_input', action_id: 'source_details_input', max_length: 200,
        placeholder: { type: 'plain_text', text: 'e.g., TextRec09AJ1PS4PR, support@email.com, @username' } } },
  ]
});

const customerInquiryModal = (originChannel) => ({
  type: 'modal',
  callback_id: 'fido_inquiry_modal',
  private_metadata: originChannel,
  title: { type: 'plain_text', text: 'Customer Inquiry' },
  submit: { type: 'plain_text', text: 'Create Inquiry' },
  close: { type: 'plain_text', text: 'Cancel' },
  blocks: [
    { type: 'input', block_id: 'property_block',
      label: { type: 'plain_text', text: '🏠 Property Address' },
      element: { type: 'plain_text_input', action_id: 'property_input', min_length: 10, max_length: 200,
        placeholder: { type: 'plain_text', text: 'e.g., 2608 North 80th Place' } } },
    { type: 'input', block_id: 'client_block',
      label: { type: 'plain_text', text: '👤 Client/Property Manager' },
      element: { type: 'plain_text_input', action_id: 'client_input', min_length: 2, max_length: 100,
        placeholder: { type: 'plain_text', text: 'Property Manager or Client Name' } } },
    { type: 'input', block_id: 'market_block',
      label: { type: 'plain_text', text: '📍 Service Market' },
      element: { type: 'static_select', action_id: 'market_select', placeholder: { type: 'plain_text', text: 'Select service market' }, options: MARKET_OPTIONS } },
    { type: 'input', block_id: 'inquiry_type_block',
      label: { type: 'plain_text', text: '❓ Inquiry Type' },
      element: { type: 'static_select', action_id: 'inquiry_type_select', options: [
        { text: { type: 'plain_text', text: '📅 Schedule Question' }, value: 'schedule_question' },
        { text: { type: 'plain_text', text: '🔄 Service Status Check' }, value: 'service_status' },
        { text: { type: 'plain_text', text: '💰 Billing Question' }, value: 'billing_question' },
        { text: { type: 'plain_text', text: '📋 Service Details' }, value: 'service_details' },
        { text: { type: 'plain_text', text: '🆕 New Service Interest' }, value: 'new_service' },
        { text: { type: 'plain_text', text: '⏸️ Pause/Resume Service' }, value: 'pause_resume' },
        { text: { type: 'plain_text', text: '🏠 Property Information Update' }, value: 'property_update' },
        { text: { type: 'plain_text', text: '📞 General Information' }, value: 'general_info' },
        { text: { type: 'plain_text', text: '❓ Other Question' }, value: 'other' }
      ] } },
    { type: 'input', block_id: 'priority_block',
      label: { type: 'plain_text', text: '⚡ Response Priority' },
      element: { type: 'static_select', action_id: 'priority_select', options: [
        { text: { type: 'plain_text', text: '🔴 Customer Waiting' }, value: 'urgent' },
        { text: { type: 'plain_text', text: '🟠 Same Day' }, value: 'high' },
        { text: { type: 'plain_text', text: '🟡 Next Business Day' }, value: 'normal' },
        { text: { type: 'plain_text', text: '🟢 When Available' }, value: 'low' }
      ] } },
    { type: 'input', block_id: 'inquiry_details_block',
      label: { type: 'plain_text', text: '💬 Customer Question/Inquiry' },
      element: { type: 'plain_text_input', action_id: 'inquiry_details_input', multiline: true, min_length: 10, max_length: 1000,
        placeholder: { type: 'plain_text', text: 'What is the customer asking about? Context?' } } },
    { type: 'input', block_id: 'source_block',
      label: { type: 'plain_text', text: '📞 Contact Method' },
      element: { type: 'static_select', action_id: 'source_select', options: [
        { text: { type: 'plain_text', text: '📱 OpenPhone Text Message' }, value: 'openphone_text' },
        { text: { type: 'plain_text', text: '☎️ Phone Call' }, value: 'phone_call' },
        { text: { type: 'plain_text', text: '📧 Email' }, value: 'email' },
        { text: { type: 'plain_text', text: '💬 Slack Message' }, value: 'slack_message' },
        { text: { type: 'plain_text', text: '🌐 Website Contact Form' }, value: 'website_form' },
        { text: { type: 'plain_text', text: '👥 In-Person Report' }, value: 'in_person' },
        { text: { type: 'plain_text', text: '🔧 Internal Discovery' }, value: 'internal' }
      ] } },
    { type: 'input', block_id: 'source_details_block', optional: true,
      label: { type: 'plain_text', text: '🔗 Contact Reference (Optional)' },
      element: { type: 'plain_text_input', action_id: 'source_details_input', max_length: 200,
        placeholder: { type: 'plain_text', text: 'e.g., TextRec09AJ1PS4PR, support@email.com' } } },
  ]
});

const unitManagementModal = (originChannel) => ({
  type: 'modal',
  callback_id: 'fido_unit_change_modal',
  private_metadata: originChannel,
  title: { type: 'plain_text', text: 'Unit Management' },
  submit: { type: 'plain_text', text: 'Submit Request' },
  close: { type: 'plain_text', text: 'Cancel' },
  blocks: [
    { type: 'input', block_id: 'change_type_block',
      label: { type: 'plain_text', text: '🔧 Change Type' },
      element: { type: 'static_select', action_id: 'change_type_select', options: [
        { text: { type: 'plain_text', text: '🆕 NEW UNIT - Add to Service' }, value: 'new_unit' },
        { text: { type: 'plain_text', text: '❌ CANCELLATION - Remove from Service' }, value: 'cancellation' },
        { text: { type: 'plain_text', text: '⏸️ PAUSE SERVICE - Temporary Stop' }, value: 'pause' },
        { text: { type: 'plain_text', text: '▶️ RESTART SERVICE - Resume Service' }, value: 'restart' },
        { text: { type: 'plain_text', text: '🔄 MODIFY SERVICE - Change Details' }, value: 'modify' }
      ] } },
    { type: 'input', block_id: 'property_block',
      label: { type: 'plain_text', text: '🏠 Property Address' },
      element: { type: 'plain_text_input', action_id: 'property_input', min_length: 15, max_length: 300,
        placeholder: { type: 'plain_text', text: 'e.g., 4487 Central Avenue, San Diego CA 92116' } } },
    { type: 'input', block_id: 'client_block',
      label: { type: 'plain_text', text: '🏢 Client/Property Management Company' },
      element: { type: 'plain_text_input', action_id: 'client_input', min_length: 2, max_length: 150,
        placeholder: { type: 'plain_text', text: 'e.g., Embo Rentals, The Boroughs' } } },
    { type: 'input', block_id: 'market_block',
      label: { type: 'plain_text', text: '📍 Service Market' },
      element: { type: 'static_select', action_id: 'market_select', placeholder: { type: 'plain_text', text: 'Select service market' }, options: MARKET_OPTIONS } },
    { type: 'input', block_id: 'trash_day_block', optional: true,
      label: { type: 'plain_text', text: '🗑️ Trash Pickup Day' },
      element: { type: 'static_select', action_id: 'trash_day_select', options: DAYS.map(DAY_OPTS) } },
    { type: 'input', block_id: 'recycling_day_block', optional: true,
      label: { type: 'plain_text', text: '♻️ Recycling Pickup Day (Optional)' },
      element: { type: 'static_select', action_id: 'recycling_day_select', options: RECYCLING_OPTS } },
    { type: 'input', block_id: 'effective_date_block',
      label: { type: 'plain_text', text: '📅 Effective Date' },
      element: { type: 'datepicker', action_id: 'effective_date_picker',
        placeholder: { type: 'plain_text', text: 'When should this change take effect?' } } },
    { type: 'input', block_id: 'reason_block',
      label: { type: 'plain_text', text: '📋 Reason for Change' },
      element: { type: 'plain_text_input', action_id: 'reason_input', multiline: true, min_length: 10, max_length: 500 } },
    { type: 'input', block_id: 'instructions_block', optional: true,
      label: { type: 'plain_text', text: '📝 Special Instructions (Optional)' },
      element: { type: 'plain_text_input', action_id: 'instructions_input', multiline: true, max_length: 750 } },
  ]
});

/* ──────────────────────────────────────────────────────────────────────────
   NEW: Ops → CX modal (namespaced to avoid collisions)
────────────────────────────────────────────────────────────────────────── */
const opsTicketModal = (originChannel) => ({
  type: 'modal',
  callback_id: 'fido_ops_ticket_modal',
  private_metadata: originChannel,
  title: { type: 'plain_text', text: 'Ops Tickets' }, // keep display name
  submit: { type: 'plain_text', text: 'Submit' },
  close:  { type: 'plain_text', text: 'Cancel' },
  blocks: [
    {
      type: 'input',
      block_id: 'subject_block',
      label: { type: 'plain_text', text: 'Subject' },
      element: {
        type: 'plain_text_input',
        action_id: 'subject_input',
        min_length: 10,
        max_length: 120,
        placeholder: { type: 'plain_text', text: 'Brief, customer-facing subject' }
      }
    },
    {
      type: 'input',
      block_id: 'property_block',
      label: { type: 'plain_text', text: 'Property / Location' },
      element: {
        type: 'plain_text_input',
        action_id: 'property_input',
        placeholder: { type: 'plain_text', text: 'Address, unit, or location hint' }
      }
    },
    {
      type: 'input',
      block_id: 'issue_type_block',
      label: { type: 'plain_text', text: 'Issue Type' },
      element: {
        type: 'static_select',
        action_id: 'ops_issue_type_select', // namespaced
        placeholder: { type: 'plain_text', text: 'Select issue type' },
        options: [
          { text: { type: 'plain_text', text: 'Unable to Access' }, value: 'unable_access' },
          { text: { type: 'plain_text', text: 'Incorrect Bins / Location' }, value: 'bin_location' },
          { text: { type: 'plain_text', text: 'Gate/Code/Key Problem' }, value: 'access_code' },
          { text: { type: 'plain_text', text: 'Blocked / Obstruction' }, value: 'blocked' },
          { text: { type: 'plain_text', text: 'Safety / Incident' }, value: 'safety' },
          { text: { type: 'plain_text', text: 'Customer Instruction Conflict' }, value: 'instruction_conflict' },
          { text: { type: 'plain_text', text: 'Miscellaneous' }, value: 'misc' }
        ]
      }
    },
    {
      type: 'input',
      block_id: 'priority_block',
      label: { type: 'plain_text', text: 'Priority' },
      element: {
        type: 'static_select',
        action_id: 'priority_select',
        options: [
          { text: { type: 'plain_text', text: '🔴 Urgent' }, value: 'urgent' },
          { text: { type: 'plain_text', text: '🟠 High' }, value: 'high' },
          { text: { type: 'plain_text', text: '🟡 Medium' }, value: 'normal' },
          { text: { type: 'plain_text', text: '🟢 Low' }, value: 'low' }
        ],
        initial_option: { text: { type: 'plain_text', text: '🟡 Medium' }, value: 'normal' }
      }
    },
    {
      type: 'input',
      block_id: 'market_block',
      label: { type: 'plain_text', text: 'Market' },
      element: {
        type: 'static_select',
        action_id: 'market_select',
        options: MARKET_OPTIONS
      }
    },
    {
      type: 'input',
      block_id: 'description_block',
      label: { type: 'plain_text', text: 'What happened?' },
      element: {
        type: 'plain_text_input',
        action_id: 'description_input',
        multiline: true,
        min_length: 20,
        placeholder: { type: 'plain_text', text: 'Customer-facing description; include enough detail to act' }
      }
    },
    {
      type: 'input',
      block_id: 'external_link_block',
      optional: true,
      label: { type: 'plain_text', text: 'BARK Link (optional)' },
      element: {
        type: 'plain_text_input', // validate on submit
        action_id: 'external_link_input',
        placeholder: { type: 'plain_text', text: 'https://bark.fido.com/...' }
      }
    },
    {
      type: 'input',
      block_id: 'photo_upload_block',
      optional: true,
      label: { type: 'plain_text', text: 'Photos (optional, max 5)' },
      element: {
        type: 'file_input',
        action_id: 'photo_upload_input',
        max_files: 5,
        filetypes: ['jpg', 'jpeg', 'png', 'gif', 'heic']
      }
    },
    {
      type: 'input',
      block_id: 'notes_block',
      optional: true,
      label: { type: 'plain_text', text: 'Internal Notes (optional)' },
      element: {
        type: 'plain_text_input',
        action_id: 'notes_input',
        multiline: true
      }
    }
  ]
});

/* ──────────────────────────────────────────────────────────────────────────
   Commands (ack immediately) — existing + new Ops → CX
────────────────────────────────────────────────────────────────────────── */
app.command('/fido-test', async ({ ack, respond, body, logger }) => {
  await ack();
  logger.info(`/fido-test from user ${body.user_id}`);
  await respond('🎉 Fido Ticketing System is working! Ready to create tickets.');
});

app.command('/fido-issue', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    await client.views.open({ trigger_id: body.trigger_id, view: serviceIssueModal(body.channel_id) });
  } catch (err) {
    logger.error('open issue modal failed', err);
    await client.chat.postEphemeral({ channel: body.channel_id, user: body.user_id, text: '❌ Error opening the service issue form.' });
  }
});

app.command('/fido-inquiry', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    await client.views.open({ trigger_id: body.trigger_id, view: customerInquiryModal(body.channel_id) });
  } catch (err) {
    logger.error('open inquiry modal failed', err);
    await client.chat.postEphemeral({ channel: body.channel_id, user: body.user_id, text: '❌ Error opening the customer inquiry form.' });
  }
});

app.command('/fido-unit-change', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    await client.views.open({ trigger_id: body.trigger_id, view: unitManagementModal(body.channel_id) });
  } catch (err) {
    logger.error('open unit modal failed', err);
    await client.chat.postEphemeral({ channel: body.channel_id, user: body.user_id, text: '❌ Error opening the unit management form.' });
  }
});

// NEW: /fido-ops-ticket
app.command('/fido-ops-ticket', async ({ ack, body, client, logger }) => {
  await ack(); // prevent 3s timeout
  try {
    await client.views.open({ trigger_id: body.trigger_id, view: opsTicketModal(body.channel_id) });
  } catch (err) {
    logger.error('open ops modal failed', err);
    await client.chat.postEphemeral({ channel: body.channel_id, user: body.user_id, text: '❌ Error opening the Ops → CX form.' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   Actions — namespaced cascading for Ops → CX (no collisions)
────────────────────────────────────────────────────────────────────────── */
app.action('ops_issue_type_select', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    if (body.view?.callback_id !== 'fido_ops_ticket_modal') return;

    const selected = body.actions[0].selected_option.value;
    const current = [...body.view.blocks];

    // Remove previously injected conditional blocks
    const filtered = current.filter(b => !['ops_sub_issue_block', 'ops_misc_specify_block'].includes(b.block_id));

    const anchorIdx = filtered.findIndex(b => b.block_id === 'issue_type_block');

    if (selected === 'unable_access') {
      const sub = {
        type: 'input',
        block_id: 'ops_sub_issue_block',
        label: { type: 'plain_text', text: 'Access Issue Type' },
        element: {
          type: 'static_select',
          action_id: 'ops_sub_issue_select',
          options: [
            { text: { type: 'plain_text', text: 'Bad Gate/Garage Code' }, value: 'bad_code' },
            { text: { type: 'plain_text', text: 'No Code Provided' }, value: 'no_code' },
            { text: { type: 'plain_text', text: 'Lock Requires Key' }, value: 'requires_key' },
            { text: { type: 'plain_text', text: 'Vehicle Blocking Path' }, value: 'vehicle_blocking' },
            { text: { type: 'plain_text', text: 'City Works Blocking Entry' }, value: 'city_works' }
          ]
        }
      };
      filtered.splice(anchorIdx + 1, 0, sub);
    } else if (selected === 'misc') {
      const misc = {
        type: 'input',
        block_id: 'ops_misc_specify_block',
        label: { type: 'plain_text', text: 'Specify Issue' },
        element: {
          type: 'plain_text_input',
          action_id: 'ops_misc_specify_input',
          placeholder: { type: 'plain_text', text: 'Briefly describe the issue type' }
        }
      };
      filtered.splice(anchorIdx + 1, 0, misc);
    }

    await client.views.update({
      view_id: body.view.id,
      view: { ...body.view, blocks: filtered }
    });
  } catch (err) {
    logger.error('Ops modal cascade error', err);
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   View submissions (existing) + NEW Ops → CX submission
────────────────────────────────────────────────────────────────────────── */
app.view('fido_issue_modal', async ({ ack, body, view, client, logger }) => {
  const originChannel = view.private_metadata;
  const v = view.state.values;
  const description = v.description_block.description_input.value || '';
  if (description.length < 20) {
    await ack({ response_action: 'errors', errors: { description_block: 'Please provide at least 20 characters.' } });
    return;
  }
  await ack();

  const ticketId = generateTicketId('issue');
  const dateStr = new Date().toISOString().split('T')[0];
  const property = v.property_block.property_input.value;
  const clientName = v.client_block.client_input.value;
  const marketVal = v.market_block.market_select.selected_option.value;
  const marketDisp = marketVal.toUpperCase();
  const issueType = v.issue_type_block.issue_type_select.selected_option.text.text;
  const priorityVal = v.priority_block.priority_select.selected_option.value;
  const priorityText = v.priority_block.priority_select.selected_option.text.text;
  const methodVal = v.source_block.source_select.selected_option.value;
  const methodText = v.source_block.source_select.selected_option.text.text;
  const contactRef = v.source_details_block?.source_details_input?.value || '';

  try {
    const blocks = [
      { type: 'section', text: { type: 'mrkdwn',
        text: `*ATTN:* <!subteam^${SUBTEAMS.BP_OPERATIONS}|@bp-operations> Service issue reported — please respond *in this thread*.` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Report Date:*\n${dateStr}` },
        { type: 'mrkdwn', text: `*Ticket ID:*\n${ticketId}` },
        { type: 'mrkdwn', text: `*Property:*\n${property}` },
        { type: 'mrkdwn', text: `*Client:*\n${clientName}` },
        { type: 'mrkdwn', text: `*Market:*\n${marketDisp}` },
        { type: 'mrkdwn', text: `*Issue Type:*\n${issueType}` },
        { type: 'mrkdwn', text: `*Priority:*\n${priorityText}` },
        { type: 'mrkdwn', text: `*Reported Via:*\n${methodText}${contactRef ? ` (${contactRef})` : ''}` }
      ]},
      { type: 'section', text: { type: 'mrkdwn', text: `*Issue Description:*\n${description}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Created by: <@${body.user.id}> | Fido Ticketing System_` }] }
    ];

    const post = await client.chat.postMessage({ channel: CHANNELS.FIDO_CX, text: `Service issue ${ticketId}`, blocks });
    const { permalink } = await client.chat.getPermalink({ channel: post.channel, message_ts: post.ts });

    const click = await clickupService.createTask('issue', {
      ticketId, property, clientName, market: marketVal, issueType,
      priority: priorityVal, description, source: methodVal, sourceDetails: contactRef, dateStr
    }, permalink, body.user.id);

    if (click.success) {
      await client.chat.postMessage({ channel: post.channel, thread_ts: post.ts, text: `🔗 *ClickUp Task:* <${click.taskUrl}|${click.taskName}>` });
    } else {
      logger.warn(`ClickUp createTask failed: ${click.error}`);
      if (click.debug && process.env.DEBUG_CLICKUP === 'true') {
        logger.error('[ClickUp Debug] Full error details:', JSON.stringify(click.debug, null, 2));
      }
      await client.chat.postMessage({ channel: post.channel, thread_ts: post.ts, text: `⚠️ ClickUp task creation failed. Create manually if needed.` });
    }

    await client.chat.postEphemeral({
      channel: originChannel, user: body.user.id,
      text: `✅ Service issue *${ticketId}* created — <${permalink}|View in #fido-cx>${click.success ? ` | <${click.taskUrl}|ClickUp Task>` : ''}`
    });
  } catch (err) {
    logger.error('Service issue ticket error', err);
    await client.chat.postEphemeral({ channel: originChannel, user: body.user.id, text: `❌ ${err.message}` });
  }
});

app.view('fido_inquiry_modal', async ({ ack, body, view, client, logger }) => {
  const originChannel = view.private_metadata;
  const v = view.state.values;
  const details = v.inquiry_details_block.inquiry_details_input.value || '';
  if (details.length < 10) {
    await ack({ response_action: 'errors', errors: { inquiry_details_block: 'Please provide at least 10 characters.' } });
    return;
  }
  await ack();

  const ticketId = generateTicketId('inquiry');
  const dateStr = new Date().toISOString().split('T')[0];
  const property = v.property_block.property_input.value;
  const clientName = v.client_block.client_input.value;
  const marketVal = v.market_block.market_select.selected_option.value;
  const marketDisp = marketVal.toUpperCase();
  const inquiryType = v.inquiry_type_block.inquiry_type_select.selected_option.text.text;
  const priorityVal = v.priority_block.priority_select.selected_option.value;
  const priorityText = v.priority_block.priority_select.selected_option.text.text;
  const methodVal = v.source_block.source_select.selected_option.value;
  const methodText = v.source_block.source_select.selected_option.text.text;
  const contactRef = v.source_details_block?.source_details_input?.value || '';

  try {
    const blocks = [
      { type: 'section', text: { type: 'mrkdwn',
        text: `*ATTN:* <!subteam^${SUBTEAMS.CX}|@cx> Customer inquiry received — please respond *in this thread*.` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Inquiry Date:*\n${dateStr}` },
        { type: 'mrkdwn', text: `*Ticket ID:*\n${ticketId}` },
        { type: 'mrkdwn', text: `*Property:*\n${property}` },
        { type: 'mrkdwn', text: `*Client:*\n${clientName}` },
        { type: 'mrkdwn', text: `*Market:*\n${marketDisp}` },
        { type: 'mrkdwn', text: `*Inquiry Type:*\n${inquiryType}` },
        { type: 'mrkdwn', text: `*Priority:*\n${priorityText}` },
        { type: 'mrkdwn', text: `*Contact Method:*\n${methodText}${contactRef ? ` (${contactRef})` : ''}` }
      ]},
      { type: 'section', text: { type: 'mrkdwn', text: `*Customer Question:*\n${details}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Created by: <@${body.user.id}> | Fido Ticketing System_` }] }
    ];

    const post = await client.chat.postMessage({ channel: CHANNELS.FIDO_CX, text: `Customer inquiry ${ticketId}`, blocks });
    const { permalink } = await client.chat.getPermalink({ channel: post.channel, message_ts: post.ts });

    const click = await clickupService.createTask('inquiry', {
      ticketId, property, clientName, market: marketVal, inquiryType, priority: priorityVal,
      details, source: methodVal, sourceDetails: contactRef, dateStr
    }, permalink, body.user.id);

    if (click.success) {
      await client.chat.postMessage({ channel: post.channel, thread_ts: post.ts, text: `🔗 *ClickUp Task:* <${click.taskUrl}|${click.taskName}>` });
    } else {
      logger.warn(`ClickUp createTask failed: ${click.error}`);
      if (click.debug && process.env.DEBUG_CLICKUP === 'true') {
        logger.error('[ClickUp Debug] Full error details:', JSON.stringify(click.debug, null, 2));
      }
      await client.chat.postMessage({ channel: post.channel, thread_ts: post.ts, text: `⚠️ ClickUp task creation failed. Create manually if needed.` });
    }

    await client.chat.postEphemeral({
      channel: originChannel, user: body.user.id,
      text: `✅ Customer inquiry *${ticketId}* created — <${permalink}|View in #fido-cx>${click.success ? ` | <${click.taskUrl}|ClickUp Task>` : ''}`
    });
  } catch (err) {
    logger.error('Inquiry ticket error', err);
    await client.chat.postEphemeral({ channel: originChannel, user: body.user.id, text: `❌ ${err.message}` });
  }
});

app.view('fido_unit_change_modal', async ({ ack, body, view, client, logger }) => {
  const originChannel = view.private_metadata;
  const v = view.state.values;
  const changeVal = v.change_type_block.change_type_select.selected_option.value;
  const trashVal = v.trash_day_block?.trash_day_select?.selected_option?.value;
  const details = v.reason_block.reason_input.value || '';
  if (changeVal === 'new_unit' && !trashVal) {
    await ack({ response_action: 'errors', errors: { trash_day_block: 'Trash pickup day is required for NEW UNIT.' } });
    return;
  }
  if (details.length < 10) {
    await ack({ response_action: 'errors', errors: { reason_block: 'Please provide at least 10 characters.' } });
    return;
  }
  await ack();

  const ticketId = generateTicketId('unit');
  const dateStr = new Date().toISOString().split('T')[0];
  const property = v.property_block.property_input.value;
  const clientName = v.client_block.client_input.value;
  const marketVal = v.market_block.market_select.selected_option.value;
  const marketDisp = marketVal.toUpperCase();
  const changeTypeText = v.change_type_block.change_type_select.selected_option.text.text;
  const trashDayText = trashVal ? v.trash_day_block.trash_day_select.selected_option.text.text : 'N/A';
  const recyclingVal = v.recycling_day_block?.recycling_day_select?.selected_option?.value;
  const recyclingText = v.recycling_day_block?.recycling_day_select?.selected_option?.text?.text || 'N/A';
  const effectiveDate = v.effective_date_block.effective_date_picker.selected_date;
  const reason = v.reason_block.reason_input.value;
  const instructions = v.instructions_block?.instructions_input?.value || 'None specified';

  try {
    const blocks = [
      { type: 'section', text: { type: 'mrkdwn',
        text: `*ATTN:* <!subteam^${SUBTEAMS.BPO_MGMT}|@bpo-mgmt> Unit management request — please process *in this thread*.` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Request Date:*\n${dateStr}` },
        { type: 'mrkdwn', text: `*Ticket ID:*\n${ticketId}` },
        { type: 'mrkdwn', text: `*Change Type:*\n${changeTypeText}` },
        { type: 'mrkdwn', text: `*Property:*\n${property}` },
        { type: 'mrkdwn', text: `*Client:*\n${clientName}` },
        { type: 'mrkdwn', text: `*Market:*\n${marketDisp}` },
        { type: 'mrkdwn', text: `*Effective Date:*\n${effectiveDate}` },
        { type: 'mrkdwn', text: `*Trash Day:*\n${trashDayText}` }
      ]},
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Recycling Day:*\n${recyclingText}` },
        { type: 'mrkdwn', text: `*Reason:*\n${reason}` }
      ]},
      { type: 'section', text: { type: 'mrkdwn', text: `*Special Instructions:*\n${instructions}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Created by: <@${body.user.id}> | Fido Ticketing System_` }] }
    ];

    const post = await client.chat.postMessage({ channel: CHANNELS.CX_UNIT_CHANGES, text: `Unit management ${ticketId}`, blocks });
    const { permalink } = await client.chat.getPermalink({ channel: post.channel, message_ts: post.ts });

    const click = await clickupService.createTask('unit', {
      ticketId, property, clientName, market: marketVal, changeType: changeVal,
      trashDay: trashVal, recyclingDay: recyclingVal, effectiveDate, reason, instructions, dateStr
    }, permalink, body.user.id);

    if (click.success) {
      await client.chat.postMessage({ channel: post.channel, thread_ts: post.ts, text: `🔗 *ClickUp Task:* <${click.taskUrl}|${click.taskName}>` });
    } else {
      logger.warn(`ClickUp createTask failed: ${click.error}`);
      if (click.debug && process.env.DEBUG_CLICKUP === 'true') {
        logger.error('[ClickUp Debug] Full error details:', JSON.stringify(click.debug, null, 2));
      }
      await client.chat.postMessage({ channel: post.channel, thread_ts: post.ts, text: `⚠️ ClickUp task creation failed. Create manually if needed.` });
    }

    await client.chat.postEphemeral({
      channel: originChannel, user: body.user.id,
      text: `✅ Unit management *${ticketId}* created — <${permalink}|View in #cx-unit-changes>${click.success ? ` | <${click.taskUrl}|ClickUp Task>` : ''}`
    });
  } catch (err) {
    logger.error('Unit change ticket error', err);
    await client.chat.postEphemeral({ channel: originChannel, user: body.user.id, text: `❌ ${err.message}` });
  }
});

// NEW: Ops → CX submission (posts to CX, creates ClickUp, confirms)
app.view('fido_ops_ticket_modal', async ({ ack, body, view, client, logger }) => {
  const originChannel = view.private_metadata;
  const v = view.state.values;

  // URL validation (Slack has no URL input type)
  const urlCandidate = v.external_link_block?.external_link_input?.value?.trim();
  if (urlCandidate) {
    try { new URL(urlCandidate); } catch {
      await ack({ response_action: 'errors', errors: { external_link_block: 'Please enter a valid URL (e.g., https://example.com).' } });
      return;
    }
  }

  // Validate description length
  const description = v.description_block.description_input.value || '';
  if (description.length < 20) {
    await ack({ response_action: 'errors', errors: { description_block: 'Please provide at least 20 characters.' } });
    return;
  }

  await ack(); // prevent 3s timeout

  const ticketId = generateTicketId('ops');
  const dateStr = new Date().toISOString().split('T')[0];

  const subject       = v.subject_block.subject_input.value.trim();
  const property      = v.property_block.property_input.value.trim();
  const issueTypeSel  = v.issue_type_block.ops_issue_type_select.selected_option;
  const issueTypeText = issueTypeSel.text.text;
  const issueTypeVal  = issueTypeSel.value;

  const priorityText  = v.priority_block.priority_select.selected_option.text.text;
  const marketVal     = v.market_block.market_select.selected_option.value;
  const marketDisp    = marketVal.toUpperCase();

  const externalLink  = urlCandidate || null;
  const notes         = v.notes_block?.notes_input?.value?.trim() || null;

  // Photo uploads (if any)
  const photoFiles = v.photo_upload_block?.photo_upload_input?.files || [];
  let photoUrls = [];
  if (photoFiles.length > 0) {
    try {
      // Get file info from Slack (files are already uploaded when modal submitted)
      for (const file of photoFiles) {
        const fileInfo = await client.files.info({ file: file.id });
        if (fileInfo.ok && fileInfo.file?.url_private) {
          photoUrls.push(fileInfo.file.url_private);
        }
      }
    } catch (err) {
      logger.warn('Photo upload processing failed:', err);
    }
  }

  // Optional sub-issue if shown
  let subIssueText = null;
  if (issueTypeVal === 'unable_access' && v.ops_sub_issue_block?.ops_sub_issue_select?.selected_option) {
    subIssueText = v.ops_sub_issue_block.ops_sub_issue_select.selected_option.text.text;
  }
  if (issueTypeVal === 'misc' && v.ops_misc_specify_block?.ops_misc_specify_input?.value) {
    subIssueText = v.ops_misc_specify_block.ops_misc_specify_input.value.trim();
  }
  const fullIssueType = subIssueText ? `${issueTypeText} → ${subIssueText}` : issueTypeText;

  try {
    // Slack post to CX channel
    const headerText = SUBTEAMS.CX
      ? `*ATTN:* <!subteam^${SUBTEAMS.CX}|@cx> — New *Ops → CX* Ticket. Please respond *in this thread*.`
      : `New *Ops → CX* Ticket. Please respond *in this thread*.`;

    const blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: headerText } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Subject:*\n${subject}` },
        { type: 'mrkdwn', text: `*Ticket ID:*\n${ticketId}` },
        { type: 'mrkdwn', text: `*Property/Location:*\n${property}` },
        { type: 'mrkdwn', text: `*Market:*\n${marketDisp}` },
        { type: 'mrkdwn', text: `*Issue Type:*\n${fullIssueType}` },
        { type: 'mrkdwn', text: `*Priority:*\n${priorityText}` }
      ]},
      { type: 'section', text: { type: 'mrkdwn', text: `*Description:*\n${description}` } },
      ...(externalLink ? [{ type: 'section', text: { type: 'mrkdwn', text: `*BARK Link:* <${externalLink}|View in BARK>` } }] : []),
      ...(photoUrls.length > 0 ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Photos:*\n${photoUrls.map((url, i) => `<${url}|Photo ${i+1}>`).join(' • ')}` } }] : []),
      ...(notes ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Internal Notes:*\n${notes}` } }] : []),
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Created by: <@${body.user.id}> | Fido Ticketing System_` }] }
    ];

    const post = await client.chat.postMessage({
      channel: CHANNELS.FIDO_CX,
      text: `Ops → CX ticket ${ticketId}`,
      blocks
    });

    const { permalink } = await client.chat.getPermalink({
      channel: post.channel, message_ts: post.ts
    });

    // ClickUp creation (Ops → CX list) — service must support the 'ops' type
    const click = await clickupService.createTask('ops', {
      ticketId,
      subject,
      property,
      market: marketVal,
      issueType: fullIssueType,
      priority: priorityText,
      description,
      externalLink,
      photoUrls,
      notes,
      dateStr
    }, permalink, body.user.id);

    if (click?.success) {
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: `🔗 *ClickUp Task:* <${click.taskUrl}|${click.taskName}>`
      });
    } else {
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: `⚠️ ClickUp task creation failed. Please create manually if needed.`
      });
    }

    // Ephemeral confirmation back to the origin channel
    await client.chat.postEphemeral({
      channel: originChannel,
      user: body.user.id,
      text: `✅ Ops → CX ticket *${ticketId}* created — <${permalink}|View your ticket>${click?.success ? ` | <${click.taskUrl}|ClickUp Task>` : ''}`
    });

  } catch (err) {
    logger.error('Ops → CX ticket creation failed', err);
    try {
      await client.chat.postEphemeral({
        channel: originChannel,
        user: body.user.id,
        text: '❌ Error creating Ops → CX ticket. Please try again or escalate.'
      });
    } catch (_) {}
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   Global error guards
────────────────────────────────────────────────────────────────────────── */
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

/* ──────────────────────────────────────────────────────────────────────────
   Start server
────────────────────────────────────────────────────────────────────────── */
(async () => {
  try {
    await app.start(PORT);
    console.log(`⚡️ Fido Ticketing Suite listening on ${PORT}`);
    console.log(`Health: http://0.0.0.0:${PORT}/health   Slack: /slack/commands /slack/events /slack/interactive`);
  } catch (err) {
    console.error('Error starting Bolt app', err);
    // keep process alive so health can still be checked if receiver bound; comment out if needed:
    // process.exit(1);
  }
})();
