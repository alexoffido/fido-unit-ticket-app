/**
 * Fido OS - Phase 2: Routing Webhook
 * Log Sanitization Utility
 * 
 * Removes sensitive data from logs before writing
 */

const SENSITIVE_KEYS = [
  'CLICKUP_API_TOKEN',
  'SLACK_BOT_TOKEN',
  'WEBHOOK_HMAC_SECRET',
  'SLACK_SIGNING_SECRET',
  'token',
  'authorization',
  'x-signature',
  'password',
  'secret'
];

/**
 * Sanitize an object by redacting sensitive keys
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized copy
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sk => lowerKey.includes(sk.toLowerCase()));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize a log message
 * @param {string} message - Log message
 * @returns {string} - Sanitized message
 */
function sanitizeMessage(message) {
  if (typeof message !== 'string') {
    return message;
  }

  let sanitized = message;
  
  // Redact tokens that look like API keys
  sanitized = sanitized.replace(/pk_\d+_[A-Z0-9]+/gi, 'pk_[REDACTED]');
  sanitized = sanitized.replace(/xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/gi, 'xoxb-[REDACTED]');
  sanitized = sanitized.replace(/ghu_[a-zA-Z0-9]+/gi, 'ghu_[REDACTED]');
  
  return sanitized;
}

module.exports = {
  sanitizeObject,
  sanitizeMessage
};

