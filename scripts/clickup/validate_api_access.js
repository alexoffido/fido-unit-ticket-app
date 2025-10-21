/**
 * ClickUp API Access Validation Script
 * Validates connection and permissions before schema creation
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Environment configuration
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_TEAM_ID = process.env.CLICKUP_TEAM_ID || '9013484736';
const LOG_DIR = path.join(__dirname, '../../logs/phase-1');

// Ensure log directory exists
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

/**
 * Log API responses to file
 */
function logResponse(operation, response, error = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        operation,
        success: !error,
        status: response?.status,
        data: error ? { error: error.message } : response?.data,
        error: error ? error.response?.data : null
    };
    
    const logFile = path.join(LOG_DIR, 'api_validation.log');
    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + '\n');
    
    return logEntry;
}

/**
 * Validate API authentication
 */
async function validateAuthentication() {
    console.log('🔐 Validating ClickUp API authentication...');
    
    try {
        const response = await clickupClient.get('/user');
        const logEntry = logResponse('validate_auth', response);
        
        console.log(`✅ Authentication successful for user: ${response.data.user.username}`);
        console.log(`   User ID: ${response.data.user.id}`);
        console.log(`   Email: ${response.data.user.email}`);
        
        return { success: true, user: response.data.user };
    } catch (error) {
        const logEntry = logResponse('validate_auth', null, error);
        console.error('❌ Authentication failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Validate team access and permissions
 */
async function validateTeamAccess() {
    console.log('🏢 Validating team access and permissions...');
    
    try {
        const response = await clickupClient.get(`/team/${CLICKUP_TEAM_ID}`);
        const logEntry = logResponse('validate_team', response);
        
        console.log(`✅ Team access confirmed: ${response.data.team.name}`);
        console.log(`   Team ID: ${response.data.team.id}`);
        console.log(`   Members: ${response.data.team.members?.length || 0}`);
        
        return { success: true, team: response.data.team };
    } catch (error) {
        const logEntry = logResponse('validate_team', null, error);
        console.error('❌ Team access failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

/**
 * List existing spaces to understand current structure
 */
async function listExistingSpaces() {
    console.log('📁 Listing existing spaces...');
    
    try {
        const response = await clickupClient.get(`/team/${CLICKUP_TEAM_ID}/space`);
        const logEntry = logResponse('list_spaces', response);
        
        console.log(`✅ Found ${response.data.spaces.length} existing spaces:`);
        response.data.spaces.forEach(space => {
            console.log(`   - ${space.name} (ID: ${space.id})`);
        });
        
        return { success: true, spaces: response.data.spaces };
    } catch (error) {
        const logEntry = logResponse('list_spaces', null, error);
        console.error('❌ Failed to list spaces:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Check for existing CRM or Admin/Config spaces
 */
async function checkExistingSchema(spaces) {
    console.log('🔍 Checking for existing schema conflicts...');
    
    const crmSpace = spaces.find(space => space.name === 'CRM');
    const adminSpace = spaces.find(space => space.name === 'Admin / Config');
    
    if (crmSpace) {
        console.log(`⚠️  CRM space already exists (ID: ${crmSpace.id})`);
    }
    
    if (adminSpace) {
        console.log(`⚠️  Admin / Config space already exists (ID: ${adminSpace.id})`);
    }
    
    if (!crmSpace && !adminSpace) {
        console.log('✅ No schema conflicts detected - ready for creation');
    }
    
    return {
        crmExists: !!crmSpace,
        adminExists: !!adminSpace,
        crmSpace,
        adminSpace
    };
}

/**
 * Main validation function
 */
async function main() {
    console.log('🚀 Starting ClickUp API validation for Fido OS Phase 1\n');
    
    // Check environment variables
    if (!CLICKUP_API_TOKEN) {
        console.error('❌ CLICKUP_API_TOKEN environment variable is required');
        process.exit(1);
    }
    
    console.log(`🔧 Configuration:`);
    console.log(`   Team ID: ${CLICKUP_TEAM_ID}`);
    console.log(`   Log Directory: ${LOG_DIR}\n`);
    
    // Run validation steps
    const authResult = await validateAuthentication();
    if (!authResult.success) {
        console.error('❌ API validation failed - cannot proceed');
        process.exit(1);
    }
    
    const teamResult = await validateTeamAccess();
    if (!teamResult.success) {
        console.error('❌ Team access validation failed - cannot proceed');
        process.exit(1);
    }
    
    const spacesResult = await listExistingSpaces();
    if (!spacesResult.success) {
        console.error('❌ Space listing failed - cannot proceed');
        process.exit(1);
    }
    
    const schemaCheck = await checkExistingSchema(spacesResult.spaces);
    
    // Summary
    console.log('\n📋 Validation Summary:');
    console.log(`✅ API Authentication: Success`);
    console.log(`✅ Team Access: Success (${teamResult.team.name})`);
    console.log(`✅ Space Listing: Success (${spacesResult.spaces.length} spaces)`);
    console.log(`${schemaCheck.crmExists || schemaCheck.adminExists ? '⚠️' : '✅'} Schema Conflicts: ${schemaCheck.crmExists || schemaCheck.adminExists ? 'Detected' : 'None'}`);
    
    console.log('\n🎯 Ready to proceed with Phase 1 schema creation');
    
    return {
        auth: authResult,
        team: teamResult,
        spaces: spacesResult,
        schema: schemaCheck
    };
}

// Run validation if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Validation failed:', error);
        process.exit(1);
    });
}

module.exports = { main, validateAuthentication, validateTeamAccess, listExistingSpaces };

