require('dotenv').config();
const { App } = require('@slack/bolt');

// Initialize Slack Bolt app (HTTP mode)
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
  port: parseInt(process.env.PORT, 10) || 3000,
});

// Channel IDs (fallbacks are safe but keep envs set in Railway)
const CHANNELS = {
  FIDO_CX: process.env.FIDO_CX_CHANNEL_ID || 'C07PN5F527N',
  CX_UNIT_CHANGES: process.env.CX_UNIT_CHANGES_CHANNEL_ID || 'C08M77HMRT9',
};

// Slack user group (subteam) IDs for proper @mentions
// Format in messages: <!subteam^SUBTEAM_ID|@alias>
const SUBTEAMS = {
  BP_OPERATIONS: process.env.BP_OPERATIONS_SUBTEAM_ID || 'SXXXXBP', // e.g. S0ABCDE12
  CX: process.env.CX_SUBTEAM_ID || 'SXXXXCX',
  BPO_MGMT: process.env.BPO_MGMT_SUBTEAM_ID || 'SXXXXBPO',
};

// Generate unique ticket ID (prefix + short timestamp + random base36)
function generateTicketId(type) {
  const prefix = type === 'issue' ? 'FI' : type === 'inquiry' ? 'FQ' : 'FU';
  const ts = Date.now().toString().slice(-6);
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${ts}${rnd}`;
}

// --- Commands ---

app.command('/fido-test', async ({ ack, respond }) => {
  await ack();
  await respond('🎉 Fido Ticketing System is working! Ready to create tickets.');
});

// /fido-issue
app.command('/fido-issue', async ({ ack, body, client }) => {
  await ack();
  const ticketId = generateTicketId('issue');
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*ATTN:* <!subteam^${SUBTEAMS.BP_OPERATIONS}|@bp-operations> ` +
            `The CX Team has logged a customer issue — please review & follow up *in this thread* ASAP.`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Issue Date:*\n${dateStr}` },
          { type: 'mrkdwn', text: `*Ticket ID:*\n${ticketId}` },
          { type: 'mrkdwn', text: `*Created by:*\n<@${body.user_id}>` },
          { type: 'mrkdwn', text: `*Details:*\nUse modal form (coming soon)` },
        ],
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `_Fido Ticketing System_` }],
      },
    ];

    // Public post to #fido-cx
    const post = await client.chat.postMessage({
      channel: CHANNELS.FIDO_CX,
      text: `Service issue ticket ${ticketId}`, // fallback
      blocks,
    });

    // Permalink for easy navigation
    const { permalink } = await client.chat.getPermalink({
      channel: post.channel,
      message_ts: post.ts,
    });

    // Ephemeral success message to command invoker
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `✅ Service issue ticket *${ticketId}* created in <#${CHANNELS.FIDO_CX}> — <${permalink}|View ticket>`,
    });

    console.log(`Created service issue ticket ${ticketId}`);
  } catch (err) {
    console.error('Error creating issue ticket:', err);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `❌ Error creating ticket: ${err.data?.error || err.message}`,
    });
  }
});

// /fido-inquiry
app.command('/fido-inquiry', async ({ ack, body, client }) => {
  await ack();
  const ticketId = generateTicketId('inquiry');
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*ATTN:* <!subteam^${SUBTEAMS.CX}|@cx> ` +
            `A customer inquiry was logged — please review & respond *in this thread*.`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Inquiry Date:*\n${dateStr}` },
          { type: 'mrkdwn', text: `*Ticket ID:*\n${ticketId}` },
          { type: 'mrkdwn', text: `*Created by:*\n<@${body.user_id}>` },
          { type: 'mrkdwn', text: `*Type:*\nCustomer Inquiry` },
        ],
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Fido Ticketing System_` }] },
    ];

    const post = await client.chat.postMessage({
      channel: CHANNELS.FIDO_CX,
      text: `Customer inquiry ${ticketId}`,
      blocks,
    });

    const { permalink } = await client.chat.getPermalink({
      channel: post.channel,
      message_ts: post.ts,
    });

    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `✅ Customer inquiry *${ticketId}* created in <#${CHANNELS.FIDO_CX}> — <${permalink}|View ticket>`,
    });

    console.log(`Created customer inquiry ${ticketId}`);
  } catch (err) {
    console.error('Error creating inquiry:', err);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `❌ Error creating inquiry: ${err.data?.error || err.message}`,
    });
  }
});

// /fido-unit-change
app.command('/fido-unit-change', async ({ ack, body, client }) => {
  await ack();
  const ticketId = generateTicketId('unit-change');
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*ATTN:* <!subteam^${SUBTEAMS.BPO_MGMT}|@bpo-mgmt> ` +
            `Unit management request received — please review & process *in this thread*.`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Request Date:*\n${dateStr}` },
          { type: 'mrkdwn', text: `*Ticket ID:*\n${ticketId}` },
          { type: 'mrkdwn', text: `*Created by:*\n<@${body.user_id}>` },
          { type: 'mrkdwn', text: `*Type:*\nAdd / Pause / Cancel` },
        ],
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Fido Ticketing System_` }] },
    ];

    const post = await client.chat.postMessage({
      channel: CHANNELS.CX_UNIT_CHANGES,
      text: `Unit management request ${ticketId}`,
      blocks,
    });

    const { permalink } = await client.chat.getPermalink({
      channel: post.channel,
      message_ts: post.ts,
    });

    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `✅ Unit management request *${ticketId}* created in <#${CHANNELS.CX_UNIT_CHANGES}> — <${permalink}|View ticket>`,
    });

    console.log(`Created unit management request ${ticketId}`);
  } catch (err) {
    console.error('Error creating unit change request:', err);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `❌ Error creating unit change request: ${err.data?.error || err.message}`,
    });
  }
});

// Start the app (HTTP receiver on PORT)
(async () => {
  try {
    await app.start();
    console.log('⚡️ Fido Ticketing Suite is running!');
    console.log(`🚀 Server started on port ${process.env.PORT || 3000}`);
    console.log('📋 Available commands: /fido-test, /fido-issue, /fido-inquiry, /fido-unit-change');
  } catch (error) {
    console.error('Error starting app:', error);
    process.exit(1);
  }
})();
