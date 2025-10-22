#!/usr/bin/env node

/**
 * Create Test Data for Phase 1 Validation
 * Creates sample customers, units, and admin records to validate the schema
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const MANIFEST_PATH = path.join(__dirname, '../../clickup/config/field_manifest.json');

// Load manifest
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

async function createTask(listId, taskName, customFields = {}) {
  try {
    console.log(`Creating task: ${taskName}`);
    
    const response = await clickupRequest('POST', `/api/v2/list/${listId}/task`, {
      name: taskName,
      custom_fields: customFields
    });
    
    console.log(`✅ Created: ${taskName} (ID: ${response.id})`);
    return response;
  } catch (error) {
    console.error(`❌ Error creating ${taskName}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🧪 Creating Test Data for Phase 1 Validation\n');
  
  if (!CLICKUP_API_TOKEN) {
    console.error('❌ CLICKUP_API_TOKEN environment variable is required');
    process.exit(1);
  }
  
  const customersListId = manifest.lists['Customers'].id;
  const unitsListId = manifest.lists['Units'].id;
  const marketOwnershipListId = manifest.lists['Market Ownership'].id;
  const vipMappingListId = manifest.lists['VIP Mapping'].id;
  
  // Get field IDs
  const customerFields = manifest.fields['Customers'];
  const unitFields = manifest.fields['Units'];
  const marketFields = manifest.fields['Market Ownership'];
  const vipFields = manifest.fields['VIP Mapping'];
  
  console.log('📋 Creating Test Customers...\n');
  
  // Test Customer 1: VIP Customer
  await createTask(customersListId, 'Test Customer - VIP (John Smith)', [
    { id: customerFields['customer_key'].id, value: 'CUST-001' },
    { id: customerFields['Customer Name'].id, value: 'John Smith' },
    { id: customerFields['VIP'].id, value: 0 }, // VIP option (first in dropdown)
    { id: customerFields['Status'].id, value: 0 } // Active
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test Customer 2: Standard Customer
  await createTask(customersListId, 'Test Customer - Standard (Jane Doe)', [
    { id: customerFields['customer_key'].id, value: 'CUST-002' },
    { id: customerFields['Customer Name'].id, value: 'Jane Doe' },
    { id: customerFields['VIP'].id, value: 1 }, // Standard option
    { id: customerFields['Status'].id, value: 0 } // Active
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('\n📋 Creating Test Units...\n');
  
  // Test Unit 1: For VIP Customer
  await createTask(unitsListId, 'Test Unit - 123 Main St, Austin', [
    { id: unitFields['unit_key'].id, value: 'UNIT-001' },
    { id: unitFields['customer_key'].id, value: 'CUST-001' },
    { id: unitFields['Address'].id, value: '123 Main St, Austin, TX' },
    { id: unitFields['Market'].id, value: 0 }, // ATX
    { id: unitFields['Subscription'].id, value: 2 }, // 3 ongoing
    { id: unitFields['Status'].id, value: 0 } // Active
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test Unit 2: For Standard Customer
  await createTask(unitsListId, 'Test Unit - 456 Oak Ave, Los Angeles', [
    { id: unitFields['unit_key'].id, value: 'UNIT-002' },
    { id: unitFields['customer_key'].id, value: 'CUST-002' },
    { id: unitFields['Address'].id, value: '456 Oak Ave, Los Angeles, CA' },
    { id: unitFields['Market'].id, value: 1 }, // LAX
    { id: unitFields['Subscription'].id, value: 0 }, // biweekly
    { id: unitFields['Status'].id, value: 0 } // Active
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('\n📋 Creating Test Market Ownership Records...\n');
  
  // Market Ownership: ATX
  await createTask(marketOwnershipListId, 'Market: ATX', [
    { id: marketFields['Market'].id, value: 0 } // ATX
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Market Ownership: LAX
  await createTask(marketOwnershipListId, 'Market: LAX', [
    { id: marketFields['Market'].id, value: 1 } // LAX
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('\n📋 Creating Test VIP Mapping Record...\n');
  
  // VIP Mapping for CUST-001
  await createTask(vipMappingListId, 'VIP: John Smith (CUST-001)', [
    { id: vipFields['customer_key'].id, value: 'CUST-001' }
  ]);
  
  console.log('\n✅ Test data creation complete!');
  console.log('\n📊 Summary:');
  console.log('   - 2 Test Customers (1 VIP, 1 Standard)');
  console.log('   - 2 Test Units (ATX, LAX)');
  console.log('   - 2 Market Ownership records');
  console.log('   - 1 VIP Mapping record');
  console.log('\n🎯 Next: Verify data in ClickUp UI');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

