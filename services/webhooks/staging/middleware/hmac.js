/**
 * Fido OS - Phase 3: Security Hardening
 * HMAC Validation Middleware
 * 
 * Validates ClickUp webhook signatures using HMAC-SHA256
 * CRITICAL: Uses RAW request body for signature validation
 * 
 * Security Features:
 * - Raw body HMAC computation
 * - Timing-safe comparison
 * - Header case normalization
 * - Replay protection
 */

const crypto = require('crypto');
const replayCache = require('../utils/replayCache');

/**
 * HMAC validation middleware
 * Validates X-Signature header against computed HMAC
 * 
 * SECURITY REQUIREMENTS:
 * - Must compute HMAC over RAW request body (before JSON parsing)
 * - Must use timing-safe comparison
 * - Must use equal-length buffers
 * - Must normalize header case
 * - Must detect replays
 */
function validateHMAC(req, res, next) {
  const secret = process.env.WEBHOOK_HMAC_SECRET;
  
  if (!secret) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'WEBHOOK_HMAC_SECRET not configured',
      security_event: 'config_error'
    }));
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Header normalization: Accept both X-Signature and x-signature
  const signature = req.headers['x-signature'] || req.headers['X-Signature'];
  
  if (!signature) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Request missing X-Signature header',
      security_event: 'missing_signature',
      ip: req.ip
    }));
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  try {
    // CRITICAL: Use raw body buffer, not parsed JSON
    // The rawBody is attached by express.json({ verify: ... }) in index.js
    const rawBody = req.rawBody;
    
    if (!rawBody) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Raw body not available - check body parser configuration',
        security_event: 'config_error'
      }));
      return res.status(500).json({ error: 'Internal configuration error' });
    }
    
    // Compute HMAC over raw body
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const computed = hmac.digest('hex').toLowerCase(); // Normalize to lowercase
    
    // Normalize signature to lowercase for comparison
    const normalizedSignature = signature.toLowerCase();
    
    // Timing-safe comparison with equal-length buffers
    const signatureBuffer = Buffer.from(normalizedSignature);
    const computedBuffer = Buffer.from(computed);
    
    // Ensure buffers are same length (prevents timing attacks)
    if (signatureBuffer.length !== computedBuffer.length) {
      console.warn(JSON.stringify({
        level: 'warn',
        message: 'Invalid signature length',
        security_event: 'invalid_signature',
        expected_length: computedBuffer.length,
        received_length: signatureBuffer.length,
        ip: req.ip
      }));
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    const isValid = crypto.timingSafeEqual(signatureBuffer, computedBuffer);
    
    if (!isValid) {
      console.warn(JSON.stringify({
        level: 'warn',
        message: 'Invalid signature received',
        security_event: 'invalid_signature',
        expected_prefix: computed.substring(0, 16),
        received_prefix: normalizedSignature.substring(0, 16),
        ip: req.ip
      }));
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    // Signature is valid - check for replay
    if (req.body && typeof req.body === 'object') {
      if (replayCache.isReplay(req.body)) {
        console.warn(JSON.stringify({
          level: 'warn',
          message: 'Replay detected',
          security_event: 'replay_detected',
          task_id: req.body.task_id || req.body.task?.id,
          event_id: req.body.event_id,
          ip: req.ip
        }));
        return res.status(409).json({ error: 'Duplicate event (replay detected)' });
      }
      
      // Mark as seen to prevent future replays
      replayCache.markSeen(req.body);
    }
    
    console.log(JSON.stringify({
      level: 'info',
      message: 'Signature validated successfully',
      security_event: 'valid_signature',
      event: req.body?.event,
      task_id: req.body?.task_id || req.body?.task?.id
    }));
    
    next();
    
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Signature validation error',
      security_event: 'validation_error',
      error: error.message,
      ip: req.ip
    }));
    return res.status(401).json({ error: 'Signature validation failed' });
  }
}

module.exports = validateHMAC;

