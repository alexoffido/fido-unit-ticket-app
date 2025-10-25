/**
 * Fido OS - Phase 2: Routing Webhook
 * HMAC Validation Middleware
 * 
 * Validates ClickUp webhook signatures using HMAC-SHA256
 * CRITICAL: Uses RAW request body for signature validation
 */

const crypto = require('crypto');

/**
 * HMAC validation middleware
 * Validates X-Signature header against computed HMAC
 * 
 * SECURITY REQUIREMENTS:
 * - Must compute HMAC over RAW request body (before JSON parsing)
 * - Must use timing-safe comparison
 * - Must use equal-length buffers
 */
function validateHMAC(req, res, next) {
  const secret = process.env.WEBHOOK_HMAC_SECRET;
  
  if (!secret) {
    console.error('[HMAC] WEBHOOK_HMAC_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const signature = req.headers['x-signature'];
  
  if (!signature) {
    console.warn('[HMAC] Request missing X-Signature header');
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  try {
    // CRITICAL: Use raw body buffer, not parsed JSON
    // The rawBody is attached by express.json({ verify: ... }) in index.js
    const rawBody = req.rawBody;
    
    if (!rawBody) {
      console.error('[HMAC] Raw body not available - check body parser configuration');
      return res.status(500).json({ error: 'Internal configuration error' });
    }
    
    // Compute HMAC over raw body
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const computed = hmac.digest('hex');
    
    // Timing-safe comparison with equal-length buffers
    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computed);
    
    // Ensure buffers are same length (prevents timing attacks)
    if (signatureBuffer.length !== computedBuffer.length) {
      console.warn('[HMAC] Invalid signature length');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    const isValid = crypto.timingSafeEqual(signatureBuffer, computedBuffer);
    
    if (!isValid) {
      console.warn('[HMAC] Invalid signature received');
      console.warn(`[HMAC] Expected: ${computed.substring(0, 16)}...`);
      console.warn(`[HMAC] Received: ${signature.substring(0, 16)}...`);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    console.log('[HMAC] Signature validated successfully');
    next();
    
  } catch (error) {
    console.error('[HMAC] Validation error:', error.message);
    return res.status(401).json({ error: 'Signature validation failed' });
  }
}

module.exports = validateHMAC;

