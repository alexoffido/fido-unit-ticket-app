#!/usr/bin/env node

/**
 * Final Recreation of CRM Lists with Short Text Fields
 * 
 * Creates Customers, Units, and VIP Mapping lists with proper short_text field types
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
  console.log(`   📝 Creating field: ${fieldName} (${fieldType})`);
  const fieldData = {
    name: fieldName,
    type: fieldType
  };
  
  if (typeConfig) {
    fieldData.type_config = typeConfig;
  }
  
  const response = await clickupRequest('POST', `/api/v2/list/${listId}/field`, fieldData);
  console.log(`      ✅ ${response.id}`);
  return response;
}

async function main() {
  console.log('🔧 Creating CRM Lists with Short Text Fields\n');
  
  const crmSpaceId = manifest.spaces.crm.id;
  const results = {};
  
  // ========== CUSTOMERS LIST ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 CUSTOMERS LIST');
  console.log('='.repeat(70));
  
  const customersList = await createList(crmSpaceId, 'Customers', 'Customer master records with VIP status and market assignments');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const customersFields = {};
  customersFields.customer_key = await createField(customersList.id, 'customer_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  customersFields.bark_customer_id = await createField(customersList.id, 'bark_customer_id', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  customersFields.customer_name = await createField(customersList.id, 'Customer Name', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  customersFields.vip = await createField(customersList.id, 'VIP', 'drop_down', {
    options: settings.enums.vip_status.map((opt, idx) => ({
      name: opt,
      orderindex: idx,
      color: opt === 'VIP' ? '#FF6B6B' : '#4ECDC4'
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  customersFields.primary_markets = await createField(customersList.id, 'Primary Markets', 'labels', {
    options: settings.enums.markets.map((opt, idx) => ({
      label: opt,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  customersFields.status = await createField(customersList.id, 'Status', 'drop_down', {
    options: settings.enums.customer_status.map((opt, idx) => ({
      name: opt,
      orderindex: idx,
      color: opt === 'Active' ? '#95E1D3' : opt === 'Paused' ? '#F38181' : '#AA96DA'
    }))
  });
  
  results.Customers = { list: customersList, fields: customersFields };
  console.log(`\n✅ Customers list complete with ${Object.keys(customersFields).length} fields`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UNITS LIST ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 UNITS LIST');
  console.log('='.repeat(70));
  
  const unitsList = await createList(crmSpaceId, 'Units', 'Service unit records with addresses and subscription details');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const unitsFields = {};
  unitsFields.unit_key = await createField(unitsList.id, 'unit_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  unitsFields.bark_unit_id = await createField(unitsList.id, 'bark_unit_id', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  unitsFields.customer_key = await createField(unitsList.id, 'customer_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  unitsFields.address = await createField(unitsList.id, 'Address', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  unitsFields.market = await createField(unitsList.id, 'Market', 'drop_down', {
    options: settings.enums.markets.map((opt, idx) => ({
      name: opt,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  unitsFields.subscription = await createField(unitsList.id, 'Subscription', 'drop_down', {
    options: settings.enums.subscription_types.map((opt, idx) => ({
      name: opt,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  unitsFields.status = await createField(unitsList.id, 'Status', 'drop_down', {
    options: settings.enums.unit_status.map((opt, idx) => ({
      name: opt,
      orderindex: idx,
      color: opt === 'Active' ? '#95E1D3' : opt === 'Paused' ? '#F38181' : '#AA96DA'
    }))
  });
  
  results.Units = { list: unitsList, fields: unitsFields };
  console.log(`\n✅ Units list complete with ${Object.keys(unitsFields).length} fields`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== VIP MAPPING LIST ==========
  console.log('\n' + '='.repeat(70));
  console.log('📦 VIP MAPPING LIST');
  console.log('='.repeat(70));
  
  const vipMappingList = await createList(crmSpaceId, 'VIP Mapping', 'VIP customer to CX owner assignments');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const vipMappingFields = {};
  vipMappingFields.customer_key = await createField(vipMappingList.id, 'customer_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  vipMappingFields.cx_owner = await createField(vipMappingList.id, 'CX Owner', 'users');
  
  results['VIP Mapping'] = { list: vipMappingList, fields: vipMappingFields };
  console.log(`\n✅ VIP Mapping list complete with ${Object.keys(vipMappingFields).length} fields`);
  
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
    console.log(`✅ Updated ${listName} in manifest`);
  }
  
  manifest.updated_at = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Manifest saved: ${MANIFEST_PATH}`);
  
  // ========== SUMMARY ==========
  console.log('\n' + '='.repeat(70));
  console.log('✅ CRM LISTS RECREATION COMPLETE!');
  console.log('='.repeat(70));
  console.log('\n📊 Summary:');
  console.log(`   - Customers: ${results.Customers.list.id} (${Object.keys(results.Customers.fields).length} fields)`);
  console.log(`   - Units: ${results.Units.list.id} (${Object.keys(results.Units.fields).length} fields)`);
  console.log(`   - VIP Mapping: ${results['VIP Mapping'].list.id} (${Object.keys(results['VIP Mapping'].fields).length} fields)`);
  console.log('\n🎯 All single-line fields now use short_text type');
  console.log('🎯 Multi-line input prevented via Enter key');
  console.log('🎯 Ready for production data import\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

