# Phase 5.1.3 - Analysis & Execution Plan

**Date:** November 1, 2025  
**Analyst:** Manus  
**Status:** Ready for Step 1 Execution  
**Document:** Phase_5.1.3_ClickUp_Mapping_and_Routing_Cleanup.md

---

## Executive Summary

Phase 5.1.3 addresses **routing accuracy** and **data structure** improvements for Ops tickets in ClickUp. This phase moves beyond UI/UX polish (5.1.1-5.1.2) to focus on **backend data integrity** and **workflow automation**.

**Key Objectives:**
1. Route Ops tickets to dedicated ClickUp list (not CX list)
2. Map Slack fields to ClickUp custom fields for structured data
3. Auto-set due dates based on priority levels
4. Maintain markdown fallback for human readability
5. Enable archival automation (ClickUp UI only)

**Risk Level:** LOW (all changes have production-safe fallbacks)

---

## Problem Statement

### Current State Issues

**1. Incorrect Routing**
- Ops tickets currently route to `CLICKUP_LIST_ID_ISSUE` (CX Service Issues list)
- Ops and CX tickets are mixed in the same list
- Difficult to filter, report, or assign to different teams

**2. Unstructured Data**
- All ticket data stored in markdown description only
- No custom fields populated
- Can't filter by market, priority, or issue type in ClickUp
- Can't create dashboards or reports

**3. No Due Date Automation**
- All tickets created without due dates
- Manual due date setting required
- No priority-based SLA enforcement

**4. Manual Archival**
- Completed tickets remain in active list
- No automatic cleanup after 48 hours
- List becomes cluttered over time

---

## Proposed Solution Breakdown

### Step 1: Discovery & Validation (BLOCKING)

**Purpose:** Identify correct ClickUp list IDs before making code changes

**Actions:**
1. Call ClickUp API to list all lists in folder
2. Identify CX list ID (Service Issues)
3. Identify Ops list ID (Ops Tickets / Ops Issues)
4. Output summary for Alex to review
5. **STOP - Wait for Alex to add `CLICKUP_LIST_ID_OPS` to Railway**

**Why This Matters:**
- Prevents hardcoding wrong list IDs
- Ensures we have correct target before deployment
- Allows Alex to verify list structure in ClickUp

**Estimated Time:** 5 minutes

**Deliverable:** Summary table with list names and IDs

---

### Step 2: Implementation (AFTER Confirmation)

#### A. Routing Logic Update

**Current Behavior:**
```javascript
case 'ops': return this.listIssue || this.listDefault;
```

**New Behavior:**
```javascript
case 'ops': return this.listOps || this.listIssue || this.listDefault;
```

**Fallback Chain:**
1. `CLICKUP_LIST_ID_OPS` (dedicated Ops list)
2. `CLICKUP_LIST_ID_ISSUE` (CX list, current behavior)
3. `CLICKUP_LIST_ID` (default list)

**Impact:**
- ✅ Ops tickets route to dedicated list
- ✅ Backward compatible if env var missing
- ✅ No breaking changes

**Code Location:** `services/clickup.js` - `_listForType()` method

---

#### B. Due Date Automation

**Logic:**
- **Urgent:** Due today (0 days)
- **High:** Due tomorrow (+1 day)
- **Normal:** Due in 2 days (+2 days)
- **Low:** Due in 3 days (+3 days) ← Updated from 1 day

**Implementation:**
```javascript
function _dueDateFromPriority(priority) {
  const p = (priority || '').toLowerCase();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (p.includes('urgent')) return now;
  if (p.includes('high')) return now + oneDay;
  if (p.includes('normal')) return now + 2 * oneDay;
  if (p.includes('low')) return now + 3 * oneDay;
  
  return null; // No due date if priority not recognized
}
```

**Impact:**
- ✅ Automatic SLA tracking
- ✅ Visual due date indicators in ClickUp
- ✅ Can filter by overdue tasks
- ✅ Graceful degradation (null if priority unknown)

**Code Location:** `services/clickup.js` - new helper method

---

#### C. Custom Field Mapping

**New Environment Variables Required:**
```bash
CU_FIELD_PROPERTY_ADDRESS    # Custom field ID for property address
CU_FIELD_MARKET_CODE         # Custom field ID for market code
CU_FIELD_ISSUE_TYPE          # Custom field ID for issue type
CU_FIELD_PRIORITY_LEVEL      # Custom field ID for priority level
CU_FIELD_SLACK_PERMALINK     # Custom field ID for Slack thread link
CU_FIELD_SLACK_TICKET_ID     # Custom field ID for ticket ID
CU_FIELD_SOURCE_METHOD       # Custom field ID for source (always "Slack Modal")
CU_FIELD_SUBMITTED_BY        # Custom field ID for submitter name
```

**Implementation Approach:**
1. Create task with markdown description (current behavior)
2. If task creation succeeds, update custom fields
3. If custom field update fails, log warning but don't fail ticket
4. Best-effort: skip fields with missing IDs

**API Calls:**
```javascript
POST /task/{task_id}/field/{field_id}
Body: { "value": "field_value" }
```

**Impact:**
- ✅ Structured data in ClickUp
- ✅ Filterable by any field
- ✅ Dashboard and reporting enabled
- ✅ Markdown description remains as fallback
- ✅ Graceful degradation if fields missing

**Code Location:** `services/clickup.js` - new `_updateCustomFields()` method

---

#### D. Markdown Description Cleanup

**Current Format:**
- Verbose with multiple sections
- Inconsistent formatting
- Hard to scan

**New Format:**
```markdown
### Ops → CX Ticket
**Ticket:** FO-20251101-0001
**Subject:** Unable to access bins at property
**Property/Location:** 123 Main St, Unit 4B
**Market:** ATX
**Issue Type:** Unable to Access
**Priority:** 🟡 NORMAL
**Reported:** 2025-11-01

**Description:**
Gate code not working, unable to access bins for service.

**BARK:** *<https://bark.fido.com/service/123|View Service in BARK>*

**Photos:**
<https://files.slack.com/photo1|Photo 1>
<https://files.slack.com/photo2|Photo 2>

**View Slack Thread:** https://fido.slack.com/archives/...
```

**Impact:**
- ✅ Cleaner, more scannable
- ✅ Consistent formatting
- ✅ Still human-readable if custom fields fail
- ✅ Maintains all information

**Code Location:** `services/clickup.js` - `_buildPayload()` method

---

#### E. Archival Automation (ClickUp UI)

**Setup in ClickUp:**
1. Navigate to CX list (Service Issues)
2. Add automation:
   - Trigger: Status changes to "Completed"
   - Wait: 48 hours
   - Action: Move to "Archived Tickets (Pre-Go-Live)" list
3. Repeat for Ops list

**Impact:**
- ✅ Automatic cleanup of completed tickets
- ✅ Keeps active lists clean
- ✅ Preserves history in archive
- ✅ No code changes required

**Note:** This is a manual ClickUp configuration, not a code change.

---

## Technical Architecture

### Data Flow (Updated)

```
1. User submits /fido-ops-ticket
   ↓
2. Slack modal submission
   ↓
3. app.js handler processes submission
   ↓
4. Slack message posted to #fido-cx
   ↓
5. ClickUp service called:
   a. Determine list ID (NEW: use CLICKUP_LIST_ID_OPS)
   b. Calculate due date from priority (NEW)
   c. Build task payload with markdown description
   d. Create task via POST /list/{list_id}/task
   ↓
6. If task creation succeeds:
   a. Upload photos as attachments (Phase 5.1.2)
   b. Update custom fields (NEW)
      - Property address
      - Market code
      - Issue type
      - Priority level
      - Slack permalink
      - Ticket ID
      - Source method
      - Submitted by
   ↓
7. Post ClickUp task link to Slack thread
   ↓
8. Send confirmation to user
```

### New Methods in ClickUp Service

**1. `_dueDateFromPriority(priority)`**
- Input: Priority string (urgent/high/normal/low)
- Output: Unix timestamp or null
- Purpose: Calculate due date based on priority

**2. `_updateCustomFields(taskId, data)`**
- Input: Task ID and data object
- Output: Success/failure counts
- Purpose: Update all custom fields after task creation
- Best-effort: logs failures, doesn't throw

**3. `_updateCustomField(taskId, fieldId, value)`**
- Input: Task ID, field ID, value
- Output: Boolean success
- Purpose: Update single custom field
- Handles null/undefined gracefully

---

## Environment Variables

### Existing (No Changes)
```bash
CLICKUP_API_TOKEN           # API token for ClickUp
CLICKUP_TEAM_ID             # Team ID
CLICKUP_FOLDER_ID           # Folder ID for list discovery
CLICKUP_LIST_ID_ISSUE       # CX Service Issues list
CLICKUP_LIST_ID_UNIT        # Unit changes list
CLICKUP_LIST_ID_INQUIRY     # Inquiries list
CLICKUP_LIST_ID             # Default fallback list
```

### New (Required for Step 2)
```bash
CLICKUP_LIST_ID_OPS         # Ops tickets list (from Step 1 discovery)
```

### New (Optional - Custom Fields)
```bash
CU_FIELD_PROPERTY_ADDRESS   # Property address custom field ID
CU_FIELD_MARKET_CODE        # Market code custom field ID
CU_FIELD_ISSUE_TYPE         # Issue type custom field ID
CU_FIELD_PRIORITY_LEVEL     # Priority level custom field ID
CU_FIELD_SLACK_PERMALINK    # Slack permalink custom field ID
CU_FIELD_SLACK_TICKET_ID    # Ticket ID custom field ID
CU_FIELD_SOURCE_METHOD      # Source method custom field ID
CU_FIELD_SUBMITTED_BY       # Submitted by custom field ID
```

**Note:** Custom field variables are optional. If missing, custom fields won't be updated but tickets will still create successfully.

---

## Risk Assessment

### Overall Risk Level: LOW

All changes are additive with production-safe fallbacks.

### Specific Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Missing CLICKUP_LIST_ID_OPS | Ops tickets route to CX list | Medium | Fallback to CLICKUP_LIST_ID_ISSUE (current behavior) |
| Wrong list ID discovered | Tickets route to wrong list | Low | Manual verification in Step 1 before deployment |
| Custom field IDs incorrect | Fields not populated | Medium | Skip silently, markdown description remains |
| Due date calculation error | No due date set | Very Low | Returns null, task still creates |
| ClickUp API rate limiting | Some field updates fail | Low | Best-effort approach, logs failures |
| Custom field API errors | Fields not updated | Low | Try-catch wrapper, doesn't fail ticket |

### Rollback Plan

**If issues occur:**
1. Remove `CLICKUP_LIST_ID_OPS` from Railway
2. Tickets will fallback to CX list (current behavior)
3. Custom fields won't update (markdown description remains)
4. No data loss, no ticket creation failures

**Rollback Time:** < 1 minute (remove env var)

---

## Testing Strategy

### Step 1 Testing (Discovery)

**Manual Verification:**
1. Run ClickUp API call to list all lists
2. Verify output contains expected lists
3. Confirm list IDs with Alex
4. Validate folder structure

**Expected Output:**
```
CX List: "Service Issues" - ID: 123456789
Ops List: "Ops Tickets" - ID: 987654321
```

---

### Step 2 Testing (Implementation)

**Unit Testing (Manual):**
1. Test `_dueDateFromPriority()` with all priority values
2. Verify due date calculations are correct
3. Test with null/undefined priority

**Integration Testing:**
1. Submit Ops ticket with all fields populated
2. Verify task routes to Ops list (not CX list)
3. Verify due date is set correctly
4. Verify custom fields are populated
5. Verify markdown description is clean and readable

**Edge Case Testing:**
1. Submit ticket without BARK link
2. Submit ticket without photos
3. Submit ticket with missing custom field IDs
4. Submit ticket with invalid priority
5. Submit ticket when ClickUp API is slow/failing

**Regression Testing:**
1. Test /fido-issue (should still route to CX list)
2. Test /fido-inquiry (should still work)
3. Test /fido-unit (should still work)
4. Verify no impact on existing tickets

---

## Implementation Checklist

### Step 1: Discovery (BLOCKING)

- [ ] Create discovery script to call ClickUp API
- [ ] Run script to fetch all lists in folder
- [ ] Parse response and identify CX and Ops list IDs
- [ ] Create summary table with list names and IDs
- [ ] Share summary with Alex for verification
- [ ] **STOP - Wait for Alex to add CLICKUP_LIST_ID_OPS to Railway**
- [ ] Verify environment variable is set in Railway dashboard

**Estimated Time:** 10 minutes  
**Blocking:** Yes - cannot proceed to Step 2 without confirmation

---

### Step 2: Implementation (AFTER Confirmation)

#### Code Changes

- [ ] Update `_listForType()` to support 'ops' routing to CLICKUP_LIST_ID_OPS
- [ ] Add `_dueDateFromPriority()` helper method
- [ ] Add `_updateCustomFields()` method
- [ ] Add `_updateCustomField()` method
- [ ] Update `_buildPayload()` to:
  - [ ] Calculate due date from priority
  - [ ] Clean up markdown description format
  - [ ] Include due_date in payload
- [ ] Update `createTask()` to call `_updateCustomFields()` after task creation
- [ ] Add error handling and logging for custom field updates

#### Testing

- [ ] Test routing with CLICKUP_LIST_ID_OPS set
- [ ] Test routing without CLICKUP_LIST_ID_OPS (fallback)
- [ ] Test due date calculation for all priorities
- [ ] Test custom field updates with all fields set
- [ ] Test custom field updates with missing field IDs
- [ ] Test markdown description formatting
- [ ] Test end-to-end Ops ticket creation
- [ ] Verify no regression in CX/inquiry/unit tickets

#### Deployment

- [ ] Create hotfix branch: `hotfix/phase-5.1.3-clickup-routing`
- [ ] Commit code changes
- [ ] Push to GitHub
- [ ] Merge to main
- [ ] Railway auto-deploys
- [ ] Verify health endpoint
- [ ] Test in production with real ticket

#### Documentation

- [ ] Update phase5.1.x_unified_report.md with Phase 5.1.3
- [ ] Create phase5.1.3_completion_summary.md
- [ ] Document custom field IDs for future reference
- [ ] Update environment variable reference

**Estimated Time:** 45 minutes  
**Blocking:** No - but requires Step 1 completion first

---

### Step 3: ClickUp UI Configuration (Manual)

- [ ] Navigate to CX list in ClickUp
- [ ] Add archival automation:
  - [ ] Trigger: Status = Completed
  - [ ] Wait: 48 hours
  - [ ] Action: Move to "Archived Tickets (Pre-Go-Live)"
- [ ] Navigate to Ops list in ClickUp
- [ ] Add same archival automation
- [ ] Test automation with dummy ticket
- [ ] Verify tickets move to archive after 48 hours

**Estimated Time:** 10 minutes  
**Blocking:** No - can be done anytime

---

## Success Criteria

### Step 1 Success
- [x] ClickUp API call succeeds
- [ ] List IDs identified correctly
- [ ] Summary shared with Alex
- [ ] CLICKUP_LIST_ID_OPS added to Railway
- [ ] Environment variable verified

### Step 2 Success
- [ ] Ops tickets route to dedicated Ops list
- [ ] Due dates set automatically based on priority
- [ ] Custom fields populated correctly
- [ ] Markdown description is clean and readable
- [ ] Photo attachments still work (Phase 5.1.2)
- [ ] No regression in other ticket types
- [ ] Error handling works gracefully

### Step 3 Success
- [ ] Archival automation configured in ClickUp
- [ ] Completed tickets move to archive after 48 hours
- [ ] Active lists remain clean

---

## Timeline Estimate

| Phase | Task | Duration | Blocking |
|-------|------|----------|----------|
| Step 1 | Discovery script | 5 min | No |
| Step 1 | Run and parse results | 5 min | No |
| Step 1 | Wait for Alex confirmation | Variable | **YES** |
| Step 2 | Code implementation | 30 min | No |
| Step 2 | Testing | 15 min | No |
| Step 2 | Deployment | 5 min | No |
| Step 3 | ClickUp UI setup | 10 min | No |
| **Total** | | **~70 min + wait** | |

**Critical Path:** Step 1 discovery → Alex confirmation → Step 2 implementation

---

## Execution Plan

### Phase 1: Discovery (Now)

1. **Create ClickUp API discovery script**
   - Use existing CLICKUP_API_TOKEN and CLICKUP_FOLDER_ID
   - Call GET /folder/{folder_id}/list
   - Parse response JSON
   - Extract list names and IDs

2. **Run discovery and output results**
   - Execute script
   - Format output as markdown table
   - Include list name, list ID, folder name

3. **Share with Alex and STOP**
   - Post results in this conversation
   - Wait for Alex to confirm CLICKUP_LIST_ID_OPS
   - Do not proceed to Step 2 until confirmed

**Deliverable:** Summary table of ClickUp lists

---

### Phase 2: Implementation (After Confirmation)

1. **Create hotfix branch**
   - Branch from main
   - Name: `hotfix/phase-5.1.3-clickup-routing`

2. **Implement routing logic**
   - Update `_listForType()` method
   - Add fallback chain for Ops tickets

3. **Implement due date automation**
   - Add `_dueDateFromPriority()` helper
   - Update `_buildPayload()` to include due_date

4. **Implement custom field mapping**
   - Add `_updateCustomFields()` method
   - Add `_updateCustomField()` helper
   - Update `createTask()` to call after task creation

5. **Clean up markdown description**
   - Update Ops ticket description format
   - Ensure consistency and readability

6. **Test thoroughly**
   - Unit test each new method
   - Integration test full flow
   - Edge case testing
   - Regression testing

7. **Deploy to production**
   - Commit and push
   - Merge to main
   - Railway auto-deploys
   - Verify health endpoint
   - Test with real ticket

**Deliverable:** Working implementation with all features

---

### Phase 3: Documentation & UI Setup (After Deployment)

1. **Update documentation**
   - Add Phase 5.1.3 to unified report
   - Create completion summary
   - Document custom field IDs

2. **Configure ClickUp automations**
   - Set up archival for CX list
   - Set up archival for Ops list
   - Test with dummy tickets

**Deliverable:** Complete documentation and automated archival

---

## Questions for Alex

Before proceeding with Step 1, please confirm:

1. **ClickUp Folder Structure:**
   - Is there a single folder containing both CX and Ops lists?
   - Or are they in separate folders?
   - What is the folder ID we should query?

2. **Custom Fields:**
   - Do custom fields already exist in the Ops list?
   - Or do we need to create them first?
   - Should custom fields be the same across CX and Ops lists?

3. **List Names:**
   - What is the exact name of the Ops list in ClickUp?
   - Is it "Ops Tickets", "Ops Issues", or something else?

4. **Archive List:**
   - Does "Archived Tickets (Pre-Go-Live)" list already exist?
   - Should we create it if it doesn't exist?

5. **Priority Mapping:**
   - Are the due date SLAs correct?
     - Urgent: Today
     - High: +1 day
     - Normal: +2 days
     - Low: +3 days

---

## Recommendation

**Proceed with Step 1 immediately.** The discovery step is non-invasive and will provide critical information needed for Step 2. Once we have the list IDs, we can pause and wait for your confirmation before making any code changes.

**Estimated time to complete Step 1:** 10 minutes

**Ready to execute?**

---

**Document Status:** Ready for Execution  
**Next Action:** Run Step 1 discovery script  
**Blocking:** Waiting for confirmation to proceed to Step 2  
**Last Updated:** November 1, 2025

