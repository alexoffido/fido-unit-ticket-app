# Phase 5.1 Testing Checklist - Ops Ticketing Stabilization

**Date:** October 31, 2025  
**Branch:** feature/ops-ticketing-fix → main  
**Deployment:** fido-slack-bot service (Railway production)  
**Tester:** Winston / Alex

---

## Pre-Test Requirements

- [ ] Railway deployment completed successfully
- [ ] fido-slack-bot service shows "Active" status
- [ ] Health endpoint responding: https://fido-slack-bot-production.up.railway.app/health
- [ ] Access to Slack workspace
- [ ] Access to ClickUp workspace

---

## Test 1: Priority Schema Update

**Expected Behavior:** Priority field should use emoji-based labels instead of P1-P3

### Steps:
1. Open Slack
2. Type `/fido-ops-ticket` in any channel
3. Modal should open

### Verification:
- [ ] Priority field shows 4 options (not 3)
- [ ] Options display as:
  - [ ] 🔴 Urgent
  - [ ] 🟠 High
  - [ ] 🟡 Medium
  - [ ] 🟢 Low
- [ ] Default selection is **🟡 Medium** (not P3)

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 2: BARK Link Label Update

**Expected Behavior:** Field label and rendering should reference "BARK Link" instead of "External Link"

### Steps:
1. In the same modal from Test 1
2. Scroll to the optional link field

### Verification:
- [ ] Field label says **"BARK Link (optional)"**
- [ ] Placeholder text says **"https://bark.fido.com/..."**
- [ ] Field accepts URL input

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 3: Photo Upload Field

**Expected Behavior:** New file upload field should appear for attaching photos

### Steps:
1. In the same modal from Test 1
2. Scroll to find photo upload field (should be before "Internal Notes")

### Verification:
- [ ] Field labeled **"Photos (optional, max 5)"** exists
- [ ] Field type is file upload (not text input)
- [ ] Can select image files from device
- [ ] Accepts jpg, jpeg, png, gif, heic formats
- [ ] Can upload multiple files (up to 5)

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 4: End-to-End Ticket Submission

**Expected Behavior:** Complete ticket creation flow with all new features

### Test Data:
- **Subject:** Phase 5.1 Test Ticket
- **Property:** 123 Test Street, Unit 4B
- **Issue Type:** Unable to Access
- **Priority:** 🟡 Medium
- **Market:** (Select any market)
- **Description:** Testing Phase 5.1 stabilization fixes. Verifying priority schema, BARK link labeling, photo uploads, CX tag rendering, and ClickUp task creation.
- **BARK Link:** https://example.com/test-bark-link
- **Photos:** Upload 2 test images
- **Internal Notes:** Internal test notes for Phase 5.1 verification

### Steps:
1. Fill out modal with test data above
2. Click "Submit"
3. Wait for confirmation message

### Verification:
- [ ] Modal closes without errors
- [ ] Ephemeral confirmation message appears
- [ ] Message contains ticket ID (format: FO-YYYYMMDD-XXXX)
- [ ] Message contains link to Slack thread
- [ ] Message contains link to ClickUp task

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 5: Slack Message Rendering

**Expected Behavior:** Ticket message in #fido-cx should render all fields correctly

### Steps:
1. Navigate to #fido-cx channel
2. Find the test ticket message (should be most recent)

### Verification - Header:
- [ ] Message starts with "ATTN:" line
- [ ] `@cx` renders as **live mention** (blue, clickable, not plaintext "@cx")
- [ ] Text says "New Ops → CX Ticket"

### Verification - Fields:
- [ ] Subject: "Phase 5.1 Test Ticket"
- [ ] Ticket ID: FO-YYYYMMDD-XXXX format
- [ ] Property/Location: "123 Test Street, Unit 4B"
- [ ] Market: (Selected market in uppercase)
- [ ] Issue Type: "Unable to Access" (or with sub-issue if selected)
- [ ] Priority: **"🟡 Medium"** (with emoji, not "P3")

### Verification - Optional Fields:
- [ ] **BARK Link section exists**
- [ ] Renders as: **"BARK Link: <url|View in BARK>"**
- [ ] Link is clickable (not plain text URL)
- [ ] **Photos section exists**
- [ ] Shows: "Photo 1 • Photo 2" (or number of uploaded photos)
- [ ] Each photo is a clickable link
- [ ] **Internal Notes section exists**
- [ ] Shows: "Internal test notes for Phase 5.1 verification"

### Verification - Footer:
- [ ] "Created by: @YourName | Fido Ticketing System"

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 6: ClickUp Task Creation

**Expected Behavior:** ClickUp task should be created with all fields populated

### Steps:
1. In the Slack thread from Test 5
2. Click the ClickUp task link in the thread reply
3. Task should open in ClickUp

### Verification - Task Basics:
- [ ] Task exists and loads
- [ ] Task name format: `[OPS] FO-YYYYMMDD-XXXX • Phase 5.1 Test Ticket`
- [ ] Task is in correct list (Service Issues list)
- [ ] Priority is set (should be "Normal" = 2 in ClickUp)

### Verification - Task Description:
- [ ] Header: "### Ops → CX Ticket"
- [ ] Ticket ID field populated
- [ ] Subject field populated
- [ ] Property/Location field populated
- [ ] Market field populated (uppercase)
- [ ] Issue Type field populated
- [ ] Priority field shows text (e.g., "🟡 Medium")
- [ ] Reported date populated

### Verification - Description Sections:
- [ ] **Description section** with full text
- [ ] **BARK Link section** with markdown link: `[View in BARK](url)`
- [ ] **Photos section** with markdown links: `[Photo 1](url) • [Photo 2](url)`
- [ ] **Internal Notes section** with notes text
- [ ] **Slack thread link** at bottom

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 7: CX Tag Mention Functionality

**Expected Behavior:** @cx mention should notify CX team members

### Steps:
1. Check if CX team members received notification
2. Ask a CX team member to verify they were mentioned

### Verification:
- [ ] CX team members received Slack notification
- [ ] Mention is clickable and shows usergroup members on hover
- [ ] Mention is not rendered as plaintext "@cx"

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 8: Photo Upload Edge Cases

**Expected Behavior:** Photo upload should handle various scenarios gracefully

### Test 8a: No Photos
1. Submit ticket without uploading any photos
2. Verify:
   - [ ] Submission succeeds
   - [ ] No "Photos:" section in Slack message
   - [ ] No "Photos:" section in ClickUp task

**Status:** ⬜ Pass / ⬜ Fail

### Test 8b: Maximum Photos (5)
1. Submit ticket with 5 photos
2. Verify:
   - [ ] All 5 photos appear in Slack message
   - [ ] All 5 photos appear in ClickUp task
   - [ ] Links are numbered Photo 1 through Photo 5

**Status:** ⬜ Pass / ⬜ Fail

### Test 8c: Large Image Files
1. Upload a large image (>5MB if possible)
2. Verify:
   - [ ] Upload succeeds or shows appropriate error
   - [ ] If succeeds, image link works in Slack and ClickUp

**Status:** ⬜ Pass / ⬜ Fail

---

## Test 9: BARK Link Edge Cases

**Expected Behavior:** BARK link field should validate and render correctly

### Test 9a: No BARK Link
1. Submit ticket without entering BARK link
2. Verify:
   - [ ] Submission succeeds
   - [ ] No "BARK Link:" section in Slack message
   - [ ] No "BARK Link:" section in ClickUp task

**Status:** ⬜ Pass / ⬜ Fail

### Test 9b: Invalid URL
1. Enter invalid URL (e.g., "not-a-url")
2. Try to submit
3. Verify:
   - [ ] Modal shows validation error
   - [ ] Error message says "Please enter a valid URL"
   - [ ] Submission is blocked until fixed

**Status:** ⬜ Pass / ⬜ Fail

### Test 9c: Valid Non-BARK URL
1. Enter valid URL that's not BARK (e.g., https://google.com)
2. Submit ticket
3. Verify:
   - [ ] Submission succeeds
   - [ ] Link renders correctly as "BARK Link: <url|View in BARK>"
   - [ ] Link is clickable and goes to correct URL

**Status:** ⬜ Pass / ⬜ Fail

---

## Test 10: Priority Value Mapping

**Expected Behavior:** Priority values should map correctly to ClickUp priority levels

### Test Priority Mappings:
1. Submit 4 separate test tickets with each priority:
   - 🔴 Urgent → ClickUp Priority 4 (Urgent)
   - 🟠 High → ClickUp Priority 3 (High)
   - 🟡 Medium → ClickUp Priority 2 (Normal)
   - 🟢 Low → ClickUp Priority 1 (Low)

### Verification:
- [ ] Urgent ticket has ClickUp priority 4
- [ ] High ticket has ClickUp priority 3
- [ ] Medium ticket has ClickUp priority 2
- [ ] Low ticket has ClickUp priority 1

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 11: Backward Compatibility

**Expected Behavior:** Other ticket types should still work (no regression)

### Test 11a: /fido-issue Command
1. Type `/fido-issue` in Slack
2. Submit a test issue ticket
3. Verify:
   - [ ] Modal opens correctly
   - [ ] Submission succeeds
   - [ ] Slack message posts correctly
   - [ ] ClickUp task created

**Status:** ⬜ Pass / ⬜ Fail

### Test 11b: /fido-inquiry Command
1. Type `/fido-inquiry` in Slack
2. Submit a test inquiry ticket
3. Verify:
   - [ ] Modal opens correctly
   - [ ] Submission succeeds
   - [ ] Slack message posts correctly
   - [ ] ClickUp task created

**Status:** ⬜ Pass / ⬜ Fail

### Test 11c: /fido-unit Command
1. Type `/fido-unit` in Slack
2. Submit a test unit change request
3. Verify:
   - [ ] Modal opens correctly
   - [ ] Submission succeeds
   - [ ] Slack message posts correctly
   - [ ] ClickUp task created

**Status:** ⬜ Pass / ⬜ Fail

---

## Overall Test Results

### Summary Statistics
- **Total Tests:** 11 main tests + 7 sub-tests = 18 tests
- **Passed:** ___
- **Failed:** ___
- **Skipped:** ___

### Critical Issues Found
1. 
2. 
3. 

### Minor Issues Found
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 

---

## Sign-Off

**Tested By:** _______________  
**Date:** _______________  
**Time:** _______________  

**Approved for Production:** ⬜ Yes / ⬜ No / ⬜ With Conditions

**Conditions (if applicable):**


**Next Steps:**
- [ ] Mark Phase 5.1 as complete
- [ ] Update Phase 5.1 document status to "Complete"
- [ ] Notify team of deployment
- [ ] Schedule Phase 5.2 (System Hardening)

---

**Document Status:** Ready for Testing  
**Last Updated:** October 31, 2025  
**Version:** 1.0

