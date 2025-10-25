/**
 * Fido OS - Phase 3: Security Hardening
 * Rate Limiting Middleware
 * 
 * Lightweight rate limiter to prevent webhook abuse
 * Burst: 10 requests per second
 * Sustain: 2 requests per second
 */

class RateLimiter {
  constructor(options = {}) {
    this.burstLimit = options.burstLimit || 10;
    this.sustainLimit = options.sustainLimit || 2;
    this.windowMs = options.windowMs || 1000; // 1 second
    
    // Track requests per IP
    this.requests = new Map();
    
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be rate limited
   * @param {string} key - Rate limit key (usually IP address)
   * @returns {Object} { allowed: boolean, retryAfter: number }
   */
  checkLimit(key) {
    const now = Date.now();
    const entry = this.requests.get(key);
    
    if (!entry) {
      // First request from this key
      this.requests.set(key, {
        count: 1,
        firstRequest: now,
        lastRequest: now
      });
      return { allowed: true, retryAfter: 0 };
    }
    
    const timeSinceFirst = now - entry.firstRequest;
    const timeSinceLast = now - entry.lastRequest;
    
    // Reset window if more than 1 second has passed
    if (timeSinceFirst >= this.windowMs) {
      this.requests.set(key, {
        count: 1,
        firstRequest: now,
        lastRequest: now
      });
      return { allowed: true, retryAfter: 0 };
    }
    
    // Check burst limit (10 rps)
    if (entry.count >= this.burstLimit) {
      const retryAfter = Math.ceil((this.windowMs - timeSinceFirst) / 1000);
      return { allowed: false, retryAfter };
    }
    
    // Check sustain limit (2 rps average)
    const averageRate = entry.count / (timeSinceFirst / 1000);
    if (averageRate > this.sustainLimit && entry.count > 2) {
      const retryAfter = Math.ceil((this.windowMs - timeSinceFirst) / 1000);
      return { allowed: false, retryAfter };
    }
    
    // Allow request
    entry.count++;
    entry.lastRequest = now;
    return { allowed: true, retryAfter: 0 };
  }

  /**
   * Clean up old entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.requests.entries()) {
      if (now - entry.lastRequest > 60000) { // 1 minute
        this.requests.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(JSON.stringify({
        level: 'info',
        message: `Rate limiter cleaned up ${removed} expired entries`
      }));
    }
  }

  /**
   * Get rate limiter statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      trackedIPs: this.requests.size,
      burstLimit: this.burstLimit,
      sustainLimit: this.sustainLimit
    };
  }

  /**
   * Destroy rate limiter
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter({
  burstLimit: 10,
  sustainLimit: 2,
  windowMs: 1000
});

/**
 * Rate limiting middleware
 */
function rateLimitMiddleware(req, res, next) {
  // Feature flag
  if (process.env.ENABLE_RATE_LIMITING !== 'true') {
    return next();
  }
  
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const { allowed, retryAfter } = rateLimiter.checkLimit(key);
  
  if (!allowed) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Rate limit exceeded',
      security_event: 'rate_limit_exceeded',
      ip: key,
      retry_after: retryAfter
    }));
    
    res.set('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: retryAfter
    });
  }
  
  next();
}

module.exports = {
  rateLimitMiddleware,
  rateLimiter
};

