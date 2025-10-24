/**
 * Fido OS - Phase 2: Routing Webhook
 * Health Check Routes
 * 
 * Provides uptime and diagnostics endpoints
 */

const express = require('express');
const router = express.Router();

const startTime = Date.now();

/**
 * GET /health
 * Basic health check - always returns 200 if service is running
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'fido-clickup-routing-staging',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /ready
 * Readiness check - validates environment configuration
 */
router.get('/ready', (req, res) => {
  const requiredEnvVars = [
    'CLICKUP_API_TOKEN',
    'CLICKUP_TEAM_ID',
    'WEBHOOK_HMAC_SECRET',
    'DEFAULT_CX_USER_ID'
  ];

  const missing = requiredEnvVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    return res.status(503).json({
      status: 'not_ready',
      error: 'Missing required environment variables',
      missing,
      timestamp: new Date().toISOString()
    });
  }

  res.status(200).json({
    status: 'ready',
    service: 'fido-clickup-routing-staging',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: {
      node_version: process.version,
      platform: process.platform
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

