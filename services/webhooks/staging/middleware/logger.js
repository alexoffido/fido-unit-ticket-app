/**
 * Fido OS - Phase 2: Routing Webhook
 * Logger Middleware
 * 
 * Logs all requests and responses with sanitization
 */

const fs = require('fs');
const path = require('path');
const { sanitizeObject, sanitizeMessage } = require('../utils/sanitize');

const LOG_DIR = path.join(__dirname, '../../../logs/phase-2');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Write log entry to file
 * @param {string} filename - Log filename
 * @param {Object} entry - Log entry object
 */
function writeLog(filename, entry) {
  const logPath = path.join(LOG_DIR, filename);
  const timestamp = new Date().toISOString();
  const logLine = JSON.stringify({ timestamp, ...entry }) + '\n';
  
  fs.appendFileSync(logPath, logLine, 'utf8');
}

/**
 * Request/Response logger middleware
 */
function loggerMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log request
  const requestLog = {
    id: requestId,
    type: 'request',
    method: req.method,
    path: req.path,
    headers: sanitizeObject(req.headers),
    body: sanitizeObject(req.body),
    query: req.query
  };
  
  writeLog('webhook.log', requestLog);
  console.log(`[${requestId}] ${req.method} ${req.path}`);
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Log response
    const responseLog = {
      id: requestId,
      type: 'response',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      body: sanitizeObject(typeof data === 'string' ? JSON.parse(data) : data)
    };
    
    writeLog('webhook.log', responseLog);
    console.log(`[${requestId}] ${res.statusCode} (${duration}ms)`);
    
    originalSend.call(this, data);
  };
  
  next();
}

/**
 * Log routing decision
 * @param {string} taskId - Task ID
 * @param {Object} routing - Routing decision object
 */
function logRouting(taskId, routing) {
  const routingLog = {
    type: 'routing',
    task_id: taskId,
    cx_owner: routing.cx_owner,
    ops_owner: routing.ops_owner,
    routing_source: routing.routing_source,
    customer_key: routing.customer_key,
    market: routing.market
  };
  
  writeLog('routing.log', routingLog);
  console.log(`[ROUTING] Task ${taskId}: CX=${routing.cx_owner}, Ops=${routing.ops_owner}, Source=${routing.routing_source}`);
}

/**
 * Log error
 * @param {string} context - Error context
 * @param {Error} error - Error object
 */
function logError(context, error) {
  const errorLog = {
    type: 'error',
    context,
    message: sanitizeMessage(error.message),
    stack: sanitizeMessage(error.stack)
  };
  
  writeLog('errors.log', errorLog);
  console.error(`[ERROR] ${context}:`, error.message);
}

module.exports = {
  loggerMiddleware,
  logRouting,
  logError
};

