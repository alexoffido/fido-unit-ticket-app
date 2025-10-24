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

// Staging list IDs (from existing Cerberus deployment)
const STAGING_LISTS = [
  '901318355853', // Service Issues
  '901318355854', // Customer Inquiries  
  '901318355855'  // Unit Management
];

/**
 * Register webhook for a list
 * @param {string} listId - List ID
 * @returns {Promise<Object>} - Webhook registration response
 */
function registerWebhook(listId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      endpoint: WEBHOOK_URL,
      events: ['taskCreated', 'taskUpdated']
    });

    const options = {
      hostname: 'api.clickup.com',
      path: `/api/v2/list/${listId}/webhook`,
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
          const parsed = JSON.parse(body);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`ClickUp API error: ${res.statusCode} - ${parsed.err || body}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
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
  console.log(`Registering for ${STAGING_LISTS.length} lists...`);
  console.log('');

  const results = [];

  for (const listId of STAGING_LISTS) {
    try {
      console.log(`Registering webhook for list ${listId}...`);
      const webhook = await registerWebhook(listId);
      console.log(`✅ Success! Webhook ID: ${webhook.id}`);
      results.push({ listId, success: true, webhookId: webhook.id });
    } catch (error) {
      console.error(`❌ Failed for list ${listId}: ${error.message}`);
      results.push({ listId, success: false, error: error.message });
    }
  }

  console.log('');
  console.log('Registration Summary:');
  console.log('='.repeat(60));
  results.forEach(r => {
    if (r.success) {
      console.log(`✅ List ${r.listId}: Webhook ${r.webhookId}`);
    } else {
      console.log(`❌ List ${r.listId}: ${r.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log('');
  console.log(`Total: ${successCount}/${STAGING_LISTS.length} webhooks registered`);
}

// Run if executed directly
if (require.main === module) {
  if (!API_TOKEN || !TEAM_ID || !WEBHOOK_URL) {
    console.error('Error: Missing required environment variables');
    console.error('Required: CLICKUP_API_TOKEN, CLICKUP_TEAM_ID, WEBHOOK_URL');
    process.exit(1);
  }

  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { registerWebhook };

