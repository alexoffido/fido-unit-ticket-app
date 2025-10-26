/**
 * HMAC Signature Debug Test
 */

const crypto = require('crypto');
const https = require('https');

const SECRET = '9a70d8e7fc36b063f19386609d6fd64dc09921a23d8a1c5bb8d1489bb6ddaa1d';
const SERVICE_URL = 'https://fido-unit-ticket-app-staging.up.railway.app';

// Test payload
const payload = {
  event: 'taskCreated',
  task_id: 'hmac_debug_test_' + Date.now(),
  webhook_id: 'debug_test'
};

const body = JSON.stringify(payload);

// Generate signature
const hmac = crypto.createHmac('sha256', SECRET);
hmac.update(body);
const signature = hmac.digest('hex');

console.log('='.repeat(60));
console.log('HMAC Debug Test');
console.log('='.repeat(60));
console.log('Payload:', body);
console.log('Secret (first 16 chars):', SECRET.substring(0, 16) + '...');
console.log('Generated signature:', signature);
console.log('Signature length:', signature.length);
console.log('');

// Send request
const url = new URL(SERVICE_URL);
const options = {
  hostname: url.hostname,
  port: 443,
  path: '/webhook/clickup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Signature': signature
  }
};

console.log('Sending request to:', SERVICE_URL + '/webhook/clickup');
console.log('Headers:', JSON.stringify(options.headers, null, 2));
console.log('');

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', chunk => data += chunk);
  
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response body:', data);
    console.log('');
    
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS: Signature validated!');
    } else if (res.statusCode === 401) {
      console.log('❌ FAILURE: Signature rejected (401)');
      console.log('This means the HMAC computation is different on server side');
    } else if (res.statusCode === 409) {
      console.log('✅ SUCCESS: Signature validated (replay detected - expected on 2nd run)');
    } else {
      console.log('⚠️  UNEXPECTED: Status code', res.statusCode);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
});

req.write(body);
req.end();

