#!/usr/bin/env node

/**
 * Inspect Existing CRM and Admin Spaces
 * 
 * This script inspects the existing CRM and Admin/Config spaces to determine
 * what lists, folders, and custom fields already exist before Phase 1 implementation.
 */

const https = require('https');

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const TEAM_ID = '9013484736';
const CRM_SPACE_ID = '901311352726';
const ADMIN_SPACE_ID = '901311352727';

if (!CLICKUP_API_TOKEN) {
  console.error('❌ CLICKUP_API_TOKEN environment variable is required');
  process.exit(1);
}

/**
 * Make ClickUp API request
 */
function clickupRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.clickup.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API request failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Inspect a space
 */
async function inspectSpace(spaceId, spaceName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Inspecting Space: ${spaceName}`);
  console.log(`   Space ID: ${spaceId}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Get space details
    const space = await clickupRequest(`/api/v2/space/${spaceId}`);
    console.log(`\n✅ Space Details:`);
    console.log(`   Name: ${space.name}`);
    console.log(`   Private: ${space.private}`);
    console.log(`   Statuses: ${space.statuses ? space.statuses.length : 0}`);
    console.log(`   Features: ${JSON.stringify(space.features || {})}`);

    // Get folders in space
    const foldersResponse = await clickupRequest(`/api/v2/space/${spaceId}/folder`);
    const folders = foldersResponse.folders || [];
    console.log(`\n📁 Folders: ${folders.length}`);
    
    if (folders.length > 0) {
      folders.forEach(folder => {
        console.log(`   - ${folder.name} (ID: ${folder.id})`);
        console.log(`     Lists: ${folder.lists ? folder.lists.length : 0}`);
      });
    }

    // Get lists in space (folderless)
    const listsResponse = await clickupRequest(`/api/v2/space/${spaceId}/list`);
    const lists = listsResponse.lists || [];
    console.log(`\n📋 Folderless Lists: ${lists.length}`);
    
    if (lists.length > 0) {
      for (const list of lists) {
        console.log(`\n   📄 List: ${list.name} (ID: ${list.id})`);
        console.log(`      Task Count: ${list.task_count || 0}`);
        console.log(`      Statuses: ${list.statuses ? list.statuses.length : 0}`);
        
        // Get custom fields for this list
        try {
          const fieldsResponse = await clickupRequest(`/api/v2/list/${list.id}/field`);
          const fields = fieldsResponse.fields || [];
          console.log(`      Custom Fields: ${fields.length}`);
          
          if (fields.length > 0) {
            fields.forEach(field => {
              console.log(`         - ${field.name} (${field.type}) [ID: ${field.id}]`);
            });
          }
        } catch (err) {
          console.log(`      Custom Fields: Error fetching - ${err.message}`);
        }
      }
    }

    return {
      space,
      folders,
      lists,
      isEmpty: folders.length === 0 && lists.length === 0
    };

  } catch (error) {
    console.error(`❌ Error inspecting space: ${error.message}`);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Starting inspection of existing ClickUp spaces...\n');

  // Inspect CRM space
  const crmResult = await inspectSpace(CRM_SPACE_ID, 'CRM');
  
  // Inspect Admin space
  const adminResult = await inspectSpace(ADMIN_SPACE_ID, 'Admin / Config');

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 INSPECTION SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  if (crmResult) {
    console.log(`\n🏢 CRM Space:`);
    console.log(`   Status: ${crmResult.isEmpty ? '✅ Empty (ready to use)' : '⚠️  Contains data'}`);
    console.log(`   Folders: ${crmResult.folders.length}`);
    console.log(`   Lists: ${crmResult.lists.length}`);
  }
  
  if (adminResult) {
    console.log(`\n⚙️  Admin / Config Space:`);
    console.log(`   Status: ${adminResult.isEmpty ? '✅ Empty (ready to use)' : '⚠️  Contains data'}`);
    console.log(`   Folders: ${adminResult.folders.length}`);
    console.log(`   Lists: ${adminResult.lists.length}`);
  }

  const bothEmpty = crmResult?.isEmpty && adminResult?.isEmpty;
  console.log(`\n🎯 Recommendation: ${bothEmpty ? '✅ Safe to proceed with Phase 1 using existing spaces' : '⚠️  Review existing data before proceeding'}`);
}

main().catch(console.error);

