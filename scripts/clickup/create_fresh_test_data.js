#!/usr/bin/env node

/**
 * Create Fresh Test Data with Proper Naming
 * 
 * Creates test records in the new CRM and Admin lists with:
 * - Clean task names (customer names, addresses, market codes)
 * - All metadata in custom fields
 * - Proper field types (short_text for single-line)
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

async function createTask(listId, taskName, customFields = {}) {
  console.log(`   📝 Creating: ${taskName}`);
  
  const taskData = {
    name: taskName,
    custom_fields: []
  };
  
  // Add custom fields
  for (const [fieldId, value] of Object.entries(customFields)) {
    taskData.custom_fields.push({
      id: fieldId,
      value: value
    });
  }
  
  const response = await clickupRequest('POST', `/api/v2/list/${listId}/task`, taskData);
  console.log(`      ✅ Created: ${response.id}`);
  return response;
}

async function main() {
  console.log('🧪 Creating Fresh Test Data with Proper Naming\n');
  
  const lists = manifest.lists;
  const fields = manifest.fields;
  
  // ========== CUSTOMERS ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 CUSTOMERS');
  console.log('='.repeat(70));
  
  const customersListId = lists.Customers.id;
  const customerFields = fields.Customers;
  
  // Customer 1: VIP Customer
  await createTask(customersListId, 'John Smith', {
    [customerFields.customer_key.id]: 'CUST-001',
    [customerFields['Customer Name'].id]: 'John Smith',
    [customerFields.VIP.id]: 0, // VIP (first option)
    [customerFields.Status.id]: 0  // Active (first option)
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Customer 2: Standard Customer
  await createTask(customersListId, 'Jane Doe', {
    [customerFields.customer_key.id]: 'CUST-002',
    [customerFields['Customer Name'].id]: 'Jane Doe',
    [customerFields.VIP.id]: 1, // Standard (second option)
    [customerFields.Status.id]: 0  // Active
  });
  
  console.log('\n✅ 2 customers created');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UNITS ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 UNITS');
  console.log('='.repeat(70));
  
  const unitsListId = lists.Units.id;
  const unitFields = fields.Units;
  
  // Unit 1: John Smith's Austin unit
  await createTask(unitsListId, '123 Main St, Austin, TX', {
    [unitFields.unit_key.id]: 'UNIT-001',
    [unitFields.customer_key.id]: 'CUST-001',
    [unitFields.Address.id]: '123 Main St, Austin, TX',
    [unitFields.Market.id]: 0, // ATX (first option)
    [unitFields.Subscription.id]: 2, // 3 ongoing
    [unitFields.Status.id]: 0  // Active
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Unit 2: Jane Doe's LA unit
  await createTask(unitsListId, '456 Oak Ave, Los Angeles, CA', {
    [unitFields.unit_key.id]: 'UNIT-002',
    [unitFields.customer_key.id]: 'CUST-002',
    [unitFields.Address.id]: '456 Oak Ave, Los Angeles, CA',
    [unitFields.Market.id]: 1, // LAX (second option)
    [unitFields.Subscription.id]: 0, // biweekly
    [unitFields.Status.id]: 0  // Active
  });
  
  console.log('\n✅ 2 units created');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== VIP MAPPING ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 VIP MAPPING');
  console.log('='.repeat(70));
  
  const vipMappingListId = lists['VIP Mapping'].id;
  const vipMappingFields = fields['VIP Mapping'];
  
  // VIP Mapping for John Smith
  await createTask(vipMappingListId, 'John Smith', {
    [vipMappingFields.customer_key.id]: 'CUST-001'
    // CX Owner would be assigned via user field (requires user ID)
  });
  
  console.log('\n✅ 1 VIP mapping created');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== MARKET OWNERSHIP ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 MARKET OWNERSHIP (Checking existing)');
  console.log('='.repeat(70));
  
  const marketOwnershipListId = lists['Market Ownership'].id;
  
  // Check if markets already exist
  const existingMarkets = await clickupRequest('GET', `/api/v2/list/${marketOwnershipListId}/task`);
  console.log(`\n✅ ${existingMarkets.tasks.length} markets already exist`);
  existingMarkets.tasks.forEach(t => console.log(`   - ${t.name}`));
  
  // ========== SUMMARY ==========
  console.log('\n' + '='.repeat(70));
  console.log('✅ TEST DATA CREATION COMPLETE!');
  console.log('='.repeat(70));
  console.log('\n📊 Summary:');
  console.log('   - 2 Customers: John Smith (VIP), Jane Doe (Standard)');
  console.log('   - 2 Units: Austin address, LA address');
  console.log('   - 1 VIP Mapping: John Smith');
  console.log('   - Market Ownership: Using existing records');
  console.log('\n🎯 All task names use clean primary identifiers');
  console.log('🎯 All metadata in custom fields');
  console.log('🎯 Alphabetically sortable in list views\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

