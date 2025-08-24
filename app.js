// app.js
require('dotenv').config();
const { App } = require('@slack/bolt');

// --------------- Env Diagnostics (non-fatal) ---------------
const REQUIRED_FOR_SLACK = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'];
const missingSlack = REQUIRED_FOR_SLACK.filter(k => !process.env[k]);
if (missingSlack.length) {
  console.warn(`[BOOT] Missing Slack env vars: ${missingSlack.join(', ')} — app will still start health endpoints, but Slack features may fail.`);
}

// --------------- Safe ClickUp Loader (prevents boot crash) ---------------
function buildClickUpServiceSafe() {
  try {
    // If your ClickUp service needs these, check for them. Adjust names as needed.
    const requiredForClickUp = ['CLICKUP_API_TOKEN', 'CLICKUP_TEAM_ID'];
    const missing = requiredForClickUp.filter(k => !process.env[k]);
    if (missing.length) {
      console.warn(`[BOOT] ClickUp disabled — missing env vars: ${missing.join(', ')}`);
      return {
        isEnabled: false,
        async createTask() {
          return { success: false, error: 'ClickUp disabled (missing env vars)' };
        }
      };
    }

    const ClickUpService = require('./services/clickup');
    const instance = new ClickUpService();
    // Optional smoke check
    if (typeof instance.createTask !== 'function') {
      console.warn('[BOOT] ClickUp disabled — service missing createTask()');
      return {
        isEnabled: false,
        async createTask() {
          return { success: false, error: 'ClickUp disabled (invalid service)' };
        }
      };
    }
    console.log('[BOOT] ClickUp enabled.');
    return { isEnabled: true, createTask: instance.createTask.bind(instance) };
  } catch (err) {
    console.warn(`[BOOT] ClickUp disabled — constructor error: ${err.message}`);
    return {
      isEnabled: false,
      async createTask() {
        return { success: false, error: 'ClickUp disabled (constructor error)' };
      }
    };
  }
}

const clickupService = buildClickUpServiceSafe();

// --------------- App Init ---------------
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false // using HTTP receiver
  // Port is provided to app.start() below
});

// --------------- Health Endpoints (before app.start) ---------------
if (!app.receiver || !app.receiver.app) {
  // Extremely defensive: some Bolt versions/receivers could differ.
  // If this ever happens, early exit with a clear message.
  console.error('[BOOT] Bolt ExpressReceiver not available on app.receiver.app');
  process.exit(1);
}
const expressApp = app.receiver.app;

// Plain root
expressApp.get('/', (_req, res) => res.status(200).send('ok'));

// Common health probe paths
const healthPaths = ['/health', '/healthz', '/status', '/ready', '/live'];
healthPaths.forEach(p => {
  expressApp.get(p, (_req, res) => res.status(200).type('text/plain').send('ok'));
});
[...healthPaths, '/'].forEach(p => {
  expressApp.head(p, (_req, res) => res.sendStatus(200));
});

// --------------- Constants ---------------
const CHANNELS = {
  FIDO_CX: process.env.FIDO_CX_CHANNEL_ID || 'C07PN5F527N',
  CX_UNIT_CHANGES: process.env.CX_UNIT_CHANGES_CHANNEL_ID || 'C08M77HMRT9',
};

const SUBTEAMS = {
  BP_OPERATIONS: process.env.BP_OPERATIONS_SUBTEAM_ID || 'SXXXXBP',
  CX: process.env.CX_SUBTEAM_ID || 'SXXXXCX',
  BPO_MGMT: process.env.BPO_MGMT_SUBTEAM_ID || 'SXXXXBPO',
};

function generateTicketId(type) {
  const prefix = type === 'issue' ? 'FI' : type === 'inquiry' ? 'FQ' : 'FU';
  const ts = Date.now().toString().slice(-6);
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${ts}${rnd}`;
}

// --------------- Modal Schemas ---------------
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
});

// --------------- Service Issue Modal ---------------
const serviceIssueModal = (originChannel) => ({
  type: 'modal',
  callback_id: 'fido_issue_modal',
  private_metadata: originChannel,
  title: { type: 'plain_text', text: 'Report Service Issue' },
  submit: { type: 'plain_text', text: 'Create Ticket' },
  close: { type: 'plain_text', text: 'Cancel' },
  blocks: [
    {
      type: 'input', block_id: 'property_block',
      label: { type: 'plain_text', text: '🏠 Property Address' },
      element: {
        type: 'plain_text_input', action_id: 'property_input',
        min_length: 10, max_length: 200,
        placeholder: { type: 'plain_text', text: 'e.g., 1903 Albury Cove Unit D, Austin TX 78704' }
      }
    },
    {
      type: 'input', block_id: 'client_block',
      label: { type: 'plain_text', text: '👤 Client/Property Manager' },
      element: {
        type: 'plain_text_input', action_id: 'client_input',
        min_length: 2, max_length: 100,
        placeholder: { type: 'plain_text', text: 'e.g., Vacasa, Nomad STR, RedAwning' }
      }
    },
    {
      type: 'input', block_id: 'market_block',
      label: { type: 'plain_text', text: '📍 Service Market' },
      element: { type: 'static_select', action_id: 'market_select',
        placeholder: { type: 'plain_text', text: 'Select service market' },
        options: MARKET_OPTIONS
      }
    },
    {
      type: 'input', block_id: 'issue_type_block',
      label: { type: 'plain_text', text: '🏷️ Issue Type' },
      element: { type: 'static_select', action_id: 'issue_type_select',
        options: [
          { text: { type: 'plain_text', text: '🗑️ Bin Placement Issue' }, value: 'bin_placement' },
          { text: { type: 'plain_text', text: '🚪 Property Access Problem' }, value: 'access_problem' },
          { text: { type: 'plain_text', text: '📅 Schedule Conflict' }, value: 'schedule_conflict' },
          { text: { type: 'plain_text', text: '🏠 Property Logistics Issue' }, value: 'property_logistics' },
          { text: { type: 'plain_text', text: '⚠️ Service Quality Issue' }, value: 'service_quality' },
          { text: { type: 'plain_text', text: '💬 Customer Complaint' }, value: 'customer_complaint' },
          { text: { type: 'plain_text', text: '🔧 Equipment Issue' }, value: 'equipment_issue' },
          { text: { type: 'plain_text', text: '❓ Other Issue' }, value: 'other' }
        ]
      }
    },
    {
      type: 'input', block_id: 'priority_block',
      label: { type: 'plain_text', text: '⚡ Priority Level' },
      element: { type: 'static_select', action_id: 'priority_select',
        options: [
          { text: { type: 'plain_text', text: '🔴 URGENT - Immediate Action Required' }, value: 'urgent' },
          { text: { type: 'plain_text', text: '🟠 HIGH - Same Day Resolution' }, value: 'high' },
          { text: { type: 'plain_text', text: '🟡 NORMAL - Next Business Day' }, value: 'normal' },
          { text: { type: 'plain_text', text: '🟢 LOW - When Available' }, value: 'low' }
        ]
      }
    },
    {
      type: 'input', block_id: 'description_block',
      label: { type: 'plain_text', text: '📝 Issue Description' },
      element: {
        type: 'plain_text_input', action_id: 'description_input', multiline: true,
        min_length: 20, max_length: 1000,
        placeholder: { type: 'plain_text', text: 'What happened? Where? Impact? Any special circumstances?' }
      }
    },
    {
      type: 'input', block_id: 'source_block',
      label: { type: 'plain_text', text: '📞 How was this reported?' },
      element: { type: 'static_select', action_id: 'source_select',
        options: [
          { text: { type: 'plain_text', text: '📱 OpenPhone Text Message' }, value: 'openphone_text' },
          { text: { type: 'plain_text', text: '☎️ Phone Call' }, value: 'phone_call' },
          { text: { type: 'plain_text', text: '📧 Email' }, value: 'email' },
          { text: { type: 'plain_text', text: '💬 Slack Message' }, value: 'slack_message' },
          { text: { type: 'plain_text', text: '🌐 Website Contact Form' }, value: 'website_form' },
          { text: { type: 'plain_text', text: '👥 In-Person Report' }, value: 'in_person' },
          { text: { type: 'plain_text', text: '🔧 Internal Discovery' }, value: 'internal' }
        ]
      }
    },
    {
      type: 'input', block_id: 'source_details_block', optional: true,
      label: { type: 'plain_text', text: '🔗 Source Reference (Optional)' },
      element: {
        type: 'plain_text_input', action_id: 'source_details_input', max_length: 200,
        placeholder: { type: 'plain_text', text: 'e.g., TextRec09AJ1PS4PR, support@email.com, @username' }
      }
    }
  ]
});

// --------------- Customer Inquiry Modal ---------------
const customerInquiryModal = (originChannel) => ({
  type: 'modal',
  callback_id: 'fido_inquiry_modal',
  private_metadata: originChannel,
  title: { type: 'plain_text', text: 'Customer Inquiry' },
  submit: { type: 'plain_text', text: 'Create Inquiry' },
  close: { type: 'plain_text', text: 'Cancel' },
  blocks: [
    {
      type: 'input', block_id: 'property_block',
      label: { type: 'plain_text', text: '🏠 Property Address' },
      element: {
        type: 'plain_text_input', action_id: 'property_input',
        min_length: 10, max_length: 200,
        placeholder: { type: 'plain_text', text: 'e.g., 2608 North 80th Place' }
      }
    },
    {
      type: 'input', block_id: 'client_block',
      label: { type: 'plain_text', text: '👤 Client/Property Manager' },
      element: {
        type: 'plain_text_input', action_id: 'client_input',
        min_length: 2, max_length: 100,
        placeholder: { type: 'plain_text', text: 'Property Manager or Client Name' }
      }
    },
    {
      type: 'input', block_id: 'market_block',
      label: { type: 'plain_text', text: '📍 Service Market' },
      element: { type: 'static_select', action_id: 'market_select',
        placeholder: { type: 'plain_text', text: 'Select service market' },
        options: MARKET_OPTIONS
      }
    },
    {
      type: 'input', block_id: 'inquiry_type_block',
      label: { type: 'plain_text', text: '❓ Inquiry Type' },
      element: { type: 'static_select', action_id: 'inquiry_type_select',
        options: [
          { text: { type: 'plain_text', text: '📅 Schedule Question' }, value: 'schedule_question' },
          { text: { type: 'plain_text', text: '🔄 Service Status Check' }, value: 'service_status' },
          { text: { type: 'plain_text', text: '💰 Billing Question' }, value: 'billing_question' },
          { text: { type: 'plain_text', text: '📋 Service Details' }, value: 'service_details' },
          { text: { type: 'plain_text', text: '🆕 New Service Interest' }, value: 'new_service' },
          { text: { type: 'plain_text', text: '⏸️ Pause/Resume Service' }, value: 'pause_resume' },
          { text: { type: 'plain_text', text: '🏠 Property Information Update' }, value: 'property_update' },
          { text: { type: 'plain_text', text: '📞 General Information' }, value: 'general_info' },
          { text: { type: 'plain_text', text: '❓ Other Question' }, value: 'other' }
        ]
      }
    },
    {
      type: 'input', block_id: 'priority_block',
      label: { type: 'plain_text', text: '⚡ Response Priority' },
      element: { type: 'static_select', action_id: 'priority_select',
        options: [
          { text: { type: 'plain_text', text: '🔴 URGENT - Customer Waiting' }, value: 'urgent' },
          { text: { type: 'plain_text', text: '🟠 HIGH - Same Day Response' }, value: 'high' },
          { text: { type: 'plain_text', text: '🟡 NORMAL - Next Business Day' }, value: 'normal' },
          { text: { type: 'plain_text', text: '🟢 LOW - When Available' }, value: 'low' }
        ]
      }
    },
    {
      type: 'input', block_id: 'inquiry_details_block',
      label: { type: 'plain_text', text: '💬 Customer Question/Inquiry' },
      element: {
        type: 'plain_text_input', action_id: 'inquiry_details_input', multiline: true,
        min_length: 10, max_length: 1000,
        placeholder: { type: 'plain_text', text: 'What is the customer asking about? Context? What info is needed?' }
      }
    },
    {
      type: 'input', block_id: 'source_block',
      label: { type: 'plain_text', text: '📞 Contact Method' },
      element: { type: 'static_select', action_id: 'source_select',
        options: [
          { text: { type: 'plain_text', text: '📱 OpenPhone Text Message' }, value: 'openphone_text' },
          { text: { type: 'plain_text', text: '☎️ Phone Call' }, value: 'phone_call' },
          { text: { type: 'plain_text', text: '📧 Email' }, value: 'email' },
          { text: { type: 'plain_text', text: '💬 Slack Message' }, value: 'slack_message' },
          { text: { type: 'plain_text', text: '🌐 Website Contact Form' }, value: 'website_form' },
          { text: { type: 'plain_text', text: '👥 In-Person Report' }, value: 'in_person' },
          { text: { type: 'plain_text', text: '🔧 Internal Discovery' }, value: 'internal' }
        ]
      }
    },
    {
      type: 'input', block_id: 'source_details_block', optional: true,
      label: { type: 'plain_text', text: '🔗 Contact Reference (Optional)' },
      element: {
        type: 'plain_text_input', action_id: 'source_details_input', max_length: 200,
        placeholder: { type: 'plain_text', text: 'e.g., TextRec09AJ1PS4PR, support@email.com, @username' }
      }
    }
  ]
});

// --------------- Unit Management Modal ---------------
const unitManagementModal = (originChannel) => ({
  type: 'modal',
  callback_id: 'fido_unit_change_modal',
  private_metadata: originChannel,
  title: { type: 'plain_text', text: 'Unit Management' },
  submit: { type: 'plain_text', text: 'Submit Request' },
  close: { type: 'plain_text', text: 'Cancel' },
  blocks: [
    {
      type: 'input', block_id: 'change_type_block',
      label: { type: 'plain_text', text: '🔧 Change Type' },
      element: { type: 'static_select', action_id: 'change_type_select',
        options: [
          { text: { type: 'plain_text', text: '🆕 NEW UNIT - Add to Service' }, value: 'new_unit' },
          { text: { type: 'plain_text', text: '❌ CANCELLATION - Remove from Service' }, value: 'cancellation' },
          { text: { type: 'plain_text', text: '⏸️ PAUSE SERVICE - Temporary Stop' }, value: 'pause' },
          { text: { type: 'plain_text', text: '▶️ RESTART SERVICE - Resume Service' }, value: 'restart' },
          { text: { type: 'plain_text', text: '🔄 MODIFY SERVICE - Change Details' }, value: 'modify' }
        ]
      }
    },
    {
      type: 'input', block_id: 'property_block',
      label: { type: 'plain_text', text: '🏠 Property Address' },
      element: {
        type: 'plain_text_input', action_id: 'property_input',
        min_length: 15, max_length: 300,
        placeholder: { type: 'plain_text', text: 'e.g., 4487 Central Avenue, San Diego CA 92116' }
      }
    },
    {
      type: 'input', block_id: 'client_block',
      label: { type: 'plain_text', text: '🏢 Client/Property Management Company' },
      element: {
        type: 'plain_text_input', action_id: 'client_input',
        min_length: 2, max_length: 150,
        placeholder: { type: 'plain_text', text: 'e.g., Embo Rentals, The Boroughs, Vacasa Austin' }
      }
    },
    {
      type: 'input', block_id: 'market_block',
      label: { type: 'plain_text', text: '📍 Service Market' },
      element: { type: 'static_select', action_id: 'market_select',
        placeholder: { type: 'plain_text', text: 'Select service market' },
        options: MARKET_OPTIONS
      }
    },
    {
      type: 'input', block_id: 'trash_day_block', optional: true,
      label: { type: 'plain_text', text: '🗑️ Trash Pickup Day' },
      element: { type: 'static_select', action_id: 'trash_day_select',
        options: DAYS.map(DAY_OPTS)
      }
    },
    {
      type: 'input', block_id: 'recycling_day_block', optional: true,
      label: { type: 'plain_text', text: '♻️ Recycling Pickup Day (Optional)' },
      element: { type: 'static_select', action_id: 'recycling_day_select',
        options: RECYCLING_OPTS
      }
    },
    {
      type: 'input', block_id: 'effective_date_block',
      label: { type: 'plain_text', text: '📅 Effective Date' },
      element: { type: 'datepicker', action_id: 'effective_date_picker',
        placeholder: { type: 'plain_text', text: 'When should this change take effect?' }
      }
    },
    {
      type: 'input', block_id: 'reason_block',
      label: { type: 'plain_text', text: '📋 Reason for Change' },
      element: { type: 'plain_text_input', action_id: 'reason_input', multiline: true,
        min_length: 10, max_length: 500
      }
    },
    {
      type: 'input', block_id: 'instructions_block', optional: true,
      label: { type: 'plain_text', text: '📝 Special Instructions (Optional)' },
      element: { type: 'plain_text_input', action_id: 'instructions_input', multiline: true, max_length: 750 }
    }
  ]
});

// --------------- Commands → Open Modals ---------------
app.command('/fido-test', async ({ ack, respond }) => {
  await ack();
  await respond('🎉 Fido Ticketing System is working! Ready to create tickets.');
});

app.command('/fido-issue', async ({ ack, body, client }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: serviceIssueModal(body.channel_id)
    });
  } catch (error) {
    console.error('Error opening service issue modal:', error);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error opening the service issue form. Please try again or contact support.'
    });
  }
});

app.command('/fido-inquiry', async ({ ack, body, client }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: customerInquiryModal(body.channel_id)
    });
  } catch (error) {
    console.error('Error opening customer inquiry modal:', error);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error opening the customer inquiry form. Please try again or contact support.'
    });
  }
});

app.command('/fido-unit-change', async ({ ack, body, client }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: unitManagementModal(body.channel_id)
    });
  } catch (error) {
    console.error('Error opening unit management modal:', error);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error opening the unit management form. Please try again or contact support.'
    });
  }
});

// --------------- Modal Submissions ---------------

// Service Issue
app.view('fido_issue_modal', async ({ ack, body, view, client }) => {
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
  const marketVal = v.market_block.market_select.selected_option.value; // lowercase from MARKET_OPTIONS
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
        text: `*ATTN:* <!subteam^${SUBTEAMS.BP_OPERATIONS}|@bp-operations> Service issue reported — please review & respond *in this thread*.` } },
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

    const modalData = {
      ticketId, property, clientName, market: marketVal.toLowerCase(), issueType,
      priority: priorityVal, description, source: methodVal, sourceDetails: contactRef, dateStr
    };

    const clickupResult = await clickupService.createTask('issue', modalData, permalink, body.user.id);

    if (clickupResult.success) {
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: `🔗 *ClickUp Task Created:* <${clickupResult.taskUrl}|${clickupResult.taskName}>`
      });
    } else {
      console.error('ClickUp task creation failed:', clickupResult.error);
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: `⚠️ *Note:* ClickUp task creation failed. Please create manually if needed.`
      });
    }

    await client.chat.postEphemeral({
      channel: originChannel, user: body.user.id,
      text: `✅ Service issue *${ticketId}* created — <${permalink}|View in #fido-cx>${clickupResult.success ? ` | <${clickupResult.taskUrl}|ClickUp Task>` : ''}`
    });
  } catch (err) {
    console.error('Service issue ticket error:', err);
    await client.chat.postEphemeral({ channel: originChannel, user: body.user.id, text: `❌ ${err.message}` });
  }
});

// Customer Inquiry
app.view('fido_inquiry_modal', async ({ ack, body, view, client }) => {
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
        text: `*ATTN:* <!subteam^${SUBTEAMS.CX}|@cx> Customer inquiry received — please review & respond *in this thread*.` } },
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

    const modalData = {
      ticketId, property, clientName, market: marketVal.toLowerCase(), inquiryType, priority: priorityVal,
      details, source: methodVal, sourceDetails: contactRef, dateStr
    };

    const clickupResult = await clickupService.createTask('inquiry', modalData, permalink, body.user.id);

    if (clickupResult.success) {
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: `🔗 *ClickUp Task Created:* <${clickupResult.taskUrl}|${clickupResult.taskName}>`
      });
    } else {
      console.error('ClickUp task creation failed:', clickupResult.error);
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: `⚠️ *Note:* ClickUp task creation failed. Please create manually if needed.`
      });
    }

    await client.chat.postEphemeral({
      channel: originChannel, user: body.user.id,
      text: `✅ Customer inquiry *${ticketId}* created — <${permalink}|View in #fido-cx>${clickupResult.success ? ` | <${clickupResult.taskUrl}|ClickUp Task>` : ''}`
    });
  } catch (err) {
    console.error('Inquiry ticket error:', err);
    await client.chat.postEphemeral({ channel: originChannel, user: body.user.id, text: `❌ ${err.message}` });
  }
});

// Unit Management
app.view('fido_unit_change_modal', async ({ ack, body, view, client }) => {
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
        text: `*ATTN:* <!subteam^${SUBTEAMS.BPO_MGMT}|@bpo-mgmt> Unit management request received — please review & process *in this thread*.` } },
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

    const modalData = {
      ticketId, property, clientName, market: marketVal.toLowerCase(), changeType: changeVal,
      trashDay: trashVal, recyclingDay: recyclingVal,
      effectiveDate, reason, instructions, dateStr
    };

    const clickupResult = await clickupService.createTask('unit', modalData, permalink, body.user.id);

    if (clickupResult.success) {
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: `🔗 *ClickUp Task Created:* <${clickupResult.taskUrl}|${clickupResult.taskName}>`
      });
    } else {
      console.error('ClickUp task creation failed:', clickupResult.error);
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: `⚠️ *Note:* ClickUp task creation failed. Please create manually if needed.`
      });
    }

    await client.chat.postEphemeral({
      channel: originChannel, user: body.user.id,
      text: `✅ Unit management *${ticketId}* created — <${permalink}|View in #cx-unit-changes>${clickupResult.success ? ` | <${clickupResult.taskUrl}|ClickUp Task>` : ''}`
    });
  } catch (err) {
    console.error('Unit change ticket error:', err);
    await client.chat.postEphemeral({ channel: originChannel, user: body.user.id, text: `❌ ${err.message}` });
  }
});

// --------------- Global Error Guards ---------------
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// --------------- Start App ---------------
(async () => {
  try {
    const port = parseInt(process.env.PORT, 10) || 3000;
    await app.start(port);
    console.log(`⚡️ Fido Ticketing Suite is running on ${port}`);
  } catch (error) {
    console.error('Error starting app:', error);
    // Don’t exit immediately; allow Railway to hit the health endpoints if possible.
    // If app.start truly failed (e.g., Slack creds unusable), consider exiting:
    // process.exit(1);
  }
})();
