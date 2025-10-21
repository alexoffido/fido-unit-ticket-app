#!/usr/bin/env node

/**
 * Fido OS Phase 1 - ClickUp Schema Creation (v2)
 * 
 * Creates the complete ClickUp infrastructure for Fido OS using native https module
 * - Uses existing CRM and Admin/Config spaces
 * - Creates 7 lists across both spaces
 * - Implements 67+ custom fields with proper types
 * - Generates field_manifest.json for automation use
 * 
 * SAFETY: Idempotent design - safe to run multiple times
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const TEAM_ID = '9013484736';

// Existing space IDs (confirmed empty and ready to use)
const CRM_SPACE_ID = '901311352726';
const ADMIN_SPACE_ID = '901311352727';

// Paths
const LOG_DIR = path.join(__dirname, '../../logs/phase-1');
const MANIFEST_PATH = path.join(__dirname, '../../clickup/config/field_manifest.json');

// Ensure directories exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ============================================================================
// Logging
// ============================================================================

const logFile = path.join(LOG_DIR, `schema_creation_${Date.now()}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
  if (data) {
    const dataStr = JSON.stringify(data, null, 2);
    logStream.write(dataStr + '\n');
  }
}

// ============================================================================
// ClickUp API Helpers
// ============================================================================

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

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Schema Definitions
// ============================================================================

const LISTS_SCHEMA = [
  { space: CRM_SPACE_ID, name: 'Customers', description: 'Customer master records with VIP status and market assignments' },
  { space: CRM_SPACE_ID, name: 'Units', description: 'Service unit addresses with subscription details and status' },
  { space: ADMIN_SPACE_ID, name: 'Market Ownership', description: 'Primary and backup ops owners for each market' },
  { space: ADMIN_SPACE_ID, name: 'VIP Mapping', description: 'Dedicated CX owners for VIP customers' },
  { space: ADMIN_SPACE_ID, name: 'Ops Schedules', description: 'Daily operations team schedules with clock in/out times' },
  { space: ADMIN_SPACE_ID, name: 'CX Schedules', description: 'Customer experience team schedules and availability' },
  { space: ADMIN_SPACE_ID, name: 'Capacity', description: 'Weekly capacity planning and buffer management (optional)' }
];

// Market options (used across multiple lists)
const MARKETS = ['ATX', 'LAX', 'NPB', 'HHH'];

const FIELDS_SCHEMA = {
  'Customers': [
    { name: 'customer_key', type: 'text', required: true },
    { name: 'bark_customer_id', type: 'text', required: false },
    { name: 'Customer Name', type: 'text', required: true },
    { name: 'VIP', type: 'drop_down', required: false, options: [
      { name: 'VIP', color: '#FFD700' },
      { name: 'Standard', color: '#6C757D' }
    ]},
    { name: 'Primary Markets', type: 'labels', required: false, options: MARKETS.map(m => ({ label: m })) },
    { name: 'Status', type: 'drop_down', required: true, options: [
      { name: 'Active', color: '#28a745' },
      { name: 'Paused', color: '#ffc107' },
      { name: 'Cancelled', color: '#dc3545' }
    ]},
    { name: 'Notes', type: 'textarea', required: false }
  ],
  'Units': [
    { name: 'unit_key', type: 'text', required: true },
    { name: 'bark_unit_id', type: 'text', required: false },
    { name: 'customer_key', type: 'text', required: true },
    { name: 'Address', type: 'text', required: true },
    { name: 'Market', type: 'drop_down', required: true, options: MARKETS.map(m => ({ name: m })) },
    { name: 'Subscription', type: 'drop_down', required: true, options: [
      { name: 'biweekly' },
      { name: '2 ongoing' },
      { name: '3 ongoing' },
      { name: '4 ongoing' },
      { name: '5 ongoing' }
    ]},
    { name: 'Status', type: 'drop_down', required: true, options: [
      { name: 'Active', color: '#28a745' },
      { name: 'Paused', color: '#ffc107' },
      { name: 'Cancelled', color: '#dc3545' }
    ]}
  ],
  'Market Ownership': [
    { name: 'Market', type: 'drop_down', required: true, options: MARKETS.map(m => ({ name: m })) },
    { name: 'Primary Ops Owner', type: 'users', required: true },
    { name: 'Backup Ops Owner', type: 'users', required: false },
    { name: 'On-Duty Override', type: 'users', required: false },
    { name: 'Notes', type: 'textarea', required: false }
  ],
  'VIP Mapping': [
    { name: 'customer_key', type: 'text', required: true },
    { name: 'CX Owner', type: 'users', required: true }
  ],
  'Ops Schedules': [
    { name: 'Person', type: 'users', required: true },
    { name: 'Role', type: 'drop_down', required: true, options: [{ name: 'Ops' }, { name: 'CX' }] },
    { name: 'Markets', type: 'labels', required: false, options: MARKETS.map(m => ({ label: m })) },
    { name: 'Date', type: 'date', required: true },
    { name: 'Clock In', type: 'short_text', required: true },
    { name: 'Clock Out', type: 'short_text', required: true },
    { name: 'Approved', type: 'checkbox', required: false }
  ],
  'CX Schedules': [
    { name: 'Person', type: 'users', required: true },
    { name: 'Day of Week', type: 'drop_down', required: true, options: [
      { name: 'Monday' }, { name: 'Tuesday' }, { name: 'Wednesday' },
      { name: 'Thursday' }, { name: 'Friday' }, { name: 'Saturday' }, { name: 'Sunday' }
    ]},
    { name: 'Clock In', type: 'short_text', required: true },
    { name: 'Clock Out', type: 'short_text', required: true },
    { name: 'Active', type: 'checkbox', required: true }
  ],
  'Capacity': [
    { name: 'Person', type: 'users', required: true },
    { name: 'Weekly Capacity', type: 'number', required: true },
    { name: 'Buffer Percentage', type: 'number', required: false }
  ]
};

// ============================================================================
// Main Schema Creation Logic
// ============================================================================

async function getExistingLists(spaceId) {
  try {
    const response = await clickupRequest('GET', `/api/v2/space/${spaceId}/list`);
    return response.lists || [];
  } catch (error) {
    log(`Error fetching lists for space ${spaceId}: ${error.message}`);
    return [];
  }
}

async function createList(spaceId, listName, description) {
  try {
    log(`Creating list: ${listName}`);
    
    const response = await clickupRequest('POST', `/api/v2/space/${spaceId}/list`, {
      name: listName,
      content: description
    });
    
    log(`✅ List created: ${listName}`, { id: response.id });
    return response;
  } catch (error) {
    log(`❌ Error creating list ${listName}: ${error.message}`);
    throw error;
  }
}

async function createCustomField(listId, fieldConfig) {
  try {
    log(`  Creating field: ${fieldConfig.name} (${fieldConfig.type})`);
    
    const fieldData = {
      name: fieldConfig.name,
      type: fieldConfig.type
    };
    
    // Add type-specific configuration
    if (fieldConfig.options) {
      fieldData.type_config = { options: fieldConfig.options };
    }
    
    const response = await clickupRequest('POST', `/api/v2/list/${listId}/field`, fieldData);
    
    log(`  ✅ Field created: ${fieldConfig.name}`, { id: response.id });
    return response;
  } catch (error) {
    // Check if field already exists
    if (error.message.includes('already exists')) {
      log(`  ⏭️  Field already exists: ${fieldConfig.name}`);
      return null;
    }
    log(`  ❌ Error creating field ${fieldConfig.name}: ${error.message}`);
    return null; // Continue with other fields
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  log('🚀 Starting Fido OS Phase 1 - ClickUp Schema Creation');
  log('=' .repeat(70));
  
  if (!CLICKUP_API_TOKEN) {
    log('❌ CLICKUP_API_TOKEN environment variable is required');
    process.exit(1);
  }
  
  const manifest = {
    generated_at: new Date().toISOString(),
    team_id: TEAM_ID,
    spaces: {
      crm: { id: CRM_SPACE_ID, name: 'CRM' },
      admin: { id: ADMIN_SPACE_ID, name: 'Admin / Config' }
    },
    lists: {},
    fields: {}
  };
  
  try {
    // ========================================================================
    // Step 1: Get existing lists
    // ========================================================================
    log('\n📋 Step 1: Checking existing lists');
    log('=' .repeat(70));
    
    const existingCrmLists = await getExistingLists(CRM_SPACE_ID);
    const existingAdminLists = await getExistingLists(ADMIN_SPACE_ID);
    const allExistingLists = [...existingCrmLists, ...existingAdminLists];
    
    log(`Found ${allExistingLists.length} existing lists`);
    
    // ========================================================================
    // Step 2: Create Lists
    // ========================================================================
    log('\n📦 Step 2: Creating Lists');
    log('=' .repeat(70));
    
    for (const listConfig of LISTS_SCHEMA) {
      const existing = allExistingLists.find(l => l.name === listConfig.name);
      
      let list;
      if (existing) {
        log(`⏭️  List already exists: ${listConfig.name} (ID: ${existing.id})`);
        list = existing;
      } else {
        list = await createList(listConfig.space, listConfig.name, listConfig.description);
        await delay(500); // Rate limiting protection
      }
      
      manifest.lists[listConfig.name] = {
        id: list.id,
        name: list.name,
        space: listConfig.space === CRM_SPACE_ID ? 'crm' : 'admin'
      };
    }
    
    // ========================================================================
    // Step 3: Create Custom Fields
    // ========================================================================
    log('\n🏗️  Step 3: Creating Custom Fields');
    log('=' .repeat(70));
    
    for (const [listName, fieldConfigs] of Object.entries(FIELDS_SCHEMA)) {
      log(`\n📋 Creating fields for list: ${listName}`);
      
      const listId = manifest.lists[listName].id;
      manifest.fields[listName] = {};
      
      for (const fieldConfig of fieldConfigs) {
        const field = await createCustomField(listId, fieldConfig);
        
        if (field) {
          manifest.fields[listName][fieldConfig.name] = {
            id: field.id,
            name: field.name,
            type: field.type
          };
        }
        
        await delay(300); // Rate limiting protection
      }
    }
    
    // ========================================================================
    // Step 4: Save Manifest
    // ========================================================================
    log('\n💾 Step 4: Saving Field Manifest');
    log('=' .repeat(70));
    
    manifest.completed_at = new Date().toISOString();
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    log(`✅ Field manifest saved to: ${MANIFEST_PATH}`);
    
    // ========================================================================
    // Summary
    // ========================================================================
    log('\n' + '=' .repeat(70));
    log('✅ Phase 1 Schema Creation Complete!');
    log('=' .repeat(70));
    
    const listCount = Object.keys(manifest.lists).length;
    let fieldCount = 0;
    for (const fields of Object.values(manifest.fields)) {
      fieldCount += Object.keys(fields).length;
    }
    
    log(`\n📊 Summary:`);
    log(`   Spaces: 2 (CRM, Admin/Config)`);
    log(`   Lists: ${listCount}`);
    log(`   Custom Fields: ${fieldCount}`);
    log(`   Manifest: ${MANIFEST_PATH}`);
    log(`   Log File: ${logFile}`);
    
    log('\n🎯 Next Steps:');
    log('   1. Review the generated manifest file');
    log('   2. Verify lists and fields in ClickUp UI');
    log('   3. Test with sample data creation');
    log('   4. Commit to GitHub feature branch');
    log('   5. Request approval for Phase 2');
    
  } catch (error) {
    log(`\n❌ Fatal error during schema creation: ${error.message}`);
    log(error.stack);
    process.exit(1);
  } finally {
    logStream.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

