/**
 * Fido OS - Phase 2: Routing Webhook
 * Routing Service (Updated with Auto-Routing)
 * 
 * Implements intelligent CX and Ops owner routing logic
 * CX routing uses tag-based fallback instead of hardcoded default
 */

const clickup = require('./clickup');
const { extractCustomerKey, extractUnitKey } = require('../utils/validation');
const { logRouting, logError } = require('../middleware/logger');

const CX_ROUTING_MODE = process.env.CX_ROUTING_MODE || 'auto';
const CX_ROUTER_USER_ID = process.env.CX_ROUTER_USER_ID || null; // Optional fallback bot

/**
 * Route ticket to appropriate CX and Ops owners
 * @param {Object} task - ClickUp task object
 * @returns {Promise<Object>} - Routing decision
 */
async function routeTicket(task) {
  const routing = {
    task_id: task.id,
    cx_owner: null,
    ops_owner: null,
    routing_source: {},
    customer_key: null,
    market: null,
    tags: [],
    errors: []
  };

  try {
    // Step 1: Extract customer_key from task custom fields
    const customerKey = extractCustomerKey(task.custom_fields);
    routing.customer_key = customerKey;

    // Step 2: Determine CX Owner using auto-routing logic
    if (customerKey) {
      const customer = await clickup.getCustomer(customerKey);
      
      if (customer) {
        // Check VIP status
        const vipField = customer.custom_fields?.find(f => f.name === 'VIP');
        const isVIP = vipField?.value === 'VIP';
        
        // Check if customer has assignee (CX Owner)
        const hasAssignee = customer.assignees && customer.assignees.length > 0;
        
        if (isVIP && hasAssignee) {
          // VIP with CX Owner → assign customer's CX owner
          routing.cx_owner = customer.assignees[0].id;
          routing.routing_source.cx = 'customer_assignee';
        } else if (hasAssignee) {
          // Standard customer with assignee → use auto-routing
          routing.cx_owner = customer.assignees[0].id;
          routing.routing_source.cx = 'auto_routing';
        } else {
          // Customer exists but no assignee → tag for manual routing
          routing.cx_owner = CX_ROUTER_USER_ID; // Optional bot assignment
          routing.routing_source.cx = 'unresolved_customer';
          routing.tags.push('Needs CX Routing');
          routing.errors.push(`Customer ${customerKey} has no CX owner assigned`);
        }
      } else {
        // Customer not found → tag for manual routing
        routing.cx_owner = CX_ROUTER_USER_ID; // Optional bot assignment
        routing.routing_source.cx = 'unresolved_customer';
        routing.tags.push('Needs CX Routing');
        routing.errors.push(`Customer ${customerKey} not found`);
      }
    } else {
      // No customer_key → tag for manual routing
      routing.cx_owner = CX_ROUTER_USER_ID; // Optional bot assignment
      routing.routing_source.cx = 'unresolved_customer';
      routing.tags.push('Needs CX Routing');
      routing.errors.push('No customer_key provided');
    }

    // Step 3: Determine Market
    const unitKey = extractUnitKey(task.custom_fields);
    
    if (unitKey) {
      // Unit key exists → lookup unit's market
      const unit = await clickup.getUnit(unitKey);
      
      if (unit) {
        const marketField = unit.custom_fields?.find(f => f.name === 'Market');
        routing.market = marketField?.value || null;
      } else {
        routing.errors.push(`Unit ${unitKey} not found`);
      }
    }
    
    // Fallback: Use market from ticket input if no unit market
    if (!routing.market) {
      const ticketMarketField = task.custom_fields?.find(f => f.name === 'Market');
      routing.market = ticketMarketField?.value || null;
    }

    // Step 4: Determine Ops Owner
    if (routing.market) {
      const marketOwnership = await clickup.getMarketOwnership(routing.market);
      
      if (marketOwnership) {
        const primaryOpsField = marketOwnership.custom_fields?.find(f => f.name === 'Primary Ops Owner');
        
        if (primaryOpsField && primaryOpsField.value && primaryOpsField.value.length > 0) {
          routing.ops_owner = primaryOpsField.value[0].id;
          routing.routing_source.ops = 'market_primary';
        } else {
          routing.errors.push(`Market ${routing.market} has no Primary Ops Owner`);
          routing.tags.push('Needs Ops Routing');
        }
      } else {
        routing.errors.push(`Market ownership for ${routing.market} not found`);
        routing.tags.push('Needs Ops Routing');
      }
    } else {
      routing.errors.push('No market specified for Ops routing');
      routing.tags.push('Needs Ops Routing');
    }

    // Log routing decision
    logRouting(task.id, routing);

    return routing;

  } catch (error) {
    logError('routeTicket', error);
    routing.errors.push(error.message);
    routing.tags.push('Routing Error');
    return routing;
  }
}

/**
 * Apply routing decision to task
 * @param {string} taskId - Task ID
 * @param {Object} routing - Routing decision
 * @returns {Promise<Object>} - Update result
 */
async function applyRouting(taskId, routing) {
  const result = {
    success: false,
    updates: [],
    errors: []
  };

  try {
    // Collect assignees to add (only if they exist)
    const assigneesToAdd = [];
    
    if (routing.cx_owner) {
      assigneesToAdd.push(routing.cx_owner);
    }
    
    if (routing.ops_owner) {
      assigneesToAdd.push(routing.ops_owner);
    }

    // Update task assignees (only if we have assignees to add)
    if (assigneesToAdd.length > 0) {
      await clickup.updateTaskAssignees(taskId, assigneesToAdd);
      result.updates.push(`Assigned: ${assigneesToAdd.join(', ')}`);
    }

    // Add tags for manual routing needs
    if (routing.tags.length > 0) {
      for (const tag of routing.tags) {
        await clickup.addTaskTag(taskId, tag);
        result.updates.push(`Tagged: ${tag}`);
      }
    }

    result.success = true;
    result.errors = routing.errors;

  } catch (error) {
    logError('applyRouting', error);
    result.errors.push(error.message);
  }

  return result;
}

module.exports = {
  routeTicket,
  applyRouting
};

