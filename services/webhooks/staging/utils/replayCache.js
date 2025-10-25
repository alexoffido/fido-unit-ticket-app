/**
 * Fido OS - Phase 3: Security Hardening
 * Replay Protection Cache
 * 
 * Prevents duplicate or replayed webhook events using short-term cache
 */

class ReplayCache {
  constructor(ttlMinutes = 10) {
    this.cache = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Generate cache key from event data
   * @param {Object} event - ClickUp webhook event
   * @returns {string} Cache key
   */
  generateKey(event) {
    // Prefer event_id if available, fallback to task_id + timestamp
    if (event.event_id) {
      return `event:${event.event_id}`;
    }
    
    const taskId = event.task_id || event.task?.id || 'unknown';
    const timestamp = event.event_time || event.history_items?.[0]?.date || Date.now();
    
    return `task:${taskId}:${timestamp}`;
  }

  /**
   * Check if event has been seen before (replay detection)
   * @param {Object} event - ClickUp webhook event
   * @returns {boolean} True if event is a replay
   */
  isReplay(event) {
    const key = this.generateKey(event);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false; // Not seen before
    }
    
    // Check if entry is still valid (not expired)
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key); // Expired, remove it
      return false;
    }
    
    return true; // Replay detected
  }

  /**
   * Mark event as seen
   * @param {Object} event - ClickUp webhook event
   */
  markSeen(event) {
    const key = this.generateKey(event);
    this.cache.set(key, {
      timestamp: Date.now(),
      taskId: event.task_id || event.task?.id
    });
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`[ReplayCache] Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      ttlMinutes: this.ttlMs / 60000
    };
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Singleton instance
const replayCache = new ReplayCache(10); // 10-minute TTL

module.exports = replayCache;

