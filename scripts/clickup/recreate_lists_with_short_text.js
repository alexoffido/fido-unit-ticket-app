#!/usr/bin/env node

/**
 * Recreate Lists with Correct Field Types
 * 
 * Deletes and recreates Customers, Units, and VIP Mapping lists
 * with short_text field types instead of text to prevent multi-line input.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const MANIFEST_PATH = path.join(__dirname, '../../clickup/config/field_manifest.json');
const SETTINGS_PATH = path.join(__dirname, '../../clickup/config/settings.json');

// Load manifest and settings
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

async function deleteList(listId, listName) {
  console.log(`🗑️  Deleting list: ${listName} (${listId})`);
  try {
    await clickupRequest('DELETE', `/api/v2/list/${listId}`);
    console.log(`   ✅ Deleted successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function createList(spaceId, listName) {
  console.log(`✨ Creating list: ${listName}`);
  try {
    const response = await clickupRequest('POST', `/api/v2/space/${spaceId}/list`, {
      name: listName,
      content: '',
      due_date_time: false,
      priority: false
    });
    console.log(`   ✅ Created: ${response.id}`);
    return response;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function createField(listId, fieldName, fieldType, typeConfig = null) {
  console.log(`   📝 Creating field: ${fieldName} (${fieldType})`);
  try {
    const fieldData = {
      name: fieldName,
      type: fieldType
    };
    
    if (typeConfig) {
      fieldData.type_config = typeConfig;
    }
    
    const response = await clickupRequest('POST', `/api/v2/list/${listId}/field`, fieldData);
    console.log(`      ✅ Created: ${response.id}`);
    return response;
  } catch (error) {
    console.error(`      ❌ Error: ${error.message}`);
    return null;
  }
}

async function recreateCustomersList(spaceId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('📦 CUSTOMERS LIST');
  console.log('='.repeat(70));
  
  // Delete old list
  const oldListId = manifest.lists.Customers.id;
  await deleteList(oldListId, 'Customers');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create new list
  const newList = await createList(spaceId, 'Customers');
  if (!newList) return null;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create fields with correct types
  const fields = {};
  
  fields.customer_key = await createField(newList.id, 'customer_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.bark_customer_id = await createField(newList.id, 'bark_customer_id', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.customer_name = await createField(newList.id, 'Customer Name', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.vip = await createField(newList.id, 'VIP', 'drop_down', {
    options: settings.enums.vip_status.map((opt, idx) => ({
      name: opt,
      orderindex: idx,
      color: opt === 'VIP' ? '#FF6B6B' : '#4ECDC4'
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.primary_markets = await createField(newList.id, 'Primary Markets', 'labels', {
    options: settings.enums.markets.map((opt, idx) => ({
      label: opt,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.status = await createField(newList.id, 'Status', 'drop_down', {
    options: settings.enums.customer_status.map((opt, idx) => ({
      name: opt,
      orderindex: idx,
      color: opt === 'Active' ? '#95E1D3' : opt === 'Paused' ? '#F38181' : '#AA96DA'
    }))
  });
  
  console.log(`✅ Customers list recreated with ${Object.keys(fields).length} fields`);
  return { list: newList, fields };
}

async function recreateUnitsList(spaceId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('📦 UNITS LIST');
  console.log('='.repeat(70));
  
  // Delete old list
  const oldListId = manifest.lists.Units.id;
  await deleteList(oldListId, 'Units');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create new list
  const newList = await createList(spaceId, 'Units');
  if (!newList) return null;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create fields with correct types
  const fields = {};
  
  fields.unit_key = await createField(newList.id, 'unit_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.bark_unit_id = await createField(newList.id, 'bark_unit_id', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.customer_key = await createField(newList.id, 'customer_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.address = await createField(newList.id, 'Address', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.market = await createField(newList.id, 'Market', 'drop_down', {
    options: settings.enums.markets.map((opt, idx) => ({
      name: opt,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.subscription = await createField(newList.id, 'Subscription', 'drop_down', {
    options: settings.enums.subscription_types.map((opt, idx) => ({
      name: opt,
      orderindex: idx
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.status = await createField(newList.id, 'Status', 'drop_down', {
    options: settings.enums.unit_status.map((opt, idx) => ({
      name: opt,
      orderindex: idx,
      color: opt === 'Active' ? '#95E1D3' : opt === 'Paused' ? '#F38181' : '#AA96DA'
    }))
  });
  
  console.log(`✅ Units list recreated with ${Object.keys(fields).length} fields`);
  return { list: newList, fields };
}

async function recreateVIPMappingList(spaceId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('📦 VIP MAPPING LIST');
  console.log('='.repeat(70));
  
  // Delete old list
  const oldListId = manifest.lists['VIP Mapping'].id;
  await deleteList(oldListId, 'VIP Mapping');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create new list
  const newList = await createList(spaceId, 'VIP Mapping');
  if (!newList) return null;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create fields with correct types
  const fields = {};
  
  fields.customer_key = await createField(newList.id, 'customer_key', 'short_text');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  fields.cx_owner = await createField(newList.id, 'CX Owner', 'users');
  
  console.log(`✅ VIP Mapping list recreated with ${Object.keys(fields).length} fields`);
  return { list: newList, fields };
}

async function main() {
  console.log('🔧 Recreating Lists with Correct Field Types\n');
  console.log('This will delete and recreate 3 lists with short_text instead of text.\n');
  
  if (!CLICKUP_API_TOKEN) {
    console.error('❌ CLICKUP_API_TOKEN environment variable is required');
    process.exit(1);
  }
  
  const crmSpaceId = manifest.spaces.crm.id;
  
  // Recreate all 3 lists
  const customers = await recreateCustomersList(crmSpaceId);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const units = await recreateUnitsList(crmSpaceId);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const vipMapping = await recreateVIPMappingList(crmSpaceId);
  
  // Update manifest
  console.log(`\n${'='.repeat(70)}`);
  console.log('💾 Updating Field Manifest');
  console.log('='.repeat(70));
  
  if (customers) {
    manifest.lists.Customers = {
      id: customers.list.id,
      name: customers.list.name,
      space_id: crmSpaceId
    };
    
    manifest.fields.Customers = {};
    for (const [key, field] of Object.entries(customers.fields)) {
      if (field) {
        manifest.fields.Customers[field.name] = {
          id: field.id,
          name: field.name,
          type: field.type
        };
      }
    }
    console.log(`✅ Updated Customers in manifest`);
  }
  
  if (units) {
    manifest.lists.Units = {
      id: units.list.id,
      name: units.list.name,
      space_id: crmSpaceId
    };
    
    manifest.fields.Units = {};
    for (const [key, field] of Object.entries(units.fields)) {
      if (field) {
        manifest.fields.Units[field.name] = {
          id: field.id,
          name: field.name,
          type: field.type
        };
      }
    }
    console.log(`✅ Updated Units in manifest`);
  }
  
  if (vipMapping) {
    manifest.lists['VIP Mapping'] = {
      id: vipMapping.list.id,
      name: vipMapping.list.name,
      space_id: crmSpaceId
    };
    
    manifest.fields['VIP Mapping'] = {};
    for (const [key, field] of Object.entries(vipMapping.fields)) {
      if (field) {
        manifest.fields['VIP Mapping'][field.name] = {
          id: field.id,
          name: field.name,
          type: field.type
        };
      }
    }
    console.log(`✅ Updated VIP Mapping in manifest`);
  }
  
  manifest.updated_at = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  
  console.log(`\n✅ Field manifest updated: ${MANIFEST_PATH}`);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ List Recreation Complete!');
  console.log('='.repeat(70));
  console.log('\n📊 Summary:');
  console.log('   - 3 lists deleted and recreated');
  console.log('   - All text fields now use short_text type');
  console.log('   - Multi-line input prevented');
  console.log('   - Field manifest updated with new IDs');
  console.log('\n🎯 Result: Clean lists with proper field types for data quality');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

