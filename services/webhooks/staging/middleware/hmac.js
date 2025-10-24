/**
 * Fido OS - Phase 2: Routing Webhook
 * HMAC Validation Middleware
 * 
 * Validates ClickUp webhook signatures using HMAC-SHA256
 */

const crypto = require('crypto');

/**
 * HMAC validation middleware
 * Validates X-Signature header against computed HMAC
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
    // Get raw body (must be preserved by body parser)
    const payload = JSON.stringify(req.body);
    
    // Compute HMAC
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computed = hmac.digest('hex');
    
    // Compare signatures (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    );
    
    if (!isValid) {
      console.warn('[HMAC] Invalid signature received');
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

