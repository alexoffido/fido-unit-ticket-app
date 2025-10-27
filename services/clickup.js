// services/clickup.js
// Node 18+ (uses global fetch). No extra deps.

class ClickUpService {
  constructor() {
    this.token = process.env.CLICKUP_API_TOKEN || '';
    this.teamId = process.env.CLICKUP_TEAM_ID || '';

    // Per-type List IDs (recommended)
    this.listUnit = process.env.CLICKUP_LIST_ID_UNIT || '';
    this.listIssue = process.env.CLICKUP_LIST_ID_ISSUE || '';
    this.listInquiry = process.env.CLICKUP_LIST_ID_INQUIRY || '';

    // Fallback list if the above aren’t set
    this.listDefault = process.env.CLICKUP_LIST_ID || '';

    if (!this.token) throw new Error('CLICKUP_API_TOKEN missing');
    if (!this.teamId) throw new Error('CLICKUP_TEAM_ID missing');
  }

  // Public entry point used by app.js
  async createTask(type, data, slackPermalink, slackUserId) {
    try {
      const { listId, payload } = this._buildPayload(type, data, slackPermalink, slackUserId);
      if (!listId) {
        return { success: false, error: `No ClickUp List ID configured for type="${type}" (expected CLICKUP_LIST_ID_${type.toUpperCase()} or CLICKUP_LIST_ID)` };
      }

      const res = await fetch(`https://api.clickup.com/api/v2/list/${encodeURIComponent(listId)}/task`, {
        method: 'POST',
        headers: {
          'Authorization': this.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const debugInfo = {
          status: res.status,
          statusText: res.statusText,
          responseBody: text.slice(0, 500),
          payloadKeys: Object.keys(payload),
          name: payload.name,
          priority: payload.priority,
          listId: listId
        };
        if (process.env.DEBUG_CLICKUP === 'true') {
          console.error('[ClickUp Debug] Task creation failed:', JSON.stringify(debugInfo, null, 2));
        }
        return { success: false, error: `ClickUp API ${res.status} ${res.statusText}: ${text.slice(0, 300)}`, debug: debugInfo };
      }

      const json = await res.json();
      const taskId = json?.id;
      const taskName = json?.name || payload.name;
      const taskUrl = json?.url || (taskId ? `https://app.clickup.com/t/${taskId}` : '');

      return { success: true, taskId, taskName, taskUrl };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  // ---------- helpers ----------
  _listForType(type) {
    switch ((type || '').toLowerCase()) {
      case 'unit': return this.listUnit || this.listDefault;
      case 'issue': return this.listIssue || this.listDefault;
      case 'inquiry': return this.listInquiry || this.listDefault;
      default: return this.listDefault;
    }
  }

  _priorityFrom(val) {
    // Slack modal uses: urgent | high | normal | low
    const v = (val || '').toLowerCase();
    if (v === 'urgent') return 4;
    if (v === 'high') return 3;
    if (v === 'normal') return 2;
    if (v === 'low') return 1;
    return 2; // default "normal"
  }

  _tagsFrom({ market, changeType, issueType, inquiryType }) {
    const tags = [];
    if (market) tags.push((market || '').toLowerCase());
    if (changeType) tags.push(`change_${changeType.toLowerCase()}`);
    if (issueType) tags.push(`issue_${this._slug(issueType)}`);
    if (inquiryType) tags.push(`inq_${this._slug(inquiryType)}`);
    return tags;
  }

  _slug(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^\w]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  _sanitizeLine(s) {
    return (s || '').toString().trim();
  }

  _mdKV(k, v) {
    if (!v) return '';
    return `**${k}:** ${this._sanitizeLine(v)}\n`;
  }

  _buildPayload(type, data, slackPermalink, slackUserId) {
    const t = (type || '').toLowerCase();
    const listId = this._listForType(t);

    // Common fields
    const ticketId = data.ticketId;
    const property = data.property;
    const clientName = data.clientName;
    const market = (data.market || '').toLowerCase();
    const dateStr = data.dateStr;
    const priority = this._priorityFrom(data.priority);
    const tags = this._tagsFrom({ market, changeType: data.changeType, issueType: data.issueType, inquiryType: data.inquiryType });

    // Build name + description by type
    let name = '';
    let description = '';

    if (t === 'unit') {
      name = `[UNIT] ${ticketId} • ${property}`;
      description =
        `### Unit Management Request\n` +
        this._mdKV('Ticket', ticketId) +
        this._mdKV('Client', clientName) +
        this._mdKV('Property', property) +
        this._mdKV('Market', market?.toUpperCase()) +
        this._mdKV('Change Type', data.changeType) +
        this._mdKV('Effective Date', data.effectiveDate) +
        this._mdKV('Trash Day', data.trashDay || 'N/A') +
        this._mdKV('Recycling Day', data.recyclingDay || 'N/A') +
        this._mdKV('Reason', data.reason) +
        this._mdKV('Instructions', data.instructions) +
        this._mdKV('Reported', dateStr) +
        (slackPermalink ? `\n[View Slack Thread](${slackPermalink})\n` : '');
    } else if (t === 'issue') {
      name = `[ISSUE] ${ticketId} • ${property}`;
      const desc = data.description || '';
      description =
        `### Service Issue\n` +
        this._mdKV('Ticket', ticketId) +
        this._mdKV('Client', clientName) +
        this._mdKV('Property', property) +
        this._mdKV('Market', market?.toUpperCase()) +
        this._mdKV('Issue Type', data.issueType) +
        this._mdKV('Priority', data.priority) +
        this._mdKV('Reported Via', data.source) +
        this._mdKV('Source Ref', data.sourceDetails) +
        this._mdKV('Reported', dateStr) +
        `\n**Description:**\n${this._sanitizeLine(desc)}\n` +
        (slackPermalink ? `\n[View Slack Thread](${slackPermalink})\n` : '');
    } else if (t === 'inquiry') {
      name = `[INQ] ${ticketId} • ${property}`;
      const details = data.details || '';
      description =
        `### Customer Inquiry\n` +
        this._mdKV('Ticket', ticketId) +
        this._mdKV('Client', clientName) +
        this._mdKV('Property', property) +
        this._mdKV('Market', market?.toUpperCase()) +
        this._mdKV('Inquiry Type', data.inquiryType) +
        this._mdKV('Priority', data.priority) +
        this._mdKV('Contact Method', data.source) +
        this._mdKV('Contact Ref', data.sourceDetails) +
        this._mdKV('Received', dateStr) +
        `\n**Inquiry Details:**\n${this._sanitizeLine(details)}\n` +
        (slackPermalink ? `\n[View Slack Thread](${slackPermalink})\n` : '');
    } else {
      // Unknown type falls back to generic task
      name = `[TICKET] ${ticketId} • ${property}`;
      description =
        `### Ticket\n` +
        this._mdKV('Ticket', ticketId) +
        this._mdKV('Client', clientName) +
        this._mdKV('Property', property) +
        this._mdKV('Market', market?.toUpperCase()) +
        this._mdKV('Reported', dateStr) +
        (slackPermalink ? `\n[View Slack Thread](${slackPermalink})\n` : '');
    }

    // Optional assignee: if you want to set to the Slack submitter, map slackUserId => ClickUp user id here
    const assignees = []; // e.g., [CLICKUP_USER_ID]

    const payload = {
      name,
      description,          // Markdown allowed
      priority,             // 1–4
      assignees,            // []
      tags,                 // []
      // status: 'To Do',   // optionally set a default status that exists in the List
      // due_date, due_date_time, start_date, etc. can be added if desired
    };

    return { listId, payload };
  }
}

module.exports = ClickUpService;
