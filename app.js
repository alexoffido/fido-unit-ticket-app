require('dotenv').config();

// Debug environment variables
console.log('Environment check:');
console.log('SLACK_BOT_TOKEN exists:', !!process.env.SLACK_BOT_TOKEN);
console.log('SLACK_SIGNING_SECRET exists:', !!process.env.SLACK_SIGNING_SECRET);
console.log('PORT:', process.env.PORT);

const { App } = require('@slack/bolt');

// Validate required environment variables
if (!process.env.SLACK_BOT_TOKEN) {
  console.error('SLACK_BOT_TOKEN is required');
  process.exit(1);
}

if (!process.env.SLACK_SIGNING_SECRET) {
  console.error('SLACK_SIGNING_SECRET is required');
  process.exit(1);
}

// Initialize Slack Bolt app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
  port: parseInt(process.env.PORT) || 3000
});

// Simple test command
app.command('/fido-test', async ({ command, ack, respond }) => {
  await ack();
  await respond('Fido Ticketing System is working! 🎉');
});

// Health check
app.receiver.app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint
app.receiver.app.get('/', (req, res) => {
  res.json({ 
    message: 'Fido Ticketing Suite is running!',
    timestamp: new Date().toISOString()
  });
});

// Start the app
(async () => {
  try {
    await app.start();
    console.log('⚡️ Fido Ticketing Suite is running!');
    console.log(`🚀 Server started on port ${process.env.PORT || 3000}`);
  } catch (error) {
    console.error('Error starting app:', error);
    process.exit(1);
  }
})();
