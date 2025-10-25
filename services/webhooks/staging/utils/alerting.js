/**
 * Fido OS - Phase 3: Security Hardening
 * Security Alerting System
 * 
 * Monitors 401 errors and sends Slack alerts for anomalies
 */

const https = require('https');

class SecurityAlerting {
  constructor() {
    this.failureWindow = 5 * 60 * 1000; // 5 minutes
    this.failureThreshold = 20;
    this.failures = [];
    this.lastAlertTime = 0;
    this.alertCooldown = 15 * 60 * 1000; // 15 minutes between alerts
  }

  /**
   * Record a 401 failure
   * @param {Object} details - Failure details
   */
  record401(details = {}) {
    const now = Date.now();
    
    this.failures.push({
      timestamp: now,
      ip: details.ip,
      reason: details.reason
    });
    
    // Clean up old failures outside the window
    this.failures = this.failures.filter(
      f => now - f.timestamp < this.failureWindow
    );
    
    // Check if threshold exceeded
    if (this.failures.length >= this.failureThreshold) {
      this.checkAndAlert();
    }
  }

  /**
   * Check if alert should be sent
   */
  checkAndAlert() {
    const now = Date.now();
    
    // Don't spam alerts - respect cooldown
    if (now - this.lastAlertTime < this.alertCooldown) {
      return;
    }
    
    const count = this.failures.length;
    const uniqueIPs = new Set(this.failures.map(f => f.ip)).size;
    
    console.warn(JSON.stringify({
      level: 'warn',
      message: `Security anomaly detected: ${count} 401s in 5 minutes`,
      security_event: 'anomaly_detected',
      failure_count: count,
      unique_ips: uniqueIPs,
      threshold: this.failureThreshold
    }));
    
    this.sendSlackAlert(count, uniqueIPs);
    this.lastAlertTime = now;
  }

  /**
   * Send Slack alert
   * @param {number} count - Number of failures
   * @param {number} uniqueIPs - Number of unique IPs
   */
  sendSlackAlert(count, uniqueIPs) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.log(JSON.stringify({
        level: 'info',
        message: 'Slack webhook not configured, skipping alert'
      }));
      return;
    }
    
    const message = {
      text: `🚨 *Fido OS Security Alert*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Security Anomaly Detected'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Service:*\nfido-clickup-routing-staging`
            },
            {
              type: 'mrkdwn',
              text: `*Event:*\nHigh 401 rate`
            },
            {
              type: 'mrkdwn',
              text: `*Failures:*\n${count} in 5 minutes`
            },
            {
              type: 'mrkdwn',
              text: `*Unique IPs:*\n${uniqueIPs}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Possible Causes:*\n• HMAC secret mismatch\n• Replay attacks\n• Webhook misconfiguration\n• Malicious requests`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Threshold: ${this.failureThreshold} failures in 5 minutes`
            }
          ]
        }
      ]
    };
    
    const payload = JSON.stringify(message);
    const url = new URL(webhookUrl);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log(JSON.stringify({
          level: 'info',
          message: 'Slack alert sent successfully'
        }));
      } else {
        console.error(JSON.stringify({
          level: 'error',
          message: 'Failed to send Slack alert',
          status_code: res.statusCode
        }));
      }
    });
    
    req.on('error', (error) => {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Error sending Slack alert',
        error: error.message
      }));
    });
    
    req.write(payload);
    req.end();
  }

  /**
   * Get alerting statistics
   * @returns {Object} Stats
   */
  getStats() {
    const now = Date.now();
    const recentFailures = this.failures.filter(
      f => now - f.timestamp < this.failureWindow
    );
    
    return {
      recentFailures: recentFailures.length,
      threshold: this.failureThreshold,
      windowMinutes: this.failureWindow / 60000,
      lastAlertMinutesAgo: this.lastAlertTime ? 
        Math.floor((now - this.lastAlertTime) / 60000) : null
    };
  }
}

// Singleton instance
const securityAlerting = new SecurityAlerting();

module.exports = securityAlerting;

