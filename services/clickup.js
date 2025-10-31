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
      case 'ops': return this.listIssue || this.listDefault; // Ops tickets go to same list as issues
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
    } else if (t === 'ops') {
      name = `[OPS] ${ticketId} • ${data.subject || property}`;
      const desc = data.description || '';
      description =
        `### Ops → CX Ticket\n` +
        this._mdKV('Ticket', ticketId) +
        this._mdKV('Subject', data.subject) +
        this._mdKV('Property/Location', property) +
        this._mdKV('Market', market?.toUpperCase()) +
        this._mdKV('Issue Type', data.issueType) +
        this._mdKV('Priority', data.priority) +
        this._mdKV('Reported', dateStr) +
        `\n**Description:**\n${this._sanitizeLine(desc)}\n` +
        (data.externalLink ? `\n**BARK Link:** [View in BARK](${data.externalLink})\n` : '') +
        (data.photoUrls && data.photoUrls.length > 0 ? `\n**Photos:**\n${data.photoUrls.map((url, i) => `[Photo ${i+1}](${url})`).join(' • ')}\n` : '') +
        (data.notes ? `\n**Internal Notes:**\n${this._sanitizeLine(data.notes)}\n` : '') +
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

  /**
   * Upload Slack files as ClickUp task attachments
   * @param {string} taskId - ClickUp task ID
   * @param {Array} slackFiles - Array of Slack file objects with url_private and name
   * @param {string} slackToken - Slack bot token for downloading private files
   * @returns {Promise<{success: boolean, attached: number, failed: number, errors: Array}>}
   */
  async attachFilesToTask(taskId, slackFiles = [], slackToken = '') {
    if (!taskId || !slackFiles.length || !slackToken) {
      return { success: true, attached: 0, failed: 0, errors: [] };
    }

    let attached = 0;
    let failed = 0;
    const errors = [];

    for (const file of slackFiles) {
      try {
        // Download file from Slack
        const slackRes = await fetch(file.url_private, {
          headers: { 'Authorization': `Bearer ${slackToken}` }
        });

        if (!slackRes.ok) {
          const err = `Failed to download from Slack: ${slackRes.status} ${slackRes.statusText}`;
          errors.push({ file: file.name, error: err });
          failed++;
          continue;
        }

        const blob = await slackRes.arrayBuffer();

        // Upload to ClickUp using FormData
        const FormData = (await import('formdata-node')).FormData;
        const { Blob } = await import('buffer');
        
        const form = new FormData();
        form.append('attachment', new Blob([blob]), file.name || 'photo.jpg');

        const cuRes = await fetch(
          `https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/attachment`,
          {
            method: 'POST',
            headers: {
              'Authorization': this.token
            },
            body: form
          }
        );

        if (!cuRes.ok) {
          const text = await cuRes.text().catch(() => '');
          const err = `ClickUp upload failed: ${cuRes.status} ${cuRes.statusText} - ${text.slice(0, 200)}`;
          errors.push({ file: file.name, error: err });
          failed++;
        } else {
          attached++;
        }

        // Small delay to avoid rate limiting
        if (slackFiles.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      } catch (err) {
        errors.push({ file: file.name, error: err?.message || String(err) });
        failed++;
      }
    }

    return { success: true, attached, failed, errors };
  }
}

module.exports = ClickUpService;
