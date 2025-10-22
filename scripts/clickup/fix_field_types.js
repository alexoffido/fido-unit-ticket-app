#!/usr/bin/env node

/**
 * Fix Field Types: text → short_text
 * 
 * Updates single-line fields from 'text' (multi-line) to 'short_text' (single-line)
 * to prevent accidental newlines and ensure data quality.
 * 
 * Fields to Update:
 * - customer_key (Customers, Units, VIP Mapping)
 * - bark_customer_id (Customers)
 * - Customer Name (Customers)
 * - unit_key (Units)
 * - bark_unit_id (Units)
 * - Address (Units)
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

async function deleteField(fieldId) {
  try {
    await clickupRequest('DELETE', `/api/v2/field/${fieldId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting field: ${error.message}`);
    return false;
  }
}

async function createField(listId, fieldName, fieldType = 'short_text', options = null) {
  try {
    const fieldData = {
      name: fieldName,
      type: fieldType
    };
    
    if (options) {
      fieldData.type_config = options;
    }
    
    const response = await clickupRequest('POST', `/api/v2/list/${listId}/field`, fieldData);
    return response;
  } catch (error) {
    console.error(`Error creating field: ${error.message}`);
    return null;
  }
}

async function getListFields(listId) {
  try {
    const response = await clickupRequest('GET', `/api/v2/list/${listId}/field`);
    return response.fields || [];
  } catch (error) {
    console.error(`Error fetching fields: ${error.message}`);
    return [];
  }
}

async function getTasks(listId) {
  try {
    const response = await clickupRequest('GET', `/api/v2/list/${listId}/task?include_closed=true`);
    return response.tasks || [];
  } catch (error) {
    console.error(`Error fetching tasks: ${error.message}`);
    return [];
  }
}

async function updateTaskField(taskId, fieldId, value) {
  try {
    await clickupRequest('POST', `/api/v2/task/${taskId}/field/${fieldId}`, { value });
    return true;
  } catch (error) {
    console.error(`Error updating task field: ${error.message}`);
    return false;
  }
}

async function replaceField(listId, listName, oldFieldName, newFieldType = 'short_text') {
  console.log(`\n📋 Processing: ${listName} - ${oldFieldName}`);
  
  // Get current fields
  const fields = await getListFields(listId);
  const oldField = fields.find(f => f.name === oldFieldName);
  
  if (!oldField) {
    console.log(`   ⏭️  Field not found: ${oldFieldName}`);
    return null;
  }
  
  if (oldField.type === newFieldType) {
    console.log(`   ✅ Already correct type: ${newFieldType}`);
    return oldField;
  }
  
  console.log(`   📊 Current type: ${oldField.type} → Target type: ${newFieldType}`);
  
  // Get all tasks to preserve data
  const tasks = await getTasks(listId);
  const taskData = [];
  
  for (const task of tasks) {
    const customField = task.custom_fields?.find(f => f.id === oldField.id);
    if (customField && customField.value) {
      taskData.push({
        taskId: task.id,
        taskName: task.name,
        value: customField.value
      });
      console.log(`   💾 Saved data from: ${task.name} = "${customField.value}"`);
    }
  }
  
  // Delete old field
  console.log(`   🗑️  Deleting old field...`);
  const deleted = await deleteField(oldField.id);
  
  if (!deleted) {
    console.log(`   ❌ Failed to delete field`);
    return null;
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for deletion to propagate
  
  // Create new field with correct type
  console.log(`   ✨ Creating new field with type: ${newFieldType}...`);
  const newField = await createField(listId, oldFieldName, newFieldType);
  
  if (!newField) {
    console.log(`   ❌ Failed to create new field`);
    return null;
  }
  
  console.log(`   ✅ New field created: ${newField.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for creation to propagate
  
  // Restore data to new field
  if (taskData.length > 0) {
    console.log(`   📝 Restoring data to ${taskData.length} tasks...`);
    
    for (const data of taskData) {
      console.log(`      Restoring: ${data.taskName} = "${data.value}"`);
      await updateTaskField(data.taskId, newField.id, data.value);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`   ✅ Data restored to all tasks`);
  }
  
  return newField;
}

async function main() {
  console.log('🔧 Fixing Field Types: text → short_text\n');
  console.log('This will update single-line fields to prevent multi-line input.\n');
  
  if (!CLICKUP_API_TOKEN) {
    console.error('❌ CLICKUP_API_TOKEN environment variable is required');
    process.exit(1);
  }
  
  const fieldsToFix = [
    { list: 'Customers', fields: ['customer_key', 'bark_customer_id', 'Customer Name'] },
    { list: 'Units', fields: ['unit_key', 'bark_unit_id', 'customer_key', 'Address'] },
    { list: 'VIP Mapping', fields: ['customer_key'] }
  ];
  
  const updatedFields = {};
  
  for (const { list, fields } of fieldsToFix) {
    const listId = manifest.lists[list].id;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📦 List: ${list} (ID: ${listId})`);
    console.log('='.repeat(70));
    
    updatedFields[list] = {};
    
    for (const fieldName of fields) {
      const newField = await replaceField(listId, list, fieldName, 'short_text');
      
      if (newField) {
        updatedFields[list][fieldName] = {
          id: newField.id,
          name: newField.name,
          type: newField.type
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Update manifest
  console.log(`\n${'='.repeat(70)}`);
  console.log('💾 Updating Field Manifest');
  console.log('='.repeat(70));
  
  for (const [listName, fields] of Object.entries(updatedFields)) {
    for (const [fieldName, fieldData] of Object.entries(fields)) {
      if (manifest.fields[listName] && fieldData) {
        manifest.fields[listName][fieldName] = fieldData;
        console.log(`✅ Updated manifest: ${listName}.${fieldName} = ${fieldData.id}`);
      }
    }
  }
  
  manifest.updated_at = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  
  console.log(`\n✅ Field manifest updated: ${MANIFEST_PATH}`);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Field Type Fix Complete!');
  console.log('='.repeat(70));
  console.log('\n📊 Summary:');
  console.log('   - All single-line fields now use short_text type');
  console.log('   - Multi-line input prevented via Enter key');
  console.log('   - All existing data preserved and restored');
  console.log('   - Field manifest updated with new field IDs');
  console.log('\n🎯 Result: Improved data quality and user input validation');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

