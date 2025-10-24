/**
 * Fido OS - Phase 2: Routing Webhook
 * Webhook Route Handler
 * 
 * Handles ClickUp webhook events
 */

const express = require('express');
const router = express.Router();
const validateHMAC = require('../middleware/hmac');
const { validateWebhookEvent } = require('../utils/validation');
const { routeTicket, applyRouting } = require('../services/router');
const clickup = require('../services/clickup');
const { logError } = require('../middleware/logger');

/**
 * POST /webhook/clickup
 * Handles ClickUp webhook events
 * Protected by HMAC validation
 */
router.post('/clickup', validateHMAC, async (req, res) => {
  try {
    const event = req.body;

    // Validate event structure
    const validation = validateWebhookEvent(event);
    if (!validation.valid) {
      console.warn('[Webhook] Invalid event:', validation.error);
      return res.status(400).json({ error: validation.error });
    }

    console.log(`[Webhook] Received event: ${event.event}`);

    // Only process taskCreated and taskUpdated events
    if (event.event !== 'taskCreated' && event.event !== 'taskUpdated') {
      console.log(`[Webhook] Ignoring event type: ${event.event}`);
      return res.status(200).json({ message: 'Event ignored', event: event.event });
    }

    // Extract task ID
    const taskId = event.task_id;
    if (!taskId) {
      console.warn('[Webhook] No task_id in event');
      return res.status(400).json({ error: 'Missing task_id' });
    }

    // Fetch full task data
    console.log(`[Webhook] Fetching task ${taskId}...`);
    const task = await clickup.getTask(taskId);

    // Check if task already has assignees (idempotency check)
    if (event.event === 'taskUpdated' && task.assignees && task.assignees.length > 0) {
      console.log(`[Webhook] Task ${taskId} already has assignees, skipping routing`);
      return res.status(200).json({ 
        message: 'Task already routed', 
        task_id: taskId,
        assignees: task.assignees.map(a => a.id)
      });
    }

    // Route the ticket
    console.log(`[Webhook] Routing task ${taskId}...`);
    const routing = await routeTicket(task);

    // Apply routing decision
    console.log(`[Webhook] Applying routing to task ${taskId}...`);
    const result = await applyRouting(taskId, routing);

    // Return response
    res.status(200).json({
      message: 'Routing applied',
      task_id: taskId,
      routing: {
        cx_owner: routing.cx_owner,
        ops_owner: routing.ops_owner,
        routing_source: routing.routing_source,
        market: routing.market
      },
      result: {
        success: result.success,
        updates: result.updates,
        errors: result.errors
      }
    });

  } catch (error) {
    logError('webhook_handler', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

module.exports = router;

