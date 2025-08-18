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
    
    // Simple ticket creation for now
    const message = `ATTN: @bp-operations the CX Team has logged a customer issue - please review & follow up in this thread asap!

**Issue Date:** ${timestamp}
**Ticket ID:** ${ticketId}
**Created by:** <@${body.user_id}>
**Details:** Use the full modal form (coming soon)

*This is a test ticket from the new Fido Ticketing System*`;

    // Post to #fido-cx channel
    await client.chat.postMessage({
      channel: CHANNELS.FIDO_CX,
      text: message
    });

    // Respond to user
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `✅ Service issue ticket ${ticketId} created successfully!`
    });

    console.log(`Created service issue ticket ${ticketId}`);
    
  } catch (error) {
    console.error('Error creating issue ticket:', error);
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
  } catch (error) {
    console.error('Error starting app:', error);
    process.exit(1);
  }
})();
