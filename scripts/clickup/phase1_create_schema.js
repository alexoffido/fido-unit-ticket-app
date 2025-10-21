/**
 * Fido OS Phase 1 - ClickUp Schema Creation Script
 * Creates CRM and Admin/Config spaces with all required lists and custom fields
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load configuration
const settings = require('../../clickup/config/settings.json');

// Environment configuration
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_TEAM_ID = process.env.CLICKUP_TEAM_ID || '9013484736';
const LOG_DIR = path.join(__dirname, '../../logs/phase-1');
const MANIFEST_PATH = path.join(__dirname, '../../clickup/config/field_manifest.json');

// Ensure directories exist
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ClickUp API client
const clickupClient = axios.create({
    baseURL: 'https://api.clickup.com/api/v2',
    headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
    }
});

// Global manifest to track all created IDs
let manifest = {
    created_at: new Date().toISOString(),
    team_id: CLICKUP_TEAM_ID,
    spaces: {},
    lists: {},
    fields: {},
    relations: {}
};

/**
 * Log API operations with sanitized responses
 */
function logOperation(operation, request, response, error = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        operation,
        success: !error,
        request: {
            method: request.method,
            url: request.url,
            data: request.data
        },
        response: error ? null : {
            status: response.status,
            data: response.data
        },
        error: error ? {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        } : null
    };
    
    const logFile = path.join(LOG_DIR, 'schema_creation.log');
    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + '\n');
    
    return logEntry;
}

/**
 * Create a ClickUp space
 */
async function createSpace(spaceName, isPrivate = true) {
    console.log(`📁 Creating space: ${spaceName}`);
    
    const requestData = {
        name: spaceName,
        multiple_assignees: true,
        features: {
            due_dates: { enabled: true },
            time_tracking: { enabled: true },
            tags: { enabled: true },
            time_estimates: { enabled: true },
            checklists: { enabled: true },
            custom_fields: { enabled: true },
            remap_dependencies: { enabled: true },
            dependency_warning: { enabled: true },
            portfolios: { enabled: true }
        }
    };
    
    try {
        const response = await clickupClient.post(`/team/${CLICKUP_TEAM_ID}/space`, requestData);
        logOperation('create_space', { method: 'POST', url: `/team/${CLICKUP_TEAM_ID}/space`, data: requestData }, response);
        
        const space = response.data;
        manifest.spaces[spaceName.toLowerCase().replace(/[^a-z0-9]/g, '_')] = {
            id: space.id,
            name: space.name,
            private: isPrivate
        };
        
        console.log(`✅ Created space: ${space.name} (ID: ${space.id})`);
        return space;
        
    } catch (error) {
        // Check if space already exists
        if (error.response?.status === 400 && error.response?.data?.err?.includes('already exists')) {
            console.log(`⚠️  Space "${spaceName}" already exists, fetching existing space...`);
            
            try {
                const spacesResponse = await clickupClient.get(`/team/${CLICKUP_TEAM_ID}/space`);
                const existingSpace = spacesResponse.data.spaces.find(s => s.name === spaceName);
                
                if (existingSpace) {
                    manifest.spaces[spaceName.toLowerCase().replace(/[^a-z0-9]/g, '_')] = {
                        id: existingSpace.id,
                        name: existingSpace.name,
                        private: isPrivate,
                        existing: true
                    };
                    
                    console.log(`✅ Using existing space: ${existingSpace.name} (ID: ${existingSpace.id})`);
                    return existingSpace;
                }
            } catch (fetchError) {
                logOperation('create_space', { method: 'POST', url: `/team/${CLICKUP_TEAM_ID}/space`, data: requestData }, null, fetchError);
                throw fetchError;
            }
        }
        
        logOperation('create_space', { method: 'POST', url: `/team/${CLICKUP_TEAM_ID}/space`, data: requestData }, null, error);
        throw error;
    }
}

/**
 * Create a list within a space
 */
async function createList(spaceId, listName) {
    console.log(`📋 Creating list: ${listName} in space ${spaceId}`);
    
    const requestData = {
        name: listName,
        content: `${listName} for Fido OS CRM system`,
        due_date: false,
        due_date_time: false,
        priority: true,
        assignee: true,
        status: true
    };
    
    try {
        const response = await clickupClient.post(`/space/${spaceId}/list`, requestData);
        logOperation('create_list', { method: 'POST', url: `/space/${spaceId}/list`, data: requestData }, response);
        
        const list = response.data;
        manifest.lists[listName.toLowerCase().replace(/[^a-z0-9]/g, '_')] = {
            id: list.id,
            name: list.name,
            space_id: spaceId
        };
        
        console.log(`✅ Created list: ${list.name} (ID: ${list.id})`);
        return list;
        
    } catch (error) {
        // Check if list already exists
        if (error.response?.status === 400 && error.response?.data?.err?.includes('already exists')) {
            console.log(`⚠️  List "${listName}" already exists in space ${spaceId}`);
            
            try {
                const listsResponse = await clickupClient.get(`/space/${spaceId}/list`);
                const existingList = listsResponse.data.lists.find(l => l.name === listName);
                
                if (existingList) {
                    manifest.lists[listName.toLowerCase().replace(/[^a-z0-9]/g, '_')] = {
                        id: existingList.id,
                        name: existingList.name,
                        space_id: spaceId,
                        existing: true
                    };
                    
                    console.log(`✅ Using existing list: ${existingList.name} (ID: ${existingList.id})`);
                    return existingList;
                }
            } catch (fetchError) {
                logOperation('create_list', { method: 'POST', url: `/space/${spaceId}/list`, data: requestData }, null, fetchError);
                throw fetchError;
            }
        }
        
        logOperation('create_list', { method: 'POST', url: `/space/${spaceId}/list`, data: requestData }, null, error);
        throw error;
    }
}

/**
 * Create a custom field for a list
 */
async function createCustomField(listId, fieldConfig) {
    console.log(`🏷️  Creating field: ${fieldConfig.name} (type: ${fieldConfig.type})`);
    
    try {
        const response = await clickupClient.post(`/list/${listId}/field`, fieldConfig);
        logOperation('create_field', { method: 'POST', url: `/list/${listId}/field`, data: fieldConfig }, response);
        
        const field = response.data.field;
        const fieldKey = `${fieldConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        
        manifest.fields[fieldKey] = {
            id: field.id,
            name: field.name,
            type: field.type,
            list_id: listId,
            required: fieldConfig.required || false
        };
        
        console.log(`✅ Created field: ${field.name} (ID: ${field.id})`);
        return field;
        
    } catch (error) {
        // Check if field already exists
        if (error.response?.status === 400 && error.response?.data?.err?.includes('already exists')) {
            console.log(`⚠️  Field "${fieldConfig.name}" already exists in list ${listId}`);
            
            try {
                const fieldsResponse = await clickupClient.get(`/list/${listId}/field`);
                const existingField = fieldsResponse.data.fields.find(f => f.name === fieldConfig.name);
                
                if (existingField) {
                    const fieldKey = `${fieldConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                    manifest.fields[fieldKey] = {
                        id: existingField.id,
                        name: existingField.name,
                        type: existingField.type,
                        list_id: listId,
                        required: fieldConfig.required || false,
                        existing: true
                    };
                    
                    console.log(`✅ Using existing field: ${existingField.name} (ID: ${existingField.id})`);
                    return existingField;
                }
            } catch (fetchError) {
                logOperation('create_field', { method: 'POST', url: `/list/${listId}/field`, data: fieldConfig }, null, fetchError);
                throw fetchError;
            }
        }
        
        logOperation('create_field', { method: 'POST', url: `/list/${listId}/field`, data: fieldConfig }, null, error);
        console.error(`❌ Failed to create field ${fieldConfig.name}:`, error.response?.data || error.message);
        return null; // Continue with other fields
    }
}

/**
 * Define field configurations for each list
 */
function getFieldConfigurations() {
    return {
        customers: [
            {
                name: 'customer_key',
                type: settings.field_types.text,
                required: true,
                type_config: {}
            },
            {
                name: 'bark_customer_id',
                type: settings.field_types.text,
                required: false,
                type_config: {}
            },
            {
                name: 'Customer Name',
                type: settings.field_types.text,
                required: true,
                type_config: {}
            },
            {
                name: 'VIP',
                type: settings.field_types.dropdown,
                required: false,
                type_config: {
                    options: settings.vip_levels.map(vip => ({
                        name: vip.label,
                        color: vip.color
                    }))
                }
            },
            {
                name: 'Primary Markets',
                type: settings.field_types.multiselect,
                required: false,
                type_config: {
                    options: settings.markets.map(market => ({
                        name: market.code,
                        color: market.color
                    }))
                }
            },
            {
                name: 'Status',
                type: settings.field_types.dropdown,
                required: true,
                type_config: {
                    options: settings.statuses.map(status => ({
                        name: status.label,
                        color: status.color
                    }))
                }
            },
            {
                name: 'Notes',
                type: settings.field_types.textarea,
                required: false,
                type_config: {}
            }
        ],
        units: [
            {
                name: 'unit_key',
                type: settings.field_types.text,
                required: true,
                type_config: {}
            },
            {
                name: 'customer_key',
                type: settings.field_types.text,
                required: true,
                type_config: {}
            },
            {
                name: 'bark_unit_id',
                type: settings.field_types.text,
                required: false,
                type_config: {}
            },
            {
                name: 'Address',
                type: settings.field_types.text,
                required: true,
                type_config: {}
            },
            {
                name: 'Market',
                type: settings.field_types.dropdown,
                required: true,
                type_config: {
                    options: settings.markets.map(market => ({
                        name: market.code,
                        color: market.color
                    }))
                }
            },
            {
                name: 'Subscription',
                type: settings.field_types.dropdown,
                required: true,
                type_config: {
                    options: settings.subscriptions.map(sub => ({
                        name: sub.label,
                        color: '#6c757d'
                    }))
                }
            },
            {
                name: 'Status',
                type: settings.field_types.dropdown,
                required: true,
                type_config: {
                    options: settings.statuses.map(status => ({
                        name: status.label,
                        color: status.color
                    }))
                }
            }
        ],
        market_ownership: [
            {
                name: 'Market',
                type: settings.field_types.dropdown,
                required: true,
                type_config: {
                    options: settings.markets.map(market => ({
                        name: market.code,
                        color: market.color
                    }))
                }
            },
            {
                name: 'Primary Owner',
                type: settings.field_types.user,
                required: true,
                type_config: {}
            },
            {
                name: 'Backup Owner',
                type: settings.field_types.user,
                required: false,
                type_config: {}
            },
            {
                name: 'Effective Date',
                type: settings.field_types.date,
                required: true,
                type_config: {}
            }
        ],
        vip_mapping: [
            {
                name: 'customer_key',
                type: settings.field_types.text,
                required: true,
                type_config: {}
            },
            {
                name: 'CX Owner',
                type: settings.field_types.user,
                required: true,
                type_config: {}
            },
            {
                name: 'VIP Level',
                type: settings.field_types.dropdown,
                required: true,
                type_config: {
                    options: settings.vip_levels.map(vip => ({
                        name: vip.label,
                        color: vip.color
                    }))
                }
            },
            {
                name: 'Notes',
                type: settings.field_types.textarea,
                required: false,
                type_config: {}
            }
        ],
        ops_schedules: [
            {
                name: 'Market',
                type: settings.field_types.dropdown,
                required: true,
                type_config: {
                    options: settings.markets.map(market => ({
                        name: market.code,
                        color: market.color
                    }))
                }
            },
            {
                name: 'Ops Owner',
                type: settings.field_types.user,
                required: true,
                type_config: {}
            },
            {
                name: 'Schedule Start',
                type: settings.field_types.date,
                required: true,
                type_config: {}
            },
            {
                name: 'Schedule End',
                type: settings.field_types.date,
                required: false,
                type_config: {}
            },
            {
                name: 'Days of Week',
                type: settings.field_types.multiselect,
                required: true,
                type_config: {
                    options: [
                        { name: 'Monday', color: '#007bff' },
                        { name: 'Tuesday', color: '#6610f2' },
                        { name: 'Wednesday', color: '#6f42c1' },
                        { name: 'Thursday', color: '#e83e8c' },
                        { name: 'Friday', color: '#dc3545' },
                        { name: 'Saturday', color: '#fd7e14' },
                        { name: 'Sunday', color: '#ffc107' }
                    ]
                }
            }
        ],
        cx_schedules: [
            {
                name: 'CX Owner',
                type: settings.field_types.user,
                required: true,
                type_config: {}
            },
            {
                name: 'Schedule Start',
                type: settings.field_types.date,
                required: true,
                type_config: {}
            },
            {
                name: 'Schedule End',
                type: settings.field_types.date,
                required: false,
                type_config: {}
            },
            {
                name: 'Hours Start',
                type: settings.field_types.text,
                required: true,
                type_config: {}
            },
            {
                name: 'Hours End',
                type: settings.field_types.text,
                required: true,
                type_config: {}
            },
            {
                name: 'Days of Week',
                type: settings.field_types.multiselect,
                required: true,
                type_config: {
                    options: [
                        { name: 'Monday', color: '#007bff' },
                        { name: 'Tuesday', color: '#6610f2' },
                        { name: 'Wednesday', color: '#6f42c1' },
                        { name: 'Thursday', color: '#e83e8c' },
                        { name: 'Friday', color: '#dc3545' },
                        { name: 'Saturday', color: '#fd7e14' },
                        { name: 'Sunday', color: '#ffc107' }
                    ]
                }
            }
        ],
        capacity: [
            {
                name: 'Market',
                type: settings.field_types.dropdown,
                required: true,
                type_config: {
                    options: settings.markets.map(market => ({
                        name: market.code,
                        color: market.color
                    }))
                }
            },
            {
                name: 'Date',
                type: settings.field_types.date,
                required: true,
                type_config: {}
            },
            {
                name: 'Max Capacity',
                type: settings.field_types.number,
                required: true,
                type_config: {}
            },
            {
                name: 'Current Load',
                type: settings.field_types.number,
                required: false,
                type_config: {}
            },
            {
                name: 'Available Slots',
                type: settings.field_types.formula,
                required: false,
                type_config: {
                    formula: 'subtract(field("Max Capacity"), field("Current Load"))'
                }
            }
        ]
    };
}

/**
 * Main schema creation function
 */
async function createSchema() {
    console.log('🚀 Starting Fido OS Phase 1 Schema Creation\n');
    
    try {
        // Step 1: Create CRM Space
        console.log('📁 STEP 1: Creating CRM Space');
        const crmSpace = await createSpace('CRM', true);
        
        // Step 2: Create Admin/Config Space
        console.log('\n📁 STEP 2: Creating Admin/Config Space');
        const adminSpace = await createSpace('Admin / Config', true);
        
        // Step 3: Create CRM Lists
        console.log('\n📋 STEP 3: Creating CRM Lists');
        const customersList = await createList(crmSpace.id, 'Customers');
        const unitsList = await createList(crmSpace.id, 'Units');
        
        // Step 4: Create Admin/Config Lists
        console.log('\n📋 STEP 4: Creating Admin/Config Lists');
        const marketOwnershipList = await createList(adminSpace.id, 'Market Ownership');
        const vipMappingList = await createList(adminSpace.id, 'VIP Mapping');
        const opsSchedulesList = await createList(adminSpace.id, 'Ops Schedules');
        const cxSchedulesList = await createList(adminSpace.id, 'CX Schedules');
        const capacityList = await createList(adminSpace.id, 'Capacity');
        
        // Step 5: Create Custom Fields
        console.log('\n🏷️  STEP 5: Creating Custom Fields');
        const fieldConfigs = getFieldConfigurations();
        
        const listMappings = {
            customers: customersList.id,
            units: unitsList.id,
            market_ownership: marketOwnershipList.id,
            vip_mapping: vipMappingList.id,
            ops_schedules: opsSchedulesList.id,
            cx_schedules: cxSchedulesList.id,
            capacity: capacityList.id
        };
        
        for (const [listType, listId] of Object.entries(listMappings)) {
            console.log(`\n🏷️  Creating fields for ${listType}:`);
            const fields = fieldConfigs[listType] || [];
            
            for (const fieldConfig of fields) {
                await createCustomField(listId, fieldConfig);
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // Step 6: Save manifest
        console.log('\n💾 STEP 6: Saving Field Manifest');
        manifest.completed_at = new Date().toISOString();
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        console.log(`✅ Field manifest saved to: ${MANIFEST_PATH}`);
        
        // Step 7: Summary
        console.log('\n📊 CREATION SUMMARY:');
        console.log(`✅ Spaces Created: ${Object.keys(manifest.spaces).length}`);
        console.log(`✅ Lists Created: ${Object.keys(manifest.lists).length}`);
        console.log(`✅ Fields Created: ${Object.keys(manifest.fields).length}`);
        
        console.log('\n🎯 Phase 1 Schema Creation Complete!');
        return manifest;
        
    } catch (error) {
        console.error('💥 Schema creation failed:', error);
        
        // Save partial manifest for debugging
        manifest.failed_at = new Date().toISOString();
        manifest.error = error.message;
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        
        throw error;
    }
}

/**
 * Test script idempotency
 */
async function testIdempotency() {
    console.log('\n🧪 Testing Script Idempotency...');
    
    try {
        await createSchema();
        console.log('✅ Idempotency test passed - no duplicate creation errors');
        return true;
    } catch (error) {
        console.error('❌ Idempotency test failed:', error.message);
        return false;
    }
}

// Run schema creation if called directly
if (require.main === module) {
    // Check environment variables
    if (!CLICKUP_API_TOKEN) {
        console.error('❌ CLICKUP_API_TOKEN environment variable is required');
        process.exit(1);
    }
    
    createSchema().catch(error => {
        console.error('💥 Phase 1 failed:', error);
        process.exit(1);
    });
}

module.exports = { createSchema, testIdempotency, manifest };

