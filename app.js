require('dotenv').config();
const { App } = require('@slack/bolt');

// ---------------------- Minimal App Init for Debugging ----------------------
console.log('Starting Fido Ticketing app...');
console.log('Environment check:');
console.log('- SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'SET' : 'MISSING');
console.log('- SLACK_SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? 'SET' : 'MISSING');
console.log('- PORT:', process.env.PORT || '3000 (default)');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false
});

// ---------------------- Ultra-Simple Health Endpoints ----------------------
const expressApp = app.receiver.app;

// Catch-all health endpoint
expressApp.get('*', (req, res) => {
  console.log(`Health check request: ${req.method} ${req.path}`);
  
  // Respond to any GET request with 200
  if (req.path === '/' || req.path.includes('health') || req.path.includes('status')) {
    res.status(200).type('text/plain').send('ok');
  } else {
    res.status(404).send('Not found');
  }
});

// HEAD requests
expressApp.head('*', (req, res) => {
  console.log(`Health check HEAD request: ${req.path}`);
  res.sendStatus(200);
});

// ---------------------- Basic Test Command ----------------------
app.command('/fido-test', async ({ ack, respond }) => {
  await ack();
  await respond('🎉 Fido Ticketing System is working! Minimal version deployed.');
});

// ---------------------- Start App with Maximum Logging ----------------------
(async () => {
  try {
    const port = parseInt(process.env.PORT, 10) || 3000;
    console.log(`Attempting to start app on port ${port}...`);
    
    await app.start(port);
    
    console.log(`✅ SUCCESS: Fido Ticketing Suite is running on port ${port}`);
    console.log(`🌐 App should be accessible at: http://0.0.0.0:${port}`);
    console.log(`🔍 Health endpoints: /, /health, /healthz, /status`);
    
  } catch (error) {
    console.error('❌ STARTUP ERROR:', error);
    console.error('Error details:', error.stack);
    
    // Don't exit immediately - let Railway see the error
    setTimeout(() => {
      console.error('Exiting after error...');
      process.exit(1);
    }, 5000);
  }
})();

// ---------------------- Process Error Handlers ----------------------
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('App initialization complete, waiting for start...');

