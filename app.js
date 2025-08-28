/**
 * Cerberus Ticketing System — app_with_ops_tickets.js (final)
 * Ops → CX Tickets flow (slash command, dynamic modal, submission, ClickUp, confirmations).
 * Paste this entire file as your updated app_with_ops_tickets.js.
 */

require('dotenv').config();

const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const crypto = require('crypto');

// ───────────────────────────────────────────────────────────────────────────────
// Helpers: env(), ID gen, logging
// ───────────────────────────────────────────────────────────────────────────────

function env(key, fallback = undefined) {
  const v = process.env[key];
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

function nowIso() {
  return new Date().toISOString();
}

// Generate ticket IDs by type. We keep FO- for Ops → CX tickets.
const TICKET_PREFIX = {
  issue: 'FI',     // Fido Issue
  inquiry: 'FQ',   // Fido Query
  unit: 'FU',      // Fido Unit
  ops: 'FO'        // Fido Ops (Ops → CX)
};

// Persist a per-process counter to avoid collisions in the same minute
let _COUNTER = 0;
function generateTicketId(type = 'ops') {
  const prefix = TICKET_PREFIX[type] || 'FX';
  const ts = new Date();
  // YYMMDD + hhmm + counter (zero-padded 2)
  const YY = String(ts.getFullYear()).slice(-2);
  const MM = String(ts.getMonth() + 1).padStart(2, '0');
  const DD = String(ts.getDate()).padStart(2, '0');
  const hh = String(ts.getHours()).padStart(2, '0');
  const mm = String(ts.getMinutes()).padStart(2, '0');
  _COUNTER = (_COUNTER + 1) % 100;
  const cc = String(_COUNTER).padStart(2, '0');
  return `${prefix}-${YY}${MM}${DD}-${hh}${mm}-${cc}`;
}

// ───────────────────────────────────────────────────────────────────────────────
// Config & constants
// ───────────────────────────────────────────────────────────────────────────────

const RECEIVER_SIGNING_SECRET = env('SLACK_SIGNING_SECRET');
const SLACK_BOT_TOKEN = env('SLACK_BOT_TOKEN');
const CLICKUP_TOKEN = env('CLICKUP_TOKEN');
const CLICKUP_LIST_ID_OPS_TICKETS = env('CLICKUP_LIST_ID_OPS_TICKETS'); // REQUIRED
const FIDO_CX_CHANNEL_ID = env('FIDO_CX_CHANNEL_ID');                   // REQUIRED
const SUBTEAM_CX = env('SUBTEAM_CX');                                   // optional (Slack user group)

const PORT = Number(env('PORT', 3000));

const CHANNELS = {
  FIDO_CX: FIDO_CX_CHANNEL_ID || 'C07PN5F527N', // fallback is a harmless placeholder
  CX_UNIT_CHANGES: env('CX_UNIT_CHANGES_CHANNEL_ID') || 'C08M77HMRT9'
};

const SUBTEAMS = {
  CX: SUBTEAM_CX || null
};

// ───────────────────────────────────────────────────────────────────────────────
// External services (ClickUp)
// ───────────────────────────────────────────────────────────────────────────────

const clickupService = require('./services/clickup'); // must support createTask('ops', ...)

// ───────────────────────────────────────────────────────────────────────────────
// Bolt initialization with ExpressReceiver
// ───────────────────────────────────────────────────────────────────────────────

const receiver = new ExpressReceiver({
  signingSecret: RECEIVER_SIGNING_SECRET,
  endpoints: {
    events: '/slack/events',
    commands: '/slack/commands',
    interactive: '/slack/interactive'
  }
});

const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver
});

// Also expose express app for custom health/diag
const server = receiver.app;

// Trust proxy (Railway / cloud)
server.set('trust proxy', 1);

// ───────────────────────────────────────────────────────────────────────────────
// Health & diagnostics
// ───────────────────────────────────────────────────────────────────────────────

function ok(res, more = {}) {
  res.status(200).json({ ok: true, at: nowIso(), ...more });
}

server.get('/', (req, res) => ok(res));
server.get('/health', (req, res) => ok(res));
server.get('/healthz', (req, res) => ok(res));
server.get('/status', (req, res) => ok(res));
server.get('/ready', (req, res) => ok(res));
server.get('/live', (req, res) => ok(res));

server.get('/diag', (req, res) => {
  ok(res, {
    slack: {
      bot: !!SLACK_BOT_TOKEN,
      signingSecret: !!RECEIVER_SIGNING_SECRET
    },
    clickup: {
      token: !!CLICKUP_TOKEN,
      opsListIdPresent: !!CLICKUP_LIST_ID_OPS_TICKETS
    },
    channels: {
      cx: CHANNELS.FIDO_CX,
      cxUnitChanges: CHANNELS.CX_UNIT_CHANGES
    },
    subteams: {
      cx: SUBTEAMS.CX ? 'present' : 'absent'
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Ops → CX Tickets: modal builder, action, and submission
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Open the Ops → CX modal.
 * We keep namespacing (ops_* action_ids & block_ids) to avoid collisions.
 */
async function openOpsTicketModal({ trigger_id, client, metadata }) {
  await client.views.open({
    trigger_id,
    view: {
      type: 'modal',
      callback_id: 'fido_ops_ticket_modal',
      private_metadata: metadata, // origin channel id
      title: { type: 'plain_text', text: 'Ops Tickets' }, // keep display name “Ops Tickets”
      submit: { type: 'plain_text', text: 'Submit' },
      close: { type: 'plain_text', text: 'Cancel' },
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
            action_id: 'ops_issue_type_select',
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
              { text: { type: 'plain_text', text: 'P1 — Urgent' }, value: 'P1' },
              { text: { type: 'plain_text', text: 'P2 — High' }, value: 'P2' },
              { text: { type: 'plain_text', text: 'P3 — Normal' }, value: 'P3' }
            ],
            initial_option: { text: { type: 'plain_text', text: 'P3 — Normal' }, value: 'P3' }
          }
        },
        {
          type: 'input',
          block_id: 'market_block',
          label: { type: 'plain_text', text: 'Market (3-letter code)' },
          element: {
            type: 'static_select',
            action_id: 'market_select',
            options: [
              { text: { type: 'plain_text', text: 'ATX' }, value: 'atx' },
              { text: { type: 'plain_text', text: 'SEA' }, value: 'sea' },
              { text: { type: 'plain_text', text: 'PHX' }, value: 'phx' },
              { text: { type: 'plain_text', text: 'CHS' }, value: 'chs' },
              { text: { type: 'plain_text', text: 'LAX' }, value: 'lax' },
              { text: { type: 'plain_text', text: 'SAN' }, value: 'san' }
              // add more markets as needed
            ]
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
          label: { type: 'plain_text', text: 'External Link (optional)' },
          element: {
            type: 'plain_text_input', // validate as URL on submit
            action_id: 'external_link_input',
            placeholder: { type: 'plain_text', text: 'https://link.to/evidence-or-tool' }
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
    }
  });
}

// Cascading dropdown — namespaced and fenced to the Ops modal only
app.action('ops_issue_type_select', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    if (body.view?.callback_id !== 'fido_ops_ticket_modal') return;

    const selected = body.actions[0].selected_option.value;
    const current = [...body.view.blocks];

    // Remove previously injected conditional blocks
    const filtered = current.filter(b =>
      !['ops_sub_issue_block', 'ops_misc_specify_block'].includes(b.block_id)
    );

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

// Modal submission — post to CX, create ClickUp task in Ops → CX list, thread link, ephemeral confirm
app.view('fido_ops_ticket_modal', async ({ ack, body, view, client, logger }) => {
  // Validate optional URL
  const v = view.state.values;
  const urlCandidate = v.external_link_block?.external_link_input?.value?.trim();
  if (urlCandidate) {
    try { new URL(urlCandidate); } catch {
      return ack({
        response_action: 'errors',
        errors: { external_link_block: 'Please enter a valid URL (e.g., https://example.com).' }
      });
    }
  }

  await ack();

  const originChannel = view.private_metadata;
  const dateStr = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
  const ticketId = generateTicketId('ops');

  // Extract fields
  const subject       = v.subject_block.subject_input.value.trim();
  const property      = v.property_block.property_input.value.trim();
  const issueTypeSel  = v.issue_type_block.ops_issue_type_select.selected_option;
  const issueTypeText = issueTypeSel.text.text;
  const issueTypeVal  = issueTypeSel.value;

  const priorityText  = v.priority_block.priority_select.selected_option.text.text;
  const marketVal     = v.market_block.market_select.selected_option.value; // lower-case value
  const marketDisp    = marketVal.toUpperCase();

  const description   = v.description_block.description_input.value.trim();
  const externalLink  = urlCandidate || null;
  const notes         = v.notes_block?.notes_input?.value?.trim() || null;

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
      ...(externalLink ? [{ type: 'section', text: { type: 'mrkdwn', text: `*External Link:*\n<${externalLink}>` } }] : []),
      ...(notes ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Internal Notes:*\n${notes}` } }] : []),
      { type: 'context', elements: [
        { type: 'mrkdwn', text: `_Created by: <@${body.user.id}> on ${dateStr} | Cerberus_` }
      ] }
    ];

    const post = await client.chat.postMessage({
      channel: CHANNELS.FIDO_CX,
      text: `Ops → CX ticket ${ticketId}`,
      blocks
    });

    const { permalink } = await client.chat.getPermalink({
      channel: post.channel, message_ts: post.ts
    });

    // ClickUp creation (Ops → CX list)
    const click = await clickupService.createTask('ops', {
      ticketId,
      subject,
      property,
      market: marketVal,          // keep lower-case if you normalize in ClickUp
      issueType: fullIssueType,
      priority: priorityText,
      description,
      externalLink,
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
      text: `✅ Ops → CX ticket *${ticketId}* created — <${permalink}|View your ticket>`
    });

  } catch (err) {
    console.error('Ops → CX ticket creation failed', err);
    try {
      await client.chat.postEphemeral({
        channel: originChannel,
        user: body.user.id,
        text: '❌ Error creating Ops → CX ticket. Please try again or escalate.'
      });
    } catch (_) {}
  }
});

// Slash command to open the Ops → CX modal
app.command('/fido-ops-ticket', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    const originChannel = body.channel_id;
    await openOpsTicketModal({
      trigger_id: body.trigger_id,
      client,
      metadata: originChannel
    });
  } catch (err) {
    logger.error('Open Ops → CX modal failed', err);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Could not open Ops → CX modal. Please retry.'
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// Startup
// ───────────────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await app.start(PORT);
    console.log(`[cerberus] Bolt app running on ${PORT} @ ${nowIso()}`);
  } catch (err) {
    console.error('[cerberus] failed to start app', err);
    process.exit(1);
  }
})();
