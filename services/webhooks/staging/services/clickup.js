/**
 * Fido OS - Phase 2: Routing Webhook
 * ClickUp API Service
 * 
 * Handles all ClickUp API interactions
 */

const https = require('https');

const API_BASE = 'https://api.clickup.com/api/v2';
const API_TOKEN = process.env.CLICKUP_API_TOKEN;
const TEAM_ID = process.env.CLICKUP_TEAM_ID;

/**
 * Make HTTPS request to ClickUp API
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {Object} data - Request body (optional)
 * @returns {Promise<Object>} - Response data
 */
function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    
    const options = {
      method,
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(url, options, (res) => {
      let body = '';
      
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`ClickUp API error: ${res.statusCode} - ${parsed.err || body}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse ClickUp response: ${error.message}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Get task by ID
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} - Task data
 */
async function getTask(taskId) {
  return apiRequest('GET', `/task/${taskId}`);
}

/**
 * Get tasks from a list with custom field filtering
 * @param {string} listId - List ID
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} - Array of tasks
 */
async function getTasksFromList(listId, filters = {}) {
  const queryParams = new URLSearchParams();
  
  if (filters.customer_key) {
    queryParams.append('custom_fields', JSON.stringify([{
      field_id: '8f687ebc-073d-48c6-ba25-1cae9d16ca3e',
      operator: '=',
      value: filters.customer_key
    }]));
  }
  
  const path = `/list/${listId}/task?${queryParams.toString()}`;
  const response = await apiRequest('GET', path);
  return response.tasks || [];
}

/**
 * Find customer by customer_key
 * @param {string} customerKey - Customer key
 * @returns {Promise<Object|null>} - Customer task or null
 */
async function getCustomer(customerKey) {
  const CUSTOMERS_LIST_ID = '901321549787';
  
  try {
    const tasks = await getTasksFromList(CUSTOMERS_LIST_ID, { customer_key: customerKey });
    return tasks.length > 0 ? tasks[0] : null;
  } catch (error) {
    console.error(`[ClickUp] Error fetching customer ${customerKey}:`, error.message);
    return null;
  }
}

/**
 * Find unit by unit_key
 * @param {string} unitKey - Unit key
 * @returns {Promise<Object|null>} - Unit task or null
 */
async function getUnit(unitKey) {
  const UNITS_LIST_ID = '901321549939';
  
  try {
    const tasks = await getTasksFromList(UNITS_LIST_ID, { unit_key: unitKey });
    return tasks.length > 0 ? tasks[0] : null;
  } catch (error) {
    console.error(`[ClickUp] Error fetching unit ${unitKey}:`, error.message);
    return null;
  }
}

/**
 * Get market ownership by market code
 * @param {string} market - Market code (e.g., "ATX", "LAX")
 * @returns {Promise<Object|null>} - Market ownership task or null
 */
async function getMarketOwnership(market) {
  const MARKET_OWNERSHIP_LIST_ID = '901321517062';
  
  try {
    const response = await apiRequest('GET', `/list/${MARKET_OWNERSHIP_LIST_ID}/task`);
    const tasks = response.tasks || [];
    
    // Find task where Market field matches
    const marketTask = tasks.find(task => {
      const marketField = task.custom_fields?.find(f => f.name === 'Market');
      return marketField?.value === market;
    });
    
    return marketTask || null;
  } catch (error) {
    console.error(`[ClickUp] Error fetching market ownership for ${market}:`, error.message);
    return null;
  }
}

/**
 * Update task assignees
 * @param {string} taskId - Task ID
 * @param {Array<number>} assigneeIds - Array of user IDs
 * @returns {Promise<Object>} - Updated task
 */
async function updateTaskAssignees(taskId, assigneeIds) {
  const data = {
    assignees: {
      add: assigneeIds,
      rem: []
    }
  };
  
  return apiRequest('PUT', `/task/${taskId}`, data);
}

/**
 * Add tag to task
 * @param {string} taskId - Task ID
 * @param {string} tagName - Tag name
 * @returns {Promise<Object>} - Response
 */
async function addTaskTag(taskId, tagName) {
  return apiRequest('POST', `/task/${taskId}/tag/${encodeURIComponent(tagName)}`);
}

module.exports = {
  getTask,
  getCustomer,
  getUnit,
  getMarketOwnership,
  updateTaskAssignees,
  addTaskTag
};

