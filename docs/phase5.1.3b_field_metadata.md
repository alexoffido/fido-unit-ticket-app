# Phase 5.1.3b - ClickUp Field Metadata Discovery

**Date:** November 3, 2025

## Key Findings

### Ops Tickets List (901318841880)
**Only 2 custom fields:**
1. Sub Issue Type (dropdown) - `21f8bee3-34b9-49d6-825b-5e5f9476d84f`
2. External Link (URL) - `45222026-9f5f-4c3c-b5bd-2026425c077a`

### Service Issues List (901318355853)
**13 custom fields including:**
- Date Created (date) - `0b508526-5988-4d62-8d88-974a7c5d4845`
- Priority Level (dropdown) - `dc226975-6c88-4cc0-b437-154fa1e4e1c9`
- Submitted By (text) - `ff818d8e-2df8-4f1d-8af8-7ed5b64d17c7`
- Submitted By (Slack User) (text) - `2d665cb6-72ef-4c9f-b7d4-0b6f4d22b431`
- Slack Permalink (text) - `8318e7bc-9bc7-41f7-9fb0-7a97b3cf54dc`
- Slack Ticket ID (text) - `33b8dd0f-68a0-42f8-b1dd-bd79463e91f8`
- Source Method (dropdown) - `1f02861f-2a54-4e2f-bccb-da6c6d522cc8`

## Priority Level Dropdown Options

**Field ID:** `dc226975-6c88-4cc0-b437-154fa1e4e1c9`

| Option Name | Option ID | Order |
|-------------|-----------|-------|
| urgent | `aa0f17d1-2ee9-4e5d-b752-f04cae34bb5c` | 0 |
| high | `807fc775-eb70-404a-89b5-56cb9bdc1269` | 1 |
| normal | `cf1eed90-45de-4adf-bb2f-f393db43795a` | 2 |
| low | `8d601a38-aae8-4130-98ce-d151e185a1f0` | 3 |

## Issue

**The Ops Tickets list does not have the same custom fields as Service Issues list.**

This means:
1. We can only populate 2 fields in Ops list (Sub Issue Type, External Link)
2. Priority, Date Created, Submitted By fields don't exist in Ops list
3. Either:
   - Winston needs to add these fields to Ops list in ClickUp
   - OR we continue routing to CX list until fields are added
   - OR we only populate the 2 available fields

## Recommendation

**Option A:** Add missing fields to Ops Tickets list in ClickUp
- Copy fields from Service Issues list to Ops Tickets list
- Ensures data consistency across both lists

**Option B:** Route Ops tickets to CX list temporarily
- Keep using Service Issues list until Ops list has proper fields
- Simpler short-term solution

**Option C:** Populate only available fields
- Use Ops list but only populate Sub Issue Type and External Link
- Lose Priority, Date Created, Submitted By data

