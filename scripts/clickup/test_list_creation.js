#!/usr/bin/env node

/**
 * Test ClickUp List Creation
 * Simplified script to diagnose and fix list creation issues
 */

const https = require('https');

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CRM_SPACE_ID = '901311352726';
const ADMIN_SPACE_ID = '901311352727';

function clickupRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.clickup.com',
      path: path,
      method: method,
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}`);
        console.log(`Response body: ${data}`);
        
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API ${method} ${path} failed: ${res.statusCode} - ${data}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      const bodyStr = JSON.stringify(body);
      console.log(`Request body: ${bodyStr}`);
      req.write(bodyStr);
    }
    
    req.end();
  });
}

async function createList(spaceId, listName, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating list: ${listName}`);
  console.log(`Space ID: ${spaceId}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const response = await clickupRequest('POST', `/api/v2/space/${spaceId}/list`, {
      name: listName,
      content: description
    });
    
    console.log(`✅ Successfully created list: ${listName}`);
    console.log(`   List ID: ${response.id}`);
    return response;
  } catch (error) {
    console.error(`❌ Failed to create list: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🧪 Testing ClickUp List Creation\n');
  
  if (!CLICKUP_API_TOKEN) {
    console.error('❌ CLICKUP_API_TOKEN environment variable is required');
    process.exit(1);
  }
  
  try {
    // Test creating a single list in CRM space
    await createList(
      CRM_SPACE_ID,
      'Customers',
      'Customer master records with VIP status and market assignments'
    );
    
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();

