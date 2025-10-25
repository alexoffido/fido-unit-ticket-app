/**
 * Fido OS - Phase 3: Security Hardening
 * Main Application Entry Point
 * 
 * Stateless webhook service for intelligent ticket routing
 * 
 * Security Features:
 * - HMAC signature validation
 * - Replay protection
 * - Rate limiting
 * - Structured logging
 * - 401 alerting
 */

const express = require('express');
const { loggerMiddleware } = require('./middleware/logger');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const healthRoutes = require('./routes/health');
const webhookRoutes = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })); // Preserve raw body for HMAC
app.use(loggerMiddleware);

// Routes
app.use('/', healthRoutes);
app.use('/webhook', rateLimitMiddleware, webhookRoutes); // Rate limit webhook endpoint

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    level: 'error',
    message: 'Global error handler',
    error: err.message,
    stack: err.stack
  }));
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  Fido OS - Phase 3: Routing Webhook (Staging)        ║
╠═══════════════════════════════════════════════════════╣
║  Status: Running                                      ║
║  Port: ${PORT}                                           ║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
║  Security Features:                                   ║
║    ✓ HMAC Validation                                  ║
║    ✓ Replay Protection                                ║
║    ✓ Rate Limiting (${process.env.ENABLE_RATE_LIMITING === 'true' ? 'enabled' : 'disabled'})                        ║
║    ✓ Structured Logging                               ║
║    ✓ 401 Alerting                                     ║
║  Endpoints:                                           ║
║    GET  /health                                       ║
║    GET  /ready                                        ║
║    POST /webhook/clickup                              ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Shutdown] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;

