const { App } = require('@slack/bolt');
const axios = require('axios');
require('dotenv').config();

// Initialize Slack Bolt app with proper error handling
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
  port: process.env.PORT || 3000
});

// ClickUp API configuration
const clickupAPI = axios.create({
  baseURL: 'https://api.clickup.com/api/v2',
  headers: {
    'Authorization': process.env.CLICKUP_API_TOKEN || '',
    'Content-Type': 'application/json'
  }
} );

// Channel IDs
const CHANNELS = {
  FIDO_CX: process.env.FIDO_CX_CHANNEL_ID || 'C07PN5F527N',
  CX_UNIT_CHANGES: process.env.CX_UNIT_CHANGES_CHANNEL_ID || 'C08M77HMRT9'
};

// Market codes mapping
const MARKETS = {
  'atx': 'Austin',
  'lax': 'Los Angeles', 
  'npb': 'Newport Beach',
  'hhh': 'Hilton Head',
  'san': 'San Diego'
};

// Team routing
const TEAM_ROUTING = {
  'issue': '@bp-operations',
  'inquiry': '@cx',
  'unit-change': '@bpo-mgmt'
};

// Priority levels
const PRIORITY_LEVELS = {
  'urgent': '🔴 URGENT',
  'high': '🟠 HIGH', 
  'normal': '🟡 NORMAL',
  'low': '🟢 LOW'
};

// Issue types for service issues
const ISSUE_TYPES = {
  'bin-placement': 'Bin Placement Issue',
  'access-problem': 'Access Problem',
  'schedule-conflict': 'Schedule Conflict',
  'property-logistics': 'Property Logistics',
  'customer-feedback': 'Customer Feedback',
  'service-quality': 'Service Quality Issue'
};

// Unit change types
const UNIT_CHANGE_TYPES = {
  'new-unit': 'NEW UNIT',
  'cancellation': 'CANCELLATION',
  'pause': 'PAUSE SERVICE',
  'restart': 'RESTART SERVICE'
};

// Helper function to create ClickUp task
async function createClickUpTask(taskData) {
  try {
    if (!process.env.CLICKUP_API_TOKEN || process.env.CLICKUP_API_TOKEN === 'your-clickup-token-here') {
      console.log('ClickUp not configured, skipping task creation');
      return null;
    }
    
    const response = await clickupAPI.post(`/list/${process.env.CLICKUP_LIST_ID}/task`, taskData);
    return response.data;
  } catch (error) {
    console.error('Error creating ClickUp task:', error.response?.data || error.message);
    return null;
  }
}

// Helper function to format ticket message
function formatTicketMessage(type, data, ticketId) {
  const timestamp = new Date().toISOString().split('T')[0];
  const routing = TEAM_ROUTING[type];
  
  if (type === 'unit-change') {
    return `ATTN: ${routing} the CX Team has logged a unit change request - please review & follow up in this thread asap!

**Unit Change Type:** ${data.changeType}
**Date:** ${timestamp}
**Property:** ${data.property}
**Client:** ${data.client}
**Market:** ${data.market}
**Details:** ${data.details}
**Effective Date:** ${data.effectiveDate || 'Immediate'}
**Source:** Fido Ticketing System
**Ticket ID:** ${ticketId}`;
  } else {
    return `ATTN: ${routing} the CX Team has logged a customer ${type} - please review & follow up in this thread asap!

**Issue Date:** ${timestamp}
**Property:** ${data.property}
**Client:** ${data.client}
**Market:** ${data.market}
**${type === 'issue' ? 'Description of Issue' : 'Inquiry Details'}:** ${data.description}
**${type === 'issue' ? 'Issue Type' : 'Inquiry Type'}:** ${data.type}
**Priority:** ${data.priority}
**Source:** ${data.source}
**Ticket ID:** ${ticketId}`;
  }
}

// Generate unique ticket ID
function generateTicketId(type) {
  const prefix = type === 'issue' ? 'FI' : type === 'inquiry' ? 'FQ' : 'FU';
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${timestamp}`;
}

// Health check endpoint
app.receiver.app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'fido-ticketing-suite',
    version: '1.0.0'
  });
});

// Test endpoint
app.receiver.app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Fido Ticketing Suite is running!',
    timestamp: new Date().toISOString()
  });
});

// Slash command: /fido-issue
app.command('/fido-issue', async ({ command, ack, body, client }) => {
  await ack();
  
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'fido_issue_modal',
        title: {
          type: 'plain_text',
          text: 'Create Service Issue Ticket'
        },
        submit: {
          type: 'plain_text',
          text: 'Create Ticket'
        },
        close: {
          type: 'plain_text',
          text: 'Cancel'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'property_block',
            element: {
              type: 'plain_text_input',
              action_id: 'property_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., 1903 Albury Cove Unit D'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Property Address'
            }
          },
          {
            type: 'input',
            block_id: 'client_block',
            element: {
              type: 'plain_text_input',
              action_id: 'client_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., nomad str'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Client Name'
            }
          },
          {
            type: 'input',
            block_id: 'market_block',
            element: {
              type: 'static_select',
              action_id: 'market_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select market'
              },
              options: Object.entries(MARKETS).map(([code, name]) => ({
                text: {
                  type: 'plain_text',
                  text: `${name} (${code.toUpperCase()})`
                },
                value: code
              }))
            },
            label: {
              type: 'plain_text',
              text: 'Market'
            }
          },
          {
            type: 'input',
            block_id: 'issue_type_block',
            element: {
              type: 'static_select',
              action_id: 'issue_type_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select issue type'
              },
              options: Object.entries(ISSUE_TYPES).map(([key, value]) => ({
                text: {
                  type: 'plain_text',
                  text: value
                },
                value: key
              }))
            },
            label: {
              type: 'plain_text',
              text: 'Issue Type'
            }
          },
          {
            type: 'input',
            block_id: 'priority_block',
            element: {
              type: 'static_select',
              action_id: 'priority_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select priority'
              },
              options: Object.entries(PRIORITY_LEVELS).map(([key, value]) => ({
                text: {
                  type: 'plain_text',
                  text: value
                },
                value: key
              }))
            },
            label: {
              type: 'plain_text',
              text: 'Priority Level'
            }
          },
          {
            type: 'input',
            block_id: 'description_block',
            element: {
              type: 'plain_text_input',
              action_id: 'description_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Describe the service issue in detail...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Description of Issue'
            }
          },
          {
            type: 'input',
            block_id: 'source_block',
            element: {
              type: 'plain_text_input',
              action_id: 'source_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., OpenPhone - TextRec09AJ1PS4PR'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Complaint Source'
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening modal:', error);
  }
});

// Handle modal submissions
app.view('fido_issue_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  try {
    const values = view.state.values;
    const ticketId = generateTicketId('issue');
    
    const ticketData = {
      property: values.property_block.property_input.value,
      client: values.client_block.client_input.value,
      market: values.market_block.market_select.selected_option.value,
      type: ISSUE_TYPES[values.issue_type_block.issue_type_select.selected_option.value],
      priority: PRIORITY_LEVELS[values.priority_block.priority_select.selected_option.value],
      description: values.description_block.description_input.value,
      source: values.source_block.source_input.value
    };
    
    const message = formatTicketMessage('issue', ticketData, ticketId);
    
    // Post to #fido-cx channel
    await client.chat.postMessage({
      channel: CHANNELS.FIDO_CX,
      text: message,
      mrkdwn: true
    });
    
    console.log(`Created service issue ticket ${ticketId} for ${ticketData.property}`);
    
  } catch (error) {
    console.error('Error handling issue modal submission:', error);
  }
});

// Start the app
(async () => {
  try {
    await app.start();
    console.log('⚡️ Fido Ticketing Suite is running!');
    console.log(`🚀 Server started on port ${process.env.PORT || 3000}`);
    console.log('📋 Available commands:');
    console.log('   /fido-issue - Create service issue tickets');
  } catch (error) {
    console.error('Error starting app:', error);
    process.exit(1);
  }
})();
