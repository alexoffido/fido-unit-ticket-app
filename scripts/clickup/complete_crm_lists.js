#!/usr/bin/env node

/**
 * Complete CRM Lists Creation
 * 
 * Continues from existing Customers list (with 3 fields already created)
 * Adds remaining fields to Customers, then creates Units and VIP Mapping
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const MANIFEST_PATH = path.join(__dirname, '../../clickup/config/field_manifest.json');
const SETTINGS_PATH = path.join(__dirname, '../../clickup/config/settings.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));

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

async function createList(spaceId, listName, content) {
  console.log(`\n✨ Creating list: ${listName}`);
  const response = await clickupRequest('POST', `/api/v2/space/${spaceId}/list`, {
    name: listName,
    content: content
  });
  console.log(`   ✅ Created: ${response.id}`);
  return response;
}

async function createField(listId, fieldName, fieldType, typeConfig = null) {
  console.log(`   📝 ${fieldName} (${fieldType})`);
  const fieldData = {
    name: fieldName,
    type: fieldType
  };
  
  if (typeConfig) {
    fieldData.type_config = typeConfig;
  }
  
  const response = await clickupRequest('POST', `/api/v2/list/${listId}/field`, fieldData);
  return response;
}

async function getListFields(listId) {
  const response = await clickupRequest('GET', `/api/v2/list/${listId}/field`);
  return response.fields || [];
}

async function main() {
  console.log('🔧 Completing CRM Lists Creation\n');
  
  const crmSpaceId = manifest.spaces.crm.id;
  const results = {};
  
  // ========== COMPLETE CUSTOMERS LIST ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 CUSTOMERS LIST (Completing)');
  console.log('='.repeat(70));
  
  const customersListId = '901321549787';
  console.log(`Using existing list: ${customersListId}`);
  
  // Get existing fields
  const existingFields = await getListFields(customersListId);
  console.log(`\n✅ Existing fields: ${existingFields.length}`);
  existingFields.forEach(f => console.log(`   - ${f.name} (${f.type})`));
  
  console.log(`\n📝 Adding remaining fields...`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const customersFields = {};
  
  // Store existing fields
  existingFields.forEach(f => {
    customersFields[f.name] = f;
  });
  
  // Add remaining fields
  customersFields.vip = await createField(customersListId, 'VIP', 'drop_down', {
    options: settings.vip_levels.map((opt, idx) => ({
      name: opt.value,
      orderindex: idx,
      color: opt.color
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 700));
  
  customersFields.primary_markets = await createField(customersListId, 'Primary Markets', 'labels', {
    options: settings.markets.map((opt, idx) => ({
      label: opt.code,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 700));
  
  customersFields.status = await createField(customersListId, 'Status', 'drop_down', {
    options: settings.statuses.map((opt, idx) => ({
      name: opt.value,
      orderindex: idx,
      color: opt.color
    }))
  });
  
  results.Customers = { list: { id: customersListId, name: 'Customers' }, fields: customersFields };
  console.log(`\n✅ Customers: ${Object.keys(customersFields).length} total fields`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UNITS LIST ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 UNITS LIST');
  console.log('='.repeat(70));
  
  const unitsList = await createList(crmSpaceId, 'Units', 'Service unit records with addresses and subscription details');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const unitsFields = {};
  unitsFields.unit_key = await createField(unitsList.id, 'unit_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 700));
  
  unitsFields.bark_unit_id = await createField(unitsList.id, 'bark_unit_id', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 700));
  
  unitsFields.customer_key = await createField(unitsList.id, 'customer_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 700));
  
  unitsFields.address = await createField(unitsList.id, 'Address', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 700));
  
  unitsFields.market = await createField(unitsList.id, 'Market', 'drop_down', {
    options: settings.markets.map((opt, idx) => ({
      name: opt.code,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 700));
  
  unitsFields.subscription = await createField(unitsList.id, 'Subscription', 'drop_down', {
    options: settings.subscriptions.map((opt, idx) => ({
      name: opt.value,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 700));
  
  unitsFields.status = await createField(unitsList.id, 'Status', 'drop_down', {
    options: settings.statuses.map((opt, idx) => ({
      name: opt.value,
      orderindex: idx,
      color: opt.color
    }))
  });
  
  results.Units = { list: unitsList, fields: unitsFields };
  console.log(`\n✅ Units: ${Object.keys(unitsFields).length} fields created`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== VIP MAPPING LIST ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 VIP MAPPING LIST');
  console.log('='.repeat(70));
  
  const vipMappingList = await createList(crmSpaceId, 'VIP Mapping', 'VIP customer to CX owner assignments');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const vipMappingFields = {};
  vipMappingFields.customer_key = await createField(vipMappingList.id, 'customer_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 700));
  
  vipMappingFields.cx_owner = await createField(vipMappingList.id, 'CX Owner', 'users');
  
  results['VIP Mapping'] = { list: vipMappingList, fields: vipMappingFields };
  console.log(`\n✅ VIP Mapping: ${Object.keys(vipMappingFields).length} fields created`);
  
  // ========== UPDATE MANIFEST ==========
  console.log('\n' + '='.repeat(70));
  console.log('💾 UPDATING FIELD MANIFEST');
  console.log('='.repeat(70));
  
  for (const [listName, data] of Object.entries(results)) {
    manifest.lists[listName] = {
      id: data.list.id,
      name: data.list.name,
      space: 'crm'
    };
    
    manifest.fields[listName] = {};
    for (const [key, field] of Object.entries(data.fields)) {
      manifest.fields[listName][field.name] = {
        id: field.id,
        name: field.name,
        type: field.type
      };
    }
    console.log(`✅ ${listName}`);
  }
  
  manifest.updated_at = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Manifest saved`);
  
  // ========== SUMMARY ==========
  console.log('\n' + '='.repeat(70));
  console.log('✅ CRM LISTS COMPLETE!');
  console.log('='.repeat(70));
  console.log('\n📊 Summary:');
  console.log(`   - Customers: ${results.Customers.list.id} (${Object.keys(results.Customers.fields).length} fields)`);
  console.log(`   - Units: ${results.Units.list.id} (${Object.keys(results.Units.fields).length} fields)`);
  console.log(`   - VIP Mapping: ${results['VIP Mapping'].list.id} (${Object.keys(results['VIP Mapping'].fields).length} fields)`);
  console.log('\n🎯 All single-line fields use short_text type');
  console.log('🎯 Multi-line input prevented');
  console.log('🎯 Ready for production data\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

