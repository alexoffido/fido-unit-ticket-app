/**
 * Fido OS - Phase 3: Security Hardening
 * Structured Logging Middleware
 * 
 * Outputs sanitized JSON logs for audit traceability
 * NEVER logs raw request bodies or sensitive data
 */

const fs = require('fs');
const path = require('path');
const { sanitizeObject, sanitizeMessage } = require('../utils/sanitize');
const securityAlerting = require('../utils/alerting');

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
  const logLine = JSON.stringify(entry) + '\n';
  
  fs.appendFileSync(logPath, logLine, 'utf8');
}

/**
 * Sanitize request data for logging
 * @param {Object} req - Express request
 * @returns {Object} Sanitized request data
 */
function sanitizeRequest(req) {
  return {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    hasSignature: !!req.headers['x-signature'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  };
}

/**
 * Logger middleware
 * Logs all requests and responses in structured JSON format
 */
function loggerMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log incoming request (structured JSON, no body)
  const requestLog = {
    level: 'info',
    message: 'Incoming request',
    request_id: requestId,
    request: sanitizeRequest(req),
    timestamp: new Date().toISOString()
  };
  
  writeLog('webhook.log', requestLog);
  console.log(JSON.stringify(requestLog));
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Log response (structured JSON)
    const logEntry = {
      level: res.statusCode >= 400 ? 'warn' : 'info',
      message: 'Request completed',
      request_id: requestId,
      request: sanitizeRequest(req),
      response: {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        duration: `${duration}ms`
      },
      timestamp: new Date().toISOString()
    };
    
    // Add security_event field for security-related responses
    if (res.statusCode === 401) {
      logEntry.security_event = 'unauthorized';
      
      // Record 401 for alerting
      securityAlerting.record401({
        ip: req.ip || req.connection?.remoteAddress,
        reason: 'invalid_signature'
      });
    } else if (res.statusCode === 429) {
      logEntry.security_event = 'rate_limited';
    } else if (res.statusCode === 409) {
      logEntry.security_event = 'replay_detected';
    }
    
    writeLog('webhook.log', logEntry);
    console.log(JSON.stringify(logEntry));
    
    return originalSend.call(this, data);
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
    level: 'info',
    message: 'Routing decision',
    type: 'routing',
    task_id: taskId,
    cx_owner: routing.cx_owner,
    ops_owner: routing.ops_owner,
    routing_source: routing.routing_source,
    customer_key: routing.customer_key,
    market: routing.market,
    timestamp: new Date().toISOString()
  };
  
  writeLog('routing.log', routingLog);
  console.log(JSON.stringify(routingLog));
}

/**
 * Log error
 * @param {string} context - Error context
 * @param {Error} error - Error object
 */
function logError(context, error) {
  const errorLog = {
    level: 'error',
    message: 'Error occurred',
    type: 'error',
    context,
    error: sanitizeMessage(error.message),
    stack: sanitizeMessage(error.stack),
    timestamp: new Date().toISOString()
  };
  
  writeLog('errors.log', errorLog);
  console.error(JSON.stringify(errorLog));
}

module.exports = {
  loggerMiddleware,
  logRouting,
  logError,
  sanitizeRequest
};

