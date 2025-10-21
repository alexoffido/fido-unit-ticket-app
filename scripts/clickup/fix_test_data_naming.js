#!/usr/bin/env node

/**
 * Fix Test Data Naming Convention
 * Updates existing test data to use proper customer/unit names as task titles
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

async function getTasks(listId) {
  try {
    const response = await clickupRequest('GET', `/api/v2/list/${listId}/task?include_closed=true`);
    return response.tasks || [];
  } catch (error) {
    console.error(`Error fetching tasks: ${error.message}`);
    return [];
  }
}

async function updateTask(taskId, updates) {
  try {
    const response = await clickupRequest('PUT', `/api/v2/task/${taskId}`, updates);
    return response;
  } catch (error) {
    console.error(`Error updating task ${taskId}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔧 Fixing Test Data Naming Convention\n');
  
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
  
  console.log('📋 Updating Customer Names...\n');
  
  // Get all customer tasks
  const customerTasks = await getTasks(customersListId);
  
  for (const task of customerTasks) {
    // Find the Customer Name custom field value
    const customerNameField = task.custom_fields?.find(f => f.id === customerFields['Customer Name'].id);
    const customerName = customerNameField?.value;
    
    if (customerName && task.name !== customerName) {
      console.log(`Updating: "${task.name}" → "${customerName}"`);
      await updateTask(task.id, { name: customerName });
      console.log(`✅ Updated to: ${customerName}\n`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('📋 Updating Unit Names...\n');
  
  // Get all unit tasks
  const unitTasks = await getTasks(unitsListId);
  const unitFields = manifest.fields['Units'];
  
  for (const task of unitTasks) {
    // Find the Address custom field value
    const addressField = task.custom_fields?.find(f => f.id === unitFields['Address'].id);
    const address = addressField?.value;
    
    if (address && task.name !== address) {
      console.log(`Updating: "${task.name}" → "${address}"`);
      await updateTask(task.id, { name: address });
      console.log(`✅ Updated to: ${address}\n`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('📋 Updating Market Ownership Names...\n');
  
  // Get all market ownership tasks
  const marketTasks = await getTasks(marketOwnershipListId);
  const marketFields = manifest.fields['Market Ownership'];
  
  const markets = ['ATX', 'LAX', 'NPB', 'HHH'];
  
  for (const task of marketTasks) {
    // Find the Market custom field value
    const marketField = task.custom_fields?.find(f => f.id === marketFields['Market'].id);
    const marketValue = marketField?.value;
    
    if (marketValue !== null && marketValue !== undefined) {
      // ClickUp returns dropdown index, convert to market name
      const marketIndex = typeof marketValue === 'number' ? marketValue : parseInt(marketValue);
      const marketName = markets[marketIndex] || marketValue;
      
      if (task.name !== marketName && typeof marketName === 'string') {
        console.log(`Updating: "${task.name}" → "${marketName}"`);
        await updateTask(task.id, { name: marketName });
        console.log(`✅ Updated to: ${marketName}\n`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  console.log('📋 Updating VIP Mapping Names...\n');
  
  // Get all VIP mapping tasks
  const vipTasks = await getTasks(vipMappingListId);
  const vipFields = manifest.fields['VIP Mapping'];
  
  for (const task of vipTasks) {
    // Find the customer_key custom field value
    const customerKeyField = task.custom_fields?.find(f => f.id === vipFields['customer_key'].id);
    const customerKey = customerKeyField?.value;
    
    if (customerKey) {
      // Find the corresponding customer name
      const customer = customerTasks.find(c => {
        const keyField = c.custom_fields?.find(f => f.id === customerFields['customer_key'].id);
        return keyField?.value === customerKey;
      });
      
      if (customer) {
        const customerNameField = customer.custom_fields?.find(f => f.id === customerFields['Customer Name'].id);
        const customerName = customerNameField?.value;
        
        if (customerName && task.name !== customerName) {
          console.log(`Updating: "${task.name}" → "${customerName}"`);
          await updateTask(task.id, { name: customerName });
          console.log(`✅ Updated to: ${customerName}\n`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  }
  
  console.log('✅ Test data naming convention fixed!');
  console.log('\n📊 Summary:');
  console.log('   - Customer names now show as task titles');
  console.log('   - Unit addresses now show as task titles');
  console.log('   - Market codes now show as task titles');
  console.log('   - VIP mappings now show customer names');
  console.log('\n🎯 Result: Clean, alphabetically sortable list views');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

