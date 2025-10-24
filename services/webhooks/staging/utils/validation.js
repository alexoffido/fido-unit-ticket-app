/**
 * Fido OS - Phase 2: Routing Webhook
 * Input Validation Utility
 * 
 * Validates webhook payloads and routing inputs
 */

/**
 * Validate ClickUp webhook event
 * @param {Object} event - Webhook event payload
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateWebhookEvent(event) {
  if (!event) {
    return { valid: false, error: 'Event payload is missing' };
  }

  if (!event.event) {
    return { valid: false, error: 'Event type is missing' };
  }

  if (!event.task_id && !event.history_items) {
    return { valid: false, error: 'Task ID or history items missing' };
  }

  return { valid: true, error: null };
}

/**
 * Validate routing input data
 * @param {Object} data - Routing input data
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateRoutingData(data) {
  if (!data) {
    return { valid: false, error: 'Routing data is missing' };
  }

  // At minimum we need a task ID
  if (!data.task_id) {
    return { valid: false, error: 'Task ID is required for routing' };
  }

  return { valid: true, error: null };
}

/**
 * Extract customer_key from custom fields
 * @param {Array} customFields - ClickUp custom fields array
 * @returns {string|null} - customer_key value or null
 */
function extractCustomerKey(customFields) {
  if (!Array.isArray(customFields)) {
    return null;
  }

  const customerKeyField = customFields.find(f => 
    f.name === 'customer_key' || f.id === '8f687ebc-073d-48c6-ba25-1cae9d16ca3e'
  );

  return customerKeyField?.value || null;
}

/**
 * Extract unit_key from custom fields
 * @param {Array} customFields - ClickUp custom fields array
 * @returns {string|null} - unit_key value or null
 */
function extractUnitKey(customFields) {
  if (!Array.isArray(customFields)) {
    return null;
  }

  const unitKeyField = customFields.find(f => 
    f.name === 'unit_key' || f.id === '1ee003c2-a0f4-4b03-a39e-81ff13ca244e'
  );

  return unitKeyField?.value || null;
}

module.exports = {
  validateWebhookEvent,
  validateRoutingData,
  extractCustomerKey,
  extractUnitKey
};

