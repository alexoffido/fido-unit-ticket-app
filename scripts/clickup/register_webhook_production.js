/**
 * Fido OS - Phase 5: Production Deployment
 * ClickUp Webhook Registration Script (Production)
 * 
 * Registers webhooks for production ticket lists
 */

const https = require('https');

const API_TOKEN = process.env.CLICKUP_API_TOKEN;
const TEAM_ID = process.env.CLICKUP_TEAM_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://fido-unit-ticket-app-production.up.railway.app/webhook/clickup';
const WEBHOOK_SECRET = process.env.WEBHOOK_HMAC_SECRET;

// Production list IDs (to be updated with actual production list IDs)
const PRODUCTION_LISTS = [
  { id: process.env.CLICKUP_LIST_ID_ISSUE || 'TBD', name: 'Service Issues' },
  { id: process.env.CLICKUP_LIST_ID_INQUIRY || 'TBD', name: 'Customer Inquiries' },
  { id: process.env.CLICKUP_LIST_ID_UNIT || 'TBD', name: 'Unit Management' }
];

/**
 * Register webhook for a list
 * @param {string} listId - List ID
 * @param {string} listName - List name (for logging)
 * @returns {Promise<Object>} - Webhook registration response
 */
function registerWebhook(listId, listName) {
  return new Promise((resolve, reject) => {
    if (listId === 'TBD') {
      console.log(`⚠️  Skipping ${listName}: List ID not configured (set CLICKUP_LIST_ID_* env var)`);
      resolve({ skipped: true, listName });
      return;
    }

    const data = JSON.stringify({
      endpoint: WEBHOOK_URL,
      events: ['taskCreated', 'taskUpdated'],
      list_id: listId,
      secret: WEBHOOK_SECRET
    });

    const options = {
      hostname: 'api.clickup.com',
      path: `/api/v2/team/${TEAM_ID}/webhook`,
      method: 'POST',
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          
          if (res.statusCode === 200) {
            console.log(`✅ Webhook registered for ${listName}`);
            console.log(`   Webhook ID: ${response.id}`);
            console.log(`   Endpoint: ${WEBHOOK_URL}`);
            resolve(response);
          } else {
            console.error(`❌ Failed to register webhook for ${listName}`);
            console.error(`   Status: ${res.statusCode}`);
            console.error(`   Error: ${response.err || body}`);
            reject(new Error(response.err || body));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Fido OS - Production Webhook Registration');
  console.log('='.repeat(60));
  console.log('');
  console.log('Configuration:');
  console.log(`  Team ID: ${TEAM_ID}`);
  console.log(`  Webhook URL: ${WEBHOOK_URL}`);
  console.log(`  Secret: ${WEBHOOK_SECRET ? '***configured***' : '⚠️  MISSING'}`);
  console.log('');

  if (!API_TOKEN || !TEAM_ID || !WEBHOOK_SECRET) {
    console.error('❌ Missing required environment variables:');
    if (!API_TOKEN) console.error('   - CLICKUP_API_TOKEN');
    if (!TEAM_ID) console.error('   - CLICKUP_TEAM_ID');
    if (!WEBHOOK_SECRET) console.error('   - WEBHOOK_HMAC_SECRET');
    process.exit(1);
  }

  console.log('Registering webhooks for production lists...');
  console.log('');

  const results = [];
  
  for (const list of PRODUCTION_LISTS) {
    try {
      const result = await registerWebhook(list.id, list.name);
      results.push({ list: list.name, success: !result.skipped, result });
    } catch (error) {
      console.error(`   Error: ${error.message}`);
      results.push({ list: list.name, success: false, error: error.message });
    }
    console.log('');
  }

  // Summary
  console.log('='.repeat(60));
  console.log('Registration Summary');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const skipped = results.filter(r => r.result?.skipped).length;
  const failed = results.filter(r => !r.success && !r.result?.skipped).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');
  
  if (skipped > 0) {
    console.log('⚠️  Some webhooks were skipped because list IDs are not configured.');
    console.log('   Set environment variables:');
    console.log('   - CLICKUP_LIST_ID_ISSUE (Service Issues)');
    console.log('   - CLICKUP_LIST_ID_INQUIRY (Customer Inquiries)');
    console.log('   - CLICKUP_LIST_ID_UNIT (Unit Management)');
    console.log('');
  }
  
  if (failed > 0) {
    console.error('❌ Some webhooks failed to register. Check errors above.');
    process.exit(1);
  }
  
  console.log('✅ Production webhook registration complete!');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

