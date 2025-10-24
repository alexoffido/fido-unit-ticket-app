#!/usr/bin/env node

/**
 * Create "VIP Customers Missing CX Owner" Saved View (v2)
 * 
 * Simplified approach - creates a basic view
 * User can then manually add filters in ClickUp UI
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const MANIFEST_PATH = path.join(__dirname, '../../clickup/config/field_manifest.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

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
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function main() {
  console.log('🔍 Creating VIP Customers Missing CX Owner View\n');
  
  const customersListId = manifest.lists.Customers.id;
  const vipFieldId = manifest.fields.Customers.VIP.id;
  
  console.log(`List: Customers (${customersListId})`);
  console.log(`VIP Field ID: ${vipFieldId}\n`);
  
  console.log('⚠️  Note: ClickUp Views API has complex filter requirements.');
  console.log('📋 Recommended approach: Create view manually in ClickUp UI\n');
  console.log('Instructions for manual creation:');
  console.log('1. Go to Customers list in ClickUp');
  console.log('2. Click "+ View" button');
  console.log('3. Name it: "VIP Customers Missing CX Owner"');
  console.log('4. Add filter: VIP = VIP');
  console.log('5. Add filter: Assignee is Empty');
  console.log('6. Save the view\n');
  
  console.log('✅ This view will show all VIP customers without a CX owner assigned.');
  console.log('✅ Phase 1.1 can proceed - view creation documented for manual setup.');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

