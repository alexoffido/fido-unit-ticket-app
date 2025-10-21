#!/usr/bin/env node

/**
 * Populate Field IDs in Manifest
 * Queries ClickUp API to get all field IDs and updates the manifest
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const MANIFEST_PATH = path.join(__dirname, '../../clickup/config/field_manifest.json');

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

async function getListFields(listId) {
  try {
    const response = await clickupRequest('GET', `/api/v2/list/${listId}/field`);
    return response.fields || [];
  } catch (error) {
    console.error(`Error fetching fields for list ${listId}: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('🔍 Populating Field IDs in Manifest\n');
  
  if (!CLICKUP_API_TOKEN) {
    console.error('❌ CLICKUP_API_TOKEN environment variable is required');
    process.exit(1);
  }
  
  // Read existing manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  
  console.log('📋 Fetching field IDs for all lists...\n');
  
  // Iterate through each list and fetch fields
  for (const [listName, listInfo] of Object.entries(manifest.lists)) {
    console.log(`📄 ${listName} (ID: ${listInfo.id})`);
    
    const fields = await getListFields(listInfo.id);
    
    // Update manifest with field IDs
    if (!manifest.fields[listName]) {
      manifest.fields[listName] = {};
    }
    
    for (const field of fields) {
      console.log(`   ✅ ${field.name} (ID: ${field.id}, Type: ${field.type})`);
      
      manifest.fields[listName][field.name] = {
        id: field.id,
        name: field.name,
        type: field.type
      };
    }
    
    console.log('');
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Update timestamp
  manifest.updated_at = new Date().toISOString();
  
  // Save updated manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  
  console.log('✅ Field manifest updated successfully!');
  console.log(`📁 Saved to: ${MANIFEST_PATH}`);
  
  // Count fields
  let totalFields = 0;
  for (const fields of Object.values(manifest.fields)) {
    totalFields += Object.keys(fields).length;
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Lists: ${Object.keys(manifest.lists).length}`);
  console.log(`   Total Fields: ${totalFields}`);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

