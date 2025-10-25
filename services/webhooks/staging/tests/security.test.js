/**
 * Fido OS - Phase 3: Security Hardening
 * Unit Tests for Security Features
 * 
 * Tests:
 * - HMAC signature validation
 * - Signature length mismatch
 * - Header case variants
 * - Replay detection
 * - Rate limiting
 */

const crypto = require('crypto');
const request = require('supertest');
const app = require('../index');
const replayCache = require('../utils/replayCache');
const { rateLimiter } = require('../middleware/rateLimit');

const TEST_SECRET = process.env.WEBHOOK_HMAC_SECRET || 'test_secret_for_unit_tests';

/**
 * Generate valid HMAC signature for payload
 * @param {Object} payload - Request payload
 * @returns {string} HMAC signature
 */
function generateSignature(payload) {
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', TEST_SECRET);
  hmac.update(body);
  return hmac.digest('hex');
}

describe('Security Features', () => {
  
  describe('HMAC Signature Validation', () => {
    
    test('Valid signature should be accepted', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_valid_sig'
      };
      
      const signature = generateSignature(payload);
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', signature)
        .send(payload);
      
      // Should not be 401 (signature validated)
      expect(response.status).not.toBe(401);
    });
    
    test('Invalid signature should return 401', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_invalid_sig'
      };
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', 'invalid_signature_12345')
        .send(payload);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/signature/i);
    });
    
    test('Missing signature should return 401', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_missing_sig'
      };
      
      const response = await request(app)
        .post('/webhook/clickup')
        .send(payload);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/signature/i);
    });
    
  });
  
  describe('Signature Length Mismatch', () => {
    
    test('Short signature should return 401', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_short_sig'
      };
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', 'short')
        .send(payload);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/signature/i);
    });
    
    test('Long signature should return 401', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_long_sig'
      };
      
      const longSignature = 'a'.repeat(128); // 128 chars instead of 64
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', longSignature)
        .send(payload);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/signature/i);
    });
    
  });
  
  describe('Header Case Variants', () => {
    
    test('Lowercase x-signature should work', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_lowercase_header'
      };
      
      const signature = generateSignature(payload);
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('x-signature', signature) // lowercase
        .send(payload);
      
      expect(response.status).not.toBe(401);
    });
    
    test('Uppercase X-Signature should work', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_uppercase_header'
      };
      
      const signature = generateSignature(payload);
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', signature) // uppercase
        .send(payload);
      
      expect(response.status).not.toBe(401);
    });
    
    test('Uppercase signature value should work', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_uppercase_value'
      };
      
      const signature = generateSignature(payload).toUpperCase();
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', signature)
        .send(payload);
      
      expect(response.status).not.toBe(401);
    });
    
  });
  
  describe('Replay Detection', () => {
    
    beforeEach(() => {
      // Clear replay cache before each test
      replayCache.cache.clear();
    });
    
    test('First request should be accepted', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_first_request',
        event_time: Date.now()
      };
      
      const signature = generateSignature(payload);
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', signature)
        .send(payload);
      
      expect(response.status).not.toBe(409); // Not a replay
    });
    
    test('Duplicate request should return 409', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_duplicate',
        event_time: Date.now()
      };
      
      const signature = generateSignature(payload);
      
      // First request
      await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', signature)
        .send(payload);
      
      // Duplicate request
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', signature)
        .send(payload);
      
      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/replay/i);
    });
    
    test('Different event_id should not be detected as replay', async () => {
      const payload1 = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_unique_1',
        event_time: Date.now()
      };
      
      const payload2 = {
        event: 'taskCreated',
        task_id: 'test123',
        event_id: 'evt_unique_2',
        event_time: Date.now()
      };
      
      const sig1 = generateSignature(payload1);
      const sig2 = generateSignature(payload2);
      
      // First request
      await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', sig1)
        .send(payload1);
      
      // Second request with different event_id
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', sig2)
        .send(payload2);
      
      expect(response.status).not.toBe(409);
    });
    
  });
  
  describe('Rate Limiting', () => {
    
    beforeEach(() => {
      // Clear rate limiter before each test
      rateLimiter.requests.clear();
      
      // Enable rate limiting for tests
      process.env.ENABLE_RATE_LIMITING = 'true';
    });
    
    afterEach(() => {
      // Disable rate limiting after tests
      process.env.ENABLE_RATE_LIMITING = 'false';
    });
    
    test('Burst limit should block after 10 requests', async () => {
      const payload = {
        event: 'taskCreated',
        task_id: 'test123'
      };
      
      // Send 10 requests (should all succeed)
      for (let i = 0; i < 10; i++) {
        payload.event_id = `evt_burst_${i}`;
        const signature = generateSignature(payload);
        
        const response = await request(app)
          .post('/webhook/clickup')
          .set('X-Signature', signature)
          .send(payload);
        
        expect(response.status).not.toBe(429);
      }
      
      // 11th request should be rate limited
      payload.event_id = 'evt_burst_11';
      const signature = generateSignature(payload);
      
      const response = await request(app)
        .post('/webhook/clickup')
        .set('X-Signature', signature)
        .send(payload);
      
      expect(response.status).toBe(429);
      expect(response.body.error).toMatch(/too many requests/i);
    });
    
  });
  
});

describe('Replay Cache', () => {
  
  beforeEach(() => {
    replayCache.cache.clear();
  });
  
  test('generateKey should use event_id if available', () => {
    const event = { event_id: 'evt_123', task_id: 'task_456' };
    const key = replayCache.generateKey(event);
    expect(key).toBe('event:evt_123');
  });
  
  test('generateKey should fallback to task_id + timestamp', () => {
    const event = { task_id: 'task_456', event_time: 1234567890 };
    const key = replayCache.generateKey(event);
    expect(key).toBe('task:task_456:1234567890');
  });
  
  test('isReplay should return false for new events', () => {
    const event = { event_id: 'evt_new' };
    expect(replayCache.isReplay(event)).toBe(false);
  });
  
  test('isReplay should return true for seen events', () => {
    const event = { event_id: 'evt_seen' };
    replayCache.markSeen(event);
    expect(replayCache.isReplay(event)).toBe(true);
  });
  
  test('Expired entries should not be detected as replays', () => {
    const event = { event_id: 'evt_expired' };
    
    // Mark as seen with old timestamp
    const key = replayCache.generateKey(event);
    replayCache.cache.set(key, {
      timestamp: Date.now() - (11 * 60 * 1000), // 11 minutes ago
      taskId: 'test'
    });
    
    expect(replayCache.isReplay(event)).toBe(false);
  });
  
});

console.log('✅ All security tests defined');
console.log('Run with: npm test');

