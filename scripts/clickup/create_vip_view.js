#!/usr/bin/env node

/**
 * Create "VIP Customers Missing CX Owner" Saved View
 * 
 * Creates a saved view in the Customers list that filters for:
 * - VIP = VIP
 * - Assignee is Empty
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

async function createView(listId, viewName, filters) {
  console.log(`📋 Creating saved view: ${viewName}`);
  
  const viewData = {
    name: viewName,
    type: 'list',
    grouping: {
      field: 'status',
      dir: 1
    },
    filters: filters,

    settings: {
      show_task_locations: false,
      show_subtasks: 3,
      show_subtask_parent_names: false,
      show_closed_subtasks: false,
      show_assignees: true,
      show_images: true,
      collapse_empty_columns: null,
      me_comments: true,
      me_subtasks: true,
      me_checklists: true
    }
  };
  
  const response = await clickupRequest('POST', `/api/v2/list/${listId}/view`, viewData);
  console.log(`   ✅ View created: ${response.view.id}`);
  return response;
}

async function main() {
  console.log('🔍 Creating VIP Customers Missing CX Owner View\n');
  
  const customersListId = manifest.lists.Customers.id;
  const vipFieldId = manifest.fields.Customers.VIP.id;
  
  console.log(`List: Customers (${customersListId})`);
  console.log(`VIP Field ID: ${vipFieldId}`);
  
  // Create filters for VIP = VIP AND Assignee is Empty
  const filters = {
    op: 'AND',
    fields: [
      {
        op: 'AND',
        field_id: vipFieldId,
        operator: '=',
        value: 0  // VIP (first option in dropdown)
      },
      {
        op: 'AND',
        field_id: 'assignee',
        operator: 'IS NULL',
        value: null
      }
    ],
    search: '',
    show_closed: false
  };
  
  const view = await createView(customersListId, 'VIP Customers Missing CX Owner', filters);
  
  console.log('\n✅ View Created Successfully!');
  console.log(`   View ID: ${view.view.id}`);
  console.log(`   View Name: ${view.view.name}`);
  console.log(`   Filters: VIP = VIP AND Assignee is Empty`);
  console.log('\n📊 This view will show all VIP customers without a CX owner assigned.');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

