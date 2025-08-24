/**
 * ClickUp Service - Fido Ticketing Integration
 * Handles task creation in ClickUp with proper field mapping
 */

const axios = require('axios');
const CLICKUP_OPTIONS = require('./clickup-options');

class ClickUpService {
  constructor() {
    this.apiToken = process.env.CLICKUP_API_TOKEN;
    this.teamId = process.env.CLICKUP_TEAM_ID || '9013484736';
    
    // List IDs from our ClickUp setup
    this.listIds = {
      issues: process.env.CLICKUP_LIST_ID_ISSUES || '901318355853',
      inquiries: process.env.CLICKUP_LIST_ID_INQUIRIES || '901318355854', 
      units: process.env.CLICKUP_LIST_ID_UNITS || '901318355855'
    };

    // Canonical field IDs from our ClickUp setup
    this.fieldIds = {
      // Universal fields (all lists)
      slack_ticket_id: '33b8dd0f-68a0-42f8-b1dd-bd79463e91f8',
      slack_permalink: '8318e7bc-9bc7-41f7-9fb0-7a97b3cf54dc',
      submitted_by: 'ff818d8e-2df8-4f1d-8af8-7ed5b64d17c7',
      client_name: '90b9689a-50d3-4eac-b26b-6ddf84461e12',
      property_address: 'ad75b614-304e-421e-a923-18eef2b56e0e',
      market_code: 'f2bdad72-a65f-498f-ab6b-87d01ef27a42',
      date_created: '0b508526-5988-4d62-8d88-974a7c5d4845',
      source_method: '1f02861f-2a54-4e2f-bccb-da6c6d522cc8',
      source_reference: 'a3ba020e-d13c-4e6a-a107-c8bb96beead1',
      notes: 'ddbdb34b-7fdc-4ea8-ace1-2151b935dc9f',

      // Service Issues specific
      issue_type: '5ab92618-6600-4811-9439-5425898a266a',
      priority_level: 'dc226975-6c88-4cc0-b437-154fa1e4e1c9',
      issue_description: '6452a341-860c-4d79-ba71-59a1393cab65',
      resolution_status: 'b38effd3-7dd8-4504-b393-d83e1aba6b66',
      assigned_operator: '8245bb76-5b04-4e59-bbce-6c7ae2a869e6',
      resolution_notes: 'bb0be5b1-7767-431a-bc05-846f5914b4b1',

      // Customer Inquiries specific
      inquiry_type: 'c1e89cc1-5ef7-462d-a6fd-4938dc12b0ef',
      response_priority: 'a1554438-65dd-4b40-be1e-cae260701242',
      customer_question: 'd30714e5-6760-432a-b079-fec1fb4bbf1b',
      response_status: 'bbab97e7-50cc-409d-9f54-c179f93bdf7f',
      assigned_cx_rep: '878e8205-b43c-4048-a339-6ce4f5329742',
      response_notes: '12d117ab-31c8-46d5-a3a4-85ba3690f83d',
      followup_required: 'af82613b-f131-4e91-9780-cd2a325d642f',

      // Unit Management specific
      change_type: 'feca4b5e-dbed-4ce0-8e92-f4962262e4bf',
      trash_pickup_day: '68f9650b-22f8-4e1a-8745-5c4b01b22443',
      recycling_day: 'd13280be-f0b4-479f-88ca-c1de8bf48439',
      effective_date: '7a8af633-80dd-4218-8eef-4b9387885876',
      reason_for_change: '967bc4c4-16cb-4521-a2e7-dc49610e8d04',
      special_instructions: 'e8943d15-7f05-427a-ab7a-a89877414676',
      processing_status: '252fa953-a517-4db4-b63a-d0577b7492a4',
      assigned_bpo_rep: '172d9b67-aede-4fc8-a1d7-87ab0e0ec61d',
      implementation_notes: '04e64e7f-0253-43a0-9577-9d297bdf7e81'
    };

    this.baseURL = 'https://api.clickup.com/api/v2';
    this.headers = {
      'Authorization': this.apiToken,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a ClickUp task from Slack modal data
   * @param {string} ticketType - 'issue', 'inquiry', or 'unit'
   * @param {Object} modalData - Extracted data from Slack modal
   * @param {string} slackPermalink - Slack thread permalink
   * @param {string} submittedBy - Slack user ID
   * @returns {Promise<Object>} ClickUp task response with URL
   */
  async createTask(ticketType, modalData, slackPermalink, submittedBy) {
    try {
      // Validate inputs
      if (!this.apiToken) {
        throw new Error('ClickUp API token not configured');
      }

      if (!['issue', 'inquiry', 'unit'].includes(ticketType)) {
        throw new Error(`Invalid ticket type: ${ticketType}`);
      }

      // Get target list ID
      const listId = this.listIds[ticketType === 'unit' ? 'units' : `${ticketType}s`];
      if (!listId) {
        throw new Error(`List ID not found for ticket type: ${ticketType}`);
      }

      // Build task payload
      const taskPayload = this.buildTaskPayload(ticketType, modalData, slackPermalink, submittedBy);

      // Create task in ClickUp
      const response = await axios.post(
        `${this.baseURL}/list/${listId}/task`,
        taskPayload,
        { headers: this.headers }
      );

      const task = response.data;
      
      // Return task details
      return {
        success: true,
        taskId: task.id,
        taskUrl: task.url,
        taskName: task.name,
        listId: listId
      };

    } catch (error) {
      console.error('ClickUp task creation error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.err || error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Build ClickUp task payload from modal data
   */
  buildTaskPayload(ticketType, modalData, slackPermalink, submittedBy) {
    const { ticketId, property, clientName, market, dateStr } = modalData;

    // Base task structure
    const payload = {
      name: `${ticketId} - ${property}`,
      description: this.buildTaskDescription(ticketType, modalData),
      status: 'Open',
      priority: this.mapPriorityToClickUp(modalData.priority),
      custom_fields: []
    };

    // Add universal custom fields
    this.addUniversalFields(payload.custom_fields, modalData, slackPermalink, submittedBy);

    // Add type-specific custom fields
    switch (ticketType) {
      case 'issue':
        this.addIssueFields(payload.custom_fields, modalData);
        break;
      case 'inquiry':
        this.addInquiryFields(payload.custom_fields, modalData);
        break;
      case 'unit':
        this.addUnitFields(payload.custom_fields, modalData);
        break;
    }

    return payload;
  }

  /**
   * Add universal custom fields to all task types
   */
  addUniversalFields(customFields, modalData, slackPermalink, submittedBy) {
    const { ticketId, clientName, property, market, dateStr, source, sourceDetails } = modalData;

    // Add universal fields
    customFields.push(
      { id: this.fieldIds.slack_ticket_id, value: ticketId },
      { id: this.fieldIds.slack_permalink, value: slackPermalink },
      { id: this.fieldIds.submitted_by, value: submittedBy },
      { id: this.fieldIds.client_name, value: clientName },
      { id: this.fieldIds.property_address, value: property },
      { id: this.fieldIds.market_code, value: this.getOptionId('market_code', market.toLowerCase()) },
      { id: this.fieldIds.date_created, value: new Date().getTime() }, // Unix timestamp
      { id: this.fieldIds.source_method, value: this.getOptionId('source_method', source) },
    );

    // Add source reference if provided
    if (sourceDetails) {
      customFields.push({ id: this.fieldIds.source_reference, value: sourceDetails });
    }

    // Add notes if provided
    if (modalData.notes) {
      customFields.push({ id: this.fieldIds.notes, value: modalData.notes });
    }
  }

  /**
   * Add service issue specific fields
   */
  addIssueFields(customFields, modalData) {
    const { issueType, priority, description } = modalData;

    customFields.push(
      { id: this.fieldIds.issue_type, value: this.getOptionId('issue_type', issueType) },
      { id: this.fieldIds.priority_level, value: this.getOptionId('priority_level', priority) },
      { id: this.fieldIds.issue_description, value: description },
      { id: this.fieldIds.resolution_status, value: this.getOptionId('resolution_status', 'open') }
    );
  }

  /**
   * Add customer inquiry specific fields
   */
  addInquiryFields(customFields, modalData) {
    const { inquiryType, priority, details } = modalData;

    customFields.push(
      { id: this.fieldIds.inquiry_type, value: this.getOptionId('inquiry_type', inquiryType) },
      { id: this.fieldIds.response_priority, value: this.getOptionId('response_priority', priority) },
      { id: this.fieldIds.customer_question, value: details },
      { id: this.fieldIds.response_status, value: this.getOptionId('response_status', 'pending') },
      { id: this.fieldIds.followup_required, value: false }
    );
  }

  /**
   * Add unit management specific fields
   */
  addUnitFields(customFields, modalData) {
    const { changeType, trashDay, recyclingDay, effectiveDate, reason, instructions } = modalData;

    customFields.push(
      { id: this.fieldIds.change_type, value: this.getOptionId('change_type', changeType) },
      { id: this.fieldIds.effective_date, value: new Date(effectiveDate).getTime() },
      { id: this.fieldIds.reason_for_change, value: reason },
      { id: this.fieldIds.processing_status, value: this.getOptionId('processing_status', 'pending') }
    );

    // Add trash day if provided
    if (trashDay) {
      customFields.push({ id: this.fieldIds.trash_pickup_day, value: this.getOptionId('trash_pickup_day', trashDay) });
    }

    // Add recycling day if provided
    if (recyclingDay && recyclingDay !== 'none') {
      let recyclingValue;
      if (recyclingDay === 'same_as_trash') {
        // Use trash day for recycling
        recyclingValue = this.getOptionId('recycling_day', trashDay);
      } else {
        recyclingValue = this.getOptionId('recycling_day', recyclingDay);
      }
      customFields.push({ id: this.fieldIds.recycling_day, value: recyclingValue });
    }

    // Add special instructions if provided
    if (instructions) {
      customFields.push({ id: this.fieldIds.special_instructions, value: instructions });
    }
  }

  /**
   * Get ClickUp option ID for dropdown fields
   */
  getOptionId(fieldType, value) {
    if (!value) return null;
    
    const options = CLICKUP_OPTIONS[fieldType];
    if (!options) {
      console.warn(`No options found for field type: ${fieldType}`);
      return value; // Fallback to original value
    }

    const optionId = options[value.toLowerCase()];
    if (!optionId) {
      console.warn(`No option ID found for ${fieldType}: ${value}`);
      return value; // Fallback to original value
    }

    return optionId;
  }

  /**
   * Build task description from modal data
   */
  buildTaskDescription(ticketType, modalData) {
    const { ticketId, property, clientName, market } = modalData;
    
    let description = `**Ticket ID:** ${ticketId}\n`;
    description += `**Property:** ${property}\n`;
    description += `**Client:** ${clientName}\n`;
    description += `**Market:** ${market}\n\n`;

    switch (ticketType) {
      case 'issue':
        description += `**Issue Type:** ${modalData.issueType}\n`;
        description += `**Priority:** ${modalData.priority}\n`;
        description += `**Description:** ${modalData.description}\n`;
        break;
      case 'inquiry':
        description += `**Inquiry Type:** ${modalData.inquiryType}\n`;
        description += `**Priority:** ${modalData.priority}\n`;
        description += `**Customer Question:** ${modalData.details}\n`;
        break;
      case 'unit':
        description += `**Change Type:** ${modalData.changeType}\n`;
        description += `**Effective Date:** ${modalData.effectiveDate}\n`;
        description += `**Reason:** ${modalData.reason}\n`;
        if (modalData.trashDay) description += `**Trash Day:** ${modalData.trashDay}\n`;
        if (modalData.recyclingDay) description += `**Recycling Day:** ${modalData.recyclingDay}\n`;
        break;
    }

    description += `\n**Source:** ${modalData.source}`;
    if (modalData.sourceDetails) description += ` (${modalData.sourceDetails})`;

    return description;
  }

  /**
   * Map Slack priority to ClickUp priority
   */
  mapPriorityToClickUp(priority) {
    const priorityMap = {
      'urgent': 1,
      'high': 2, 
      'normal': 3,
      'low': 4
    };
    return priorityMap[priority] || 3;
  }

  /**
   * Test ClickUp connection
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/team`, { headers: this.headers });
      return { success: true, teams: response.data.teams };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ClickUpService;

