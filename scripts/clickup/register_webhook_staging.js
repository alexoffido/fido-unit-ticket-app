/**
 * Fido OS - Phase 2: Routing Webhook
 * ClickUp Webhook Registration Script (Staging)
 * 
 * Registers webhook for staging ticket lists only
 */

const https = require('https');

const API_TOKEN = process.env.CLICKUP_API_TOKEN;
const TEAM_ID = process.env.CLICKUP_TEAM_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Railway URL
const WEBHOOK_SECRET = process.env.WEBHOOK_HMAC_SECRET;

// Staging list IDs (from existing Cerberus deployment)
const STAGING_LISTS = [
  { id: '901318355853', name: 'Service Issues' },
  { id: '901318355854', name: 'Customer Inquiries' },
  { id: '901318355855', name: 'Unit Management' }
];

/**
 * Register webhook for a list
 * @param {string} listId - List ID
 * @param {string} listName - List name (for logging)
 * @returns {Promise<Object>} - Webhook registration response
 */
function registerWebhook(listId, listName) {
  return new Promise((resolve, reject) => {
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
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } else {
            // Try to parse error response
            let errorMsg;
            try {
              const parsed = JSON.parse(body);
              errorMsg = parsed.err || parsed.error || body;
            } catch {
              errorMsg = body;
            }
            reject(new Error(`ClickUp API error (${res.statusCode}): ${errorMsg}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message} - Body: ${body.substring(0, 200)}`));
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
  console.log('Fido OS - Phase 2: Webhook Registration (Staging)');
  console.log('='.repeat(60));
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Team ID: ${TEAM_ID}`);
  console.log(`HMAC Secret: ${WEBHOOK_SECRET ? '✅ Configured' : '❌ Missing'}`);
  console.log(`Registering for ${STAGING_LISTS.length} lists...`);
  console.log('');

  if (!WEBHOOK_SECRET) {
    console.error('❌ WEBHOOK_HMAC_SECRET not configured!');
    process.exit(1);
  }

  const results = [];

  for (const list of STAGING_LISTS) {
    try {
      console.log(`Registering webhook for ${list.name} (${list.id})...`);
      const webhook = await registerWebhook(list.id, list.name);
      console.log(`✅ Success! Webhook ID: ${webhook.id}`);
      results.push({ 
        listId: list.id, 
        listName: list.name,
        success: true, 
        webhookId: webhook.id 
      });
    } catch (error) {
      console.error(`❌ Failed for ${list.name}: ${error.message}`);
      results.push({ 
        listId: list.id, 
        listName: list.name,
        success: false, 
        error: error.message 
      });
    }
  }

  console.log('');
  console.log('Registration Summary:');
  console.log('='.repeat(60));
  results.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.listName} (${r.listId}): Webhook ${r.webhookId}`);
    } else {
      console.log(`❌ ${r.listName} (${r.listId}): ${r.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log('');
  console.log(`Total: ${successCount}/${STAGING_LISTS.length} webhooks registered`);
  
  if (successCount > 0) {
    console.log('');
    console.log('✅ Webhook registration complete!');
    console.log('Next step: Create test tickets to validate routing');
  }
}

// Run if executed directly
if (require.main === module) {
  if (!API_TOKEN || !TEAM_ID || !WEBHOOK_URL) {
    console.error('Error: Missing required environment variables');
    console.error('Required: CLICKUP_API_TOKEN, CLICKUP_TEAM_ID, WEBHOOK_URL, WEBHOOK_HMAC_SECRET');
    process.exit(1);
  }

  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { registerWebhook };

