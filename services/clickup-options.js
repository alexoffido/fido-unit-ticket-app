/**
 * ClickUp Dropdown Options Mapping
 * Maps Slack values to ClickUp option UUIDs for dropdown fields
 */

const CLICKUP_OPTIONS = {
  // Market Code options (same across all lists)
  market_code: {
    'atx': '13445845-bf3c-4b35-945f-15777514369b',
    'ana': 'b654a2d4-d426-41a4-b728-ca6444af453d',
    'chs': 'a16795be-4ec8-4e32-8d5d-834c54424a6f',
    'clt': '92fd7c6a-7783-43a4-adc5-5a0062eb57f1',
    'den': '68932d3c-0911-4e3a-804b-e9d09db42b76',
    'dfw': 'a9c0a838-279f-43db-b6e3-397bca320dc0',
    'fll': 'adab358e-8d1c-40d5-9d16-45d6781056aa',
    'geg': '0df3c283-8b62-4f08-ad79-4a511e46b335',
    'hot': 'd4dac247-f71a-4ef7-b807-5cbce544fc44',
    'jax': '3d49cfbb-b0ac-418d-a226-fab14d3c988c',
    'lax': 'a2a6589a-9478-4c52-a878-a1189691f91c',
    'lit': 'cfc5e8c2-2760-432e-a8d5-c6abd03a06a0',
    'phx': 'd3a0810b-afa7-4055-9a83-a0abc1167160',
    'pie': '5c005c09-cc73-49ad-bbca-33a1e5ed0e54',
    'san': '0f98e10b-acd4-43e8-b2d2-c39cdcd9e2f5',
    'sat': '3d3d750e-f82a-43f2-bc5d-ebe8ba56244b',
    'sdx': '7a092200-85f3-437b-adaa-99a94deed710',
    'sea': 'c7741223-caab-46eb-b472-75fce1fefc96',
    'slc': '4dd3cf4c-f2bc-40e5-9bb5-ad565d39aa0f',
    'srq': '624006c4-bd01-4ac3-9fec-d71ecfb4f06b',
    'sta': 'df541e44-5a19-4a97-b770-adc3ae5dddd3',
    'sts': '2c55c901-f12e-4c26-afcb-18232f8cfd25',
    'vps': 'a919aa84-7c81-46e6-918d-3c1728cdd437',
    'misc': 'a47f9faa-5c11-4162-a713-feb4702f92cb'
  },

  // Source Method options (same across all lists)
  source_method: {
    'slack_message': '1ca8f630-73a7-4f08-8a6c-0b3bdf64b2ca',
    'phone_call': '0e59d2e3-21f1-48eb-999c-f79578109900',
    'openphone_text': 'f6112fb2-56d5-4a0b-9a15-ed3e48205581',
    'email': 'dcfd208a-ade8-40e7-8aeb-c20c857596e5',
    'website_form': '062f0d07-cc34-422b-a379-f314fa169351',
    'in_person': '17273614-38a7-4e5c-b8cf-2c11afaf810b',
    'internal': '29b1f08f-ad10-437f-bdfa-f3ed48b30ce4'
  },

  // Issue Type options (Service Issues list)
  issue_type: {
    'bin_placement': '5e7303c0-991b-4916-a1f0-c5ff3cf2735c',
    'access_problem': 'f1422e6f-f2b3-4eba-867f-e54225fd9f2a',
    'schedule_conflict': '91bc06d0-26d6-4785-9bb5-44ded7b6b84a',
    'property_logistics': '1ae4637d-e1b4-40f7-9f7c-073e802a2909',
    'service_quality': 'b01347ef-8886-45b7-861d-39c1c8285034',
    'customer_complaint': '1f58c4c0-79c4-4d95-80f5-b8e5cf38dec1',
    'equipment_issue': '61d50539-a2bc-448b-a202-f1c434eb478a',
    'other': '94fd5670-bfff-4bd7-a1e2-a95b9f48289b'
  },

  // Priority Level options (Service Issues list)
  priority_level: {
    'urgent': 'aa0f17d1-2ee9-4e5d-b752-f04cae34bb5c',
    'high': '807fc775-eb70-404a-89b5-56cb9bdc1269',
    'normal': 'cf1eed90-45de-4adf-bb2f-f393db43795a',
    'low': '8d601a38-aae8-4130-98ce-d151e185a1f0'
  },

  // Resolution Status options (Service Issues list)
  resolution_status: {
    'open': '54bdff69-c09a-497e-a875-0544c096ac4b',
    'in_progress': '4e4aeec0-0fd2-40ab-892b-2a6be214d3f8',
    'resolved': '589a39ea-a686-43da-9d17-89c3399676d8',
    'closed': 'adbb9cbd-76b7-463b-afdd-50cf11b022af'
  },

  // Inquiry Type options (Customer Inquiries list)
  inquiry_type: {
    'schedule_question': 'a2cadcef-f3f8-4324-94a5-87436963af1a',
    'service_status': '19935af7-425a-4044-a5fe-8dfd1d167c43',
    'billing_question': 'b85d2049-b453-498a-a707-431d8590fa34',
    'service_details': '8bbaa7ac-c257-4bb6-857f-1b71303d81b0',
    'new_service': '533e8b6e-4365-425b-9866-87c4aa71c9d8',
    'pause_resume': 'fa7fd61c-f235-41af-8e5e-a88a03b6c9cb',
    'property_update': 'd29a04c1-e3ee-4969-b8cf-cf0ed9e3c871',
    'general_info': '62c43c40-f407-4de5-a119-f59b83be6309',
    'other': '56d1e306-cd04-4d64-b179-f77de5a020a7'
  },

  // Response Priority options (Customer Inquiries list)
  response_priority: {
    'urgent': '4cf2bcae-7b77-4fbd-a9ae-f1bb906155ea',
    'high': '4cf2bcae-7b77-4fbd-a9ae-f1bb906155ea', // Same as urgent for now
    'normal': '4cf2bcae-7b77-4fbd-a9ae-f1bb906155ea', // Same as urgent for now
    'low': '4cf2bcae-7b77-4fbd-a9ae-f1bb906155ea' // Same as urgent for now
  },

  // Response Status options (Customer Inquiries list)
  response_status: {
    'pending': '4cf2bcae-7b77-4fbd-a9ae-f1bb906155ea',
    'in_progress': '4cf2bcae-7b77-4fbd-a9ae-f1bb906155ea',
    'responded': 'a8988eb0-c38a-4672-ae38-8029fa25043d',
    'closed': 'a8988eb0-c38a-4672-ae38-8029fa25043d'
  },

  // Change Type options (Unit Management list)
  change_type: {
    'new_unit': 'aa50c316-6c29-4ec0-a0f6-c01af5327572',
    'cancellation': '7d30e9e2-2fde-4b40-99c9-a8d81d8f1ae4',
    'pause': '9546ee22-066b-4206-94bd-00468c870260',
    'restart': '526243c5-adf1-4420-b515-7d652dff6f2d',
    'modify': 'c2f1540c-0a5a-47b6-b0d8-30e619fc42bb'
  },

  // Trash Pickup Day options (Unit Management list)
  trash_pickup_day: {
    'monday': '54119fb6-0301-4bb3-9352-8eaeb5cb7171',
    'tuesday': '14fd1246-ef40-4c13-8f4d-8ed517afa23a',
    'wednesday': '23f6c07a-328e-4a83-b334-170053087057',
    'thursday': '36cd5065-3d74-44c9-8597-1e0d8f894f51',
    'friday': 'bd119bac-29b7-4a76-a1cf-f7f8973deef0',
    'saturday': '47e61772-9ead-4c18-91a2-fee3cca0e3cf',
    'sunday': '88626721-eef6-4e8c-b121-e4368fae21f7'
  },

  // Recycling Day options (Unit Management list)
  recycling_day: {
    'monday': 'fd6b732c-5627-4bcc-acf6-16a6fc99cfca',
    'tuesday': 'ee3b644b-9e7e-471c-82a9-a0c7560488bf',
    'wednesday': 'b73dd168-7458-4f6a-abc4-5d4f469136bc',
    'thursday': 'a100c7c5-3df3-426d-9ba6-7c68de332eaf',
    'friday': '9164f7d8-28b7-4ba8-b7c3-fa047e298fee',
    'saturday': '6d10a89f-aec4-439e-9b6d-08e2a3e0be5a',
    'sunday': 'e6940040-daa3-4b27-8660-7d30aa51a804',
    'none': '1ab8fd7b-4d3a-4227-95a5-edaedec69015',
    'same_as_trash': null // Special handling - use trash day value
  },

  // Processing Status options (Unit Management list)
  processing_status: {
    'pending': 'e7656d08-bdce-4d60-99cd-d23824a3a8a0',
    'in_progress': 'b48ce28a-2179-430d-ace3-37b7bb088915',
    'completed': '1df9701d-1cb6-46c6-9b1c-97c9ddc938d7',
    'on_hold': 'a6a840b3-74ff-436c-8ea9-be43f991760e'
  }
};

module.exports = CLICKUP_OPTIONS;

