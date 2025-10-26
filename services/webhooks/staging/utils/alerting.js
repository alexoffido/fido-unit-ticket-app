/**
 * Fido OS - Security Alerting Module
 * 
 * Monitors 401 failures and sends Slack alerts when threshold is exceeded.
 * Uses Slack Web API (chat.postMessage) with bot token authentication.
 * 
 * Environment Variables:
 * - SLACK_BOT_TOKEN: Slack bot token for authentication
 * - ALERT_CHANNEL_ID: Slack channel ID for alerts (e.g., C09NVLUNDL4)
 * 
 * Features:
 * - 5-minute sliding window for failure tracking
 * - Threshold: 20 failures triggers alert
 * - 15-minute cooldown between alerts
 * - Tracks unique IPs and failure reasons
 */

const https = require('https');

class SecurityAlerting {
  constructor() {
    this.failureWindow = 5 * 60 * 1000; // 5 minutes
    this.failureThreshold = 20;
    this.alertCooldown = 15 * 60 * 1000; // 15 minutes
    this.failures = [];
    this.lastAlertTime = 0;
    
    // Slack configuration
    this.slackBotToken = process.env.SLACK_BOT_TOKEN;
    this.alertChannelId = process.env.ALERT_CHANNEL_ID;
    this.alertsEnabled = !!(this.slackBotToken && this.alertChannelId);
    
    if (!this.alertsEnabled) {
      console.log(JSON.stringify({
        level: 'info',
        message: 'Slack alerts disabled (SLACK_BOT_TOKEN or ALERT_CHANNEL_ID not configured)',
        timestamp: new Date().toISOString()
      }));
    } else {
      console.log(JSON.stringify({
        level: 'info',
        message: 'Slack alerts enabled',
        channel_id: this.alertChannelId,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Record a 401 failure
   * @param {Object} details - Failure details (ip, reason)
   */
  record401(details) {
    const now = Date.now();
    
    this.failures.push({
      timestamp: now,
      ip: details.ip || 'unknown',
      reason: details.reason || 'unknown'
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
   * Check threshold and send alert if needed
   */
  checkAndAlert() {
    const now = Date.now();
    const timeSinceLastAlert = now - this.lastAlertTime;
    
    // Check cooldown
    if (timeSinceLastAlert < this.alertCooldown) {
      const minutesRemaining = Math.ceil((this.alertCooldown - timeSinceLastAlert) / 60000);
      console.log(JSON.stringify({
        level: 'info',
        message: 'Alert threshold exceeded but cooldown active',
        failures: this.failures.length,
        cooldown_remaining_minutes: minutesRemaining,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // Calculate stats
    const uniqueIPs = new Set(this.failures.map(f => f.ip)).size;
    const reasonCounts = {};
    this.failures.forEach(f => {
      reasonCounts[f.reason] = (reasonCounts[f.reason] || 0) + 1;
    });
    
    // Send alert
    this.sendSlackAlert(this.failures.length, uniqueIPs, reasonCounts);
    this.lastAlertTime = now;
  }

  /**
   * Send Slack alert using Web API (chat.postMessage)
   * @param {number} count - Number of failures
   * @param {number} uniqueIPs - Number of unique IPs
   * @param {Object} reasonCounts - Failure reason counts
   */
  async sendSlackAlert(count, uniqueIPs, reasonCounts) {
    if (!this.alertsEnabled) {
      console.log(JSON.stringify({
        level: 'warn',
        message: 'Alert would be sent but Slack not configured',
        failures: count,
        unique_ips: uniqueIPs,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // Build alert message
    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => `• ${reason}: ${count}`)
      .join('\n');

    const message = {
      channel: this.alertChannelId,
      text: '🚨 Fido OS Security Alert: High 401 rate detected',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Security Anomaly Detected',
            emoji: true
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
            text: `*Top Failure Reasons:*\n${topReasons}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Possible Causes:*\n• HMAC secret mismatch\n• Replay attacks\n• Webhook misconfiguration\n• Malicious requests'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⏰ ${new Date().toISOString()} | Next alert cooldown: 15 minutes`
            }
          ]
        }
      ]
    };

    const payload = JSON.stringify(message);
    const options = {
      hostname: 'slack.com',
      port: 443,
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.slackBotToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.ok) {
              console.log(JSON.stringify({
                level: 'info',
                message: 'Slack alert sent successfully',
                failures: count,
                unique_ips: uniqueIPs,
                channel: this.alertChannelId,
                timestamp: new Date().toISOString()
              }));
              resolve(response);
            } else {
              console.error(JSON.stringify({
                level: 'error',
                message: 'Slack alert failed',
                error: response.error,
                timestamp: new Date().toISOString()
              }));
              reject(new Error(response.error));
            }
          } catch (err) {
            console.error(JSON.stringify({
              level: 'error',
              message: 'Failed to parse Slack response',
              error: err.message,
              timestamp: new Date().toISOString()
            }));
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        console.error(JSON.stringify({
          level: 'error',
          message: 'Slack request failed',
          error: err.message,
          timestamp: new Date().toISOString()
        }));
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Get current stats for monitoring
   * @returns {Object} Current failure stats
   */
  getStats() {
    const now = Date.now();
    const recentFailures = this.failures.filter(
      f => now - f.timestamp < this.failureWindow
    );
    
    return {
      recentFailures: recentFailures.length,
      threshold: this.failureThreshold,
      lastAlertMinutesAgo: this.lastAlertTime 
        ? Math.floor((now - this.lastAlertTime) / 60000)
        : null,
      alertsEnabled: this.alertsEnabled,
      channelId: this.alertChannelId
    };
  }

  /**
   * Reset failure tracking (for testing)
   */
  reset() {
    this.failures = [];
    this.lastAlertTime = 0;
  }
}

// Singleton instance
const securityAlerting = new SecurityAlerting();

module.exports = securityAlerting;

