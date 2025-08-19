require('dotenv').config();

const { App } = require('@slack/bolt');

// Initialize Slack Bolt app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
  port: parseInt(process.env.PORT) || 3000
});

// Channel IDs
const CHANNELS = {
  FIDO_CX: process.env.FIDO_CX_CHANNEL_ID || 'C07PN5F527N',
  CX_UNIT_CHANGES: process.env.CX_UNIT_CHANGES_CHANNEL_ID || 'C08M77HMRT9'
};

// Generate unique ticket ID
function generateTicketId(type) {
  const prefix = type === 'issue' ? 'FI' : type === 'inquiry' ? 'FQ' : 'FU';
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${timestamp}`;
}

// Simple test command
app.command('/fido-test', async ({ command, ack, respond }) => {
  await ack();
  await respond('🎉 Fido Ticketing System is working! Ready to create tickets.');
});

// Slash command: /fido-issue
app.command('/fido-issue', async ({ command, ack, body, client }) => {
  await ack();
  
  try {
    const ticketId = generateTicketId('issue');
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Fixed message formatting - use single asterisks for bold in Slack
    const message = `ATTN: <@bp-operations> the CX Team has logged a customer issue - please review & follow up in this thread asap!

*Issue Date:* ${timestamp}
*Ticket ID:* ${ticketId}
*Created by:* <@${body.user_id}>
*Details:* Use the full modal form (coming soon)

_This is a test ticket from the new Fido Ticketing System_`;

    // Post to #fido-cx channel (NOT ephemeral)
    await client.chat.postMessage({
      channel: CHANNELS.FIDO_CX,
      text: message,
      mrkdwn: true
    });

    // Send success confirmation as ephemeral message to user
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `✅ Service issue ticket ${ticketId} created successfully in <#${CHANNELS.FIDO_CX}>!`
    });

    console.log(`Created service issue ticket ${ticketId}`);
    
  } catch (error) {
    console.error('Error creating issue ticket:', error);
    
    // Send error message to user
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `❌ Error creating ticket: ${error.message}`
    });
  }
});

// Slash command: /fido-inquiry
app.command('/fido-inquiry', async ({ command, ack, body, client }) => {
  await ack();
  
  try {
    const ticketId = generateTicketId('inquiry');
    const timestamp = new Date().toISOString().split('T')[0];
    
    const message = `ATTN: <@cx> the team has received a customer inquiry - please review & respond in this thread!

*Inquiry Date:* ${timestamp}
*Ticket ID:* ${ticketId}
*Created by:* <@${body.user_id}>
*Type:* Customer Inquiry
*Details:* Use the full modal form (coming soon)

_This is a customer inquiry from the new Fido Ticketing System_`;

    // Post to #fido-cx channel
    await client.chat.postMessage({
      channel: CHANNELS.FIDO_CX,
      text: message,
      mrkdwn: true
    });

    // Send success confirmation
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `✅ Customer inquiry ${ticketId} created successfully in <#${CHANNELS.FIDO_CX}>!`
    });

    console.log(`Created customer inquiry ${ticketId}`);
    
  } catch (error) {
    console.error('Error creating inquiry:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `❌ Error creating inquiry: ${error.message}`
    });
  }
});

// Slash command: /fido-unit-change
app.command('/fido-unit-change', async ({ command, ack, body, client }) => {
  await ack();
  
  try {
    const ticketId = generateTicketId('unit-change');
    const timestamp = new Date().toISOString().split('T')[0];
    
    const message = `ATTN: <@bpo-mgmt> unit management request received - please review & process in this thread!

*Request Date:* ${timestamp}
*Ticket ID:* ${ticketId}
*Created by:* <@${body.user_id}>
*Type:* Unit Management (Add/Pause/Cancel)
*Details:* Use the full modal form (coming soon)

_This is a unit management request from the new Fido Ticketing System_`;

    // Post to #cx-unit-changes channel
    await client.chat.postMessage({
      channel: CHANNELS.CX_UNIT_CHANGES,
      text: message,
      mrkdwn: true
    });

    // Send success confirmation
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `✅ Unit management request ${ticketId} created successfully in <#${CHANNELS.CX_UNIT_CHANGES}>!`
    });

    console.log(`Created unit management request ${ticketId}`);
    
  } catch (error) {
    console.error('Error creating unit change request:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `❌ Error creating unit change request: ${error.message}`
    });
  }
});

// Start the app
(async () => {
  try {
    await app.start();
    console.log('⚡️ Fido Ticketing Suite is running!');
    console.log(`🚀 Server started on port ${process.env.PORT || 3000}`);
    console.log('📋 Available commands:');
    console.log('   /fido-test - Test the connection');
    console.log('   /fido-issue - Create service issue tickets');
    console.log('   /fido-inquiry - Create customer inquiry tickets');
    console.log('   /fido-unit-change - Create unit management requests');
  } catch (error) {
    console.error('Error starting app:', error);
    process.exit(1);
  }
})();

