/**
 * Import template definitions and download helpers for Phase V.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ColumnDefinition } from '../types/dataManagement';

export const LEAD_COLUMNS: ColumnDefinition[] = [
  {
    key: 'company_name',
    label: 'Company Name',
    required: true,
    aliases: ['company name', 'company', 'organization', 'account', 'business', 'client name'],
    description: 'Name of the prospective client or business organization (Required)',
  },
  {
    key: 'contact_person',
    label: 'Contact Person',
    required: false,
    aliases: ['contact person', 'contact name', 'person', 'contact', 'primary contact', 'poc', 'representative'],
    description: 'Full name of key decision maker or contact person',
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    aliases: ['phone', 'mobile', 'telephone', 'tel', 'cell', 'contact number', 'phone number'],
    description: 'Primary telephone or direct mobile number (e.g. +968 91234567)',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    required: false,
    aliases: ['whatsapp', 'wa', 'whatsapp number', 'wa number', 'whatsapp mobile'],
    description: 'Direct WhatsApp communication number',
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    aliases: ['email', 'email address', 'e-mail', 'mail'],
    description: 'Valid business or contact email address',
  },
  {
    key: 'lead_type',
    label: 'Lead Type',
    required: false,
    aliases: ['lead type', 'type', 'category', 'client type', 'customer type'],
    description: 'Industry segment (e.g. Interior Designer, Contractor, Architect, Commercial Client)',
  },
  {
    key: 'location',
    label: 'Location',
    required: false,
    aliases: ['location', 'city', 'area', 'region', 'address', 'governorate'],
    description: 'City, region, or physical location (e.g. Muscat, Salalah, Sohar)',
  },
  {
    key: 'source',
    label: 'Source',
    required: false,
    aliases: ['source', 'lead source', 'channel', 'origin', 'referral source'],
    description: 'Acquisition channel (e.g. Referral, Website, Walk-in, Google, Social Media)',
  },
  {
    key: 'priority',
    label: 'Priority',
    required: false,
    aliases: ['priority', 'urgency', 'rating', 'temperature'],
    description: 'Hot, Warm, or Cold (defaults to Warm if blank)',
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    aliases: ['status', 'stage', 'pipeline stage', 'lead status'],
    description: 'New, Contacted, Interested, Meeting, Quotation, Negotiation, Won, or Lost',
  },
  {
    key: 'notes',
    label: 'Notes',
    required: false,
    aliases: ['notes', 'remarks', 'comments', 'description', 'details'],
    description: 'General background notes or conversation log',
  },
  {
    key: 'project_name',
    label: 'Project Name',
    required: false,
    aliases: ['project name', 'project', 'site name', 'development'],
    description: 'Name of associated project or development',
  },
  {
    key: 'project_type',
    label: 'Project Type',
    required: false,
    aliases: ['project type', 'building type', 'development type'],
    description: 'Residential, Commercial, Industrial, Hospitality, Retail, etc.',
  },
  {
    key: 'project_location',
    label: 'Project Location',
    required: false,
    aliases: ['project location', 'site location', 'site address'],
    description: 'Location or site coordinates of the project',
  },
  {
    key: 'requirement',
    label: 'Requirement',
    required: false,
    aliases: ['requirement', 'requirements', 'scope', 'needed services', 'product requested'],
    description: 'Summary of client needs, products or materials required',
  },
  {
    key: 'estimated_value',
    label: 'Estimated Value',
    required: false,
    aliases: ['estimated value', 'value', 'deal value', 'budget', 'amount', 'estimated amount'],
    description: 'Numeric estimated deal size in OMR / currency (e.g. 15000)',
  },
  {
    key: 'expected_closing_date',
    label: 'Expected Closing Date',
    required: false,
    aliases: ['expected closing date', 'closing date', 'expected close', 'target date'],
    description: 'Target closing date in YYYY-MM-DD format (e.g. 2026-10-15)',
  },
  {
    key: 'assigned_salesman',
    label: 'Assigned Salesman',
    required: false,
    aliases: ['assigned salesman', 'salesman', 'sales rep', 'owner', 'assigned to', 'rep name'],
    description: 'Full name or email of assigned sales representative (Admin sets)',
  },
];

export const CLIENT_COLUMNS: ColumnDefinition[] = [
  {
    key: 'company_name',
    label: 'Company Name',
    required: true,
    aliases: ['company name', 'company', 'organization', 'client name', 'account name', 'business'],
    description: 'Official registered company or client organization name (Required)',
  },
  {
    key: 'contact_person',
    label: 'Primary Contact',
    required: false,
    aliases: ['primary contact', 'contact person', 'contact name', 'poc', 'key person', 'contact'],
    description: 'Primary liaison or point of contact',
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    aliases: ['phone', 'mobile', 'telephone', 'tel', 'cell', 'office phone'],
    description: 'Primary office or mobile contact number',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    required: false,
    aliases: ['whatsapp', 'wa', 'whatsapp number', 'wa mobile'],
    description: 'Direct WhatsApp communication line',
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    aliases: ['email', 'email address', 'e-mail', 'mail'],
    description: 'Authorized corporate or contact email address',
  },
  {
    key: 'location',
    label: 'Location',
    required: false,
    aliases: ['location', 'city', 'area', 'region', 'address'],
    description: 'Headquarters or office city / region',
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    aliases: ['status', 'client status', 'account status', 'active status'],
    description: 'Active or Inactive (defaults to Active)',
  },
  {
    key: 'owner',
    label: 'Owner',
    required: false,
    aliases: ['owner', 'account owner', 'salesman', 'assigned salesman', 'assigned to', 'rep'],
    description: 'Name or email of managing account representative',
  },
  {
    key: 'notes',
    label: 'Notes',
    required: false,
    aliases: ['notes', 'remarks', 'comments', 'description', 'account history'],
    description: 'Account overview, credit guidelines, or relationship notes',
  },
  {
    key: 'tags',
    label: 'Tags',
    required: false,
    aliases: ['tags', 'tag', 'labels', 'categories', 'segment tags'],
    description: 'Comma-separated tags (e.g. VIP, Corporate, Repeat Buyer)',
  },
];

export const COMBINED_COLUMNS: ColumnDefinition[] = [
  {
    key: 'company_name',
    label: 'Company Name',
    required: true,
    aliases: ['company name', 'company', 'organization', 'client name', 'account name', 'business'],
    description: 'Official company or client organization name (Required)',
    category: 'company',
  },
  {
    key: 'contact_person',
    label: 'Contact Person',
    required: false,
    aliases: ['contact person', 'contact name', 'person', 'contact', 'primary contact', 'poc', 'representative'],
    description: 'Full name of key decision maker or contact person',
    category: 'contact',
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    aliases: ['phone', 'mobile', 'telephone', 'tel', 'cell', 'contact number', 'phone number'],
    description: 'Primary telephone or direct mobile (e.g. +968 91234567 or 91234567)',
    category: 'contact',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    required: false,
    aliases: ['whatsapp', 'wa', 'whatsapp number', 'wa number', 'whatsapp mobile'],
    description: 'Direct WhatsApp communication line',
    category: 'contact',
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    aliases: ['email', 'email address', 'e-mail', 'mail'],
    description: 'Authorized corporate or contact email address',
    category: 'contact',
  },
  {
    key: 'location',
    label: 'Location',
    required: false,
    aliases: ['location', 'city', 'area', 'region', 'address', 'governorate'],
    description: 'Headquarters or project city / region (e.g. Muscat, Sohar)',
    category: 'company',
  },
  {
    key: 'address',
    label: 'Address',
    required: false,
    aliases: ['address', 'office address', 'building', 'street'],
    description: 'Street address or office premises details',
    category: 'company',
  },
  {
    key: 'client_status',
    label: 'Client Status',
    required: false,
    aliases: ['client status', 'account status', 'active status'],
    description: 'Active or Inactive (defaults to Active)',
    category: 'client',
  },
  {
    key: 'tags',
    label: 'Tags',
    required: false,
    aliases: ['tags', 'tag', 'labels', 'categories', 'segment tags'],
    description: 'Comma-separated tags (e.g. VIP, High Value, Architectural)',
    category: 'client',
  },
  {
    key: 'assigned_salesman',
    label: 'Salesman / Owner',
    required: false,
    aliases: ['salesman', 'sales rep', 'owner', 'assigned salesman', 'assigned to', 'rep', 'rep name'],
    description: 'Name or email of assigned company sales representative',
    category: 'ownership',
  },
  {
    key: 'lead_type',
    label: 'Lead / Client Type',
    required: false,
    aliases: ['lead type', 'type', 'category', 'client type', 'customer type'],
    description: 'Interior Designer, Contractor, Architect, Commercial Client, Direct Client, etc.',
    category: 'lead',
  },
  {
    key: 'source',
    label: 'Source',
    required: false,
    aliases: ['source', 'lead source', 'channel', 'origin', 'referral source'],
    description: 'Referral, Website, WhatsApp, Walk-in, Google, Social Media, etc.',
    category: 'lead',
  },
  {
    key: 'priority',
    label: 'Deal Priority',
    required: false,
    aliases: ['priority', 'urgency', 'rating', 'temperature'],
    description: 'Hot, Warm, or Cold (defaults to Warm)',
    category: 'lead',
  },
  {
    key: 'status',
    label: 'Lead Stage',
    required: false,
    aliases: ['status', 'stage', 'pipeline stage', 'lead status'],
    description: 'New, Contacted, Interested, Meeting, Quotation, Negotiation, Won, or Lost',
    category: 'lead',
  },
  {
    key: 'project_name',
    label: 'Project Name',
    required: false,
    aliases: ['project name', 'project', 'site name', 'development', 'opportunity'],
    description: 'Associated project, development, or opportunity name',
    category: 'lead',
  },
  {
    key: 'project_type',
    label: 'Project Type',
    required: false,
    aliases: ['project type', 'building type', 'development type'],
    description: 'Residential, Commercial, Industrial, Hospitality, Retail, etc.',
    category: 'lead',
  },
  {
    key: 'project_location',
    label: 'Project Location',
    required: false,
    aliases: ['project location', 'site location', 'site address'],
    description: 'Site address or location of the project',
    category: 'lead',
  },
  {
    key: 'requirement',
    label: 'Requirement',
    required: false,
    aliases: ['requirement', 'requirements', 'scope', 'needed services', 'product requested'],
    description: 'Products or services needed by client',
    category: 'lead',
  },
  {
    key: 'estimated_value',
    label: 'Estimated Value',
    required: false,
    aliases: ['estimated value', 'value', 'deal value', 'budget', 'amount'],
    description: 'Estimated deal value in OMR (numbers only, e.g. 15000)',
    category: 'lead',
  },
  {
    key: 'expected_closing_date',
    label: 'Expected Closing Date',
    required: false,
    aliases: ['expected closing date', 'closing date', 'target date'],
    description: 'Target closing date in YYYY-MM-DD format (e.g. 2026-11-30)',
    category: 'lead',
  },
  {
    key: 'next_followup_date',
    label: 'Next Follow-up Date',
    required: false,
    aliases: ['next follow-up date', 'next followup', 'follow up date', 'followup date'],
    description: 'Scheduled follow-up date in YYYY-MM-DD format',
    category: 'lead',
  },
  {
    key: 'notes',
    label: 'Notes',
    required: false,
    aliases: ['notes', 'remarks', 'comments', 'description', 'details'],
    description: 'General remarks, communication notes or specifications',
    category: 'company',
  },
];

/**
 * Creates Excel guide sheet data
 */
function createGuideSheet(importType: 'leads' | 'clients' | 'clients_and_leads') {
  const guideRows = [
    ['ZaynOps Business Data Migration Guide', ''],
    ['Generated For', importType.toUpperCase().replace(/_/g, ' ')],
    ['', ''],
    ['Column Rule', 'Guidance & Expected Formats'],
    ['Company Name', 'MANDATORY. Must not be empty. Used as secondary duplicate identifier.'],
    ['Phone & WhatsApp', 'Oman phone numbers (+968 9XXXXXXX, 968XXXXXXXX, or 8 digits) are auto-normalized.'],
    ['Phone Normalization', 'Primary key for duplicate detection. E.g. "+968 91234567" matches "91234567".'],
    ['Email', 'Optional. Must follow valid email syntax (e.g. name@domain.com).'],
    ['Salesman / Owner', 'Name or email of team member. Unmatched reps will be prompted in the mapping step.'],
    ['Priority Values', 'Hot, Warm, Cold (default is Warm).'],
    ['Lead Stages', 'New, Contacted, Interested, Meeting, Quotation, Negotiation, Won, Lost (default is New).'],
    ['Client Status', 'Active, Inactive (default is Active).'],
    ['Estimated Value', 'Numeric currency value without symbols (e.g. 15000, not "15,000 OMR").'],
    ['Date Formats', 'Standard YYYY-MM-DD format (e.g. 2026-10-31).'],
    ['Clients + Leads Mode', 'Creates or links the Client record, and attaches the project Lead seamlessly.'],
  ];
  return XLSX.utils.aoa_to_sheet(guideRows);
}

/**
 * Downloads a clean template without fake CRM records.
 * Contains only the standardized headers and one sample instruction row.
 */
export function downloadLeadTemplate(format: 'csv' | 'xlsx' = 'csv') {
  const headers = LEAD_COLUMNS.map((c) => c.label);
  const sampleDataRow = [
    'Oman Royal Development LLC', // Company Name
    'Ahmed Al Balushi', // Contact Person
    '+968 91234567', // Phone
    '+968 91234567', // WhatsApp
    'ahmed@omanroyal.com', // Email
    'Commercial Client', // Lead Type
    'Muscat', // Location
    'Referral', // Source
    'Hot', // Priority
    'New', // Status
    'Interested in premium interior fitout packages for upcoming hospitality wing.', // Notes
    'Al Mouj Commercial Tower', // Project Name
    'Commercial', // Project Type
    'Al Mouj, Muscat', // Project Location
    'Acoustic panels & custom reception millwork', // Requirement
    '25000', // Estimated Value
    '2026-11-30', // Expected Closing Date
    'Rashid Al-Habsi', // Assigned Salesman
  ];

  if (format === 'csv') {
    const csvContent = Papa.unparse([headers, sampleDataRow]);
    triggerBlobDownload(csvContent, 'ZaynOps_Leads_Import_Template.csv', 'text/csv;charset=utf-8;');
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleDataRow]);
    const guideWs = createGuideSheet('leads');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads Template');
    XLSX.utils.book_append_sheet(wb, guideWs, 'Migration Guide');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerBlobDownload(new Blob([wbout], { type: 'application/octet-stream' }), 'ZaynOps_Leads_Import_Template.xlsx');
  }
}

export function downloadClientTemplate(format: 'csv' | 'xlsx' = 'csv') {
  const headers = CLIENT_COLUMNS.map((c) => c.label);
  const sampleDataRow = [
    'Sultanate Engineering Consultants', // Company Name
    'Salim Al-Kharusi', // Primary Contact
    '+968 94567890', // Phone
    '+968 94567890', // WhatsApp
    'salim@sultanate-eng.om', // Email
    'Sohar', // Location
    'Active', // Status
    'Fatima Al-Zahra', // Owner
    'Key architecture consultancy client with quarterly procurement cycle.', // Notes
    'VIP, High Value, Architectural', // Tags
  ];

  if (format === 'csv') {
    const csvContent = Papa.unparse([headers, sampleDataRow]);
    triggerBlobDownload(csvContent, 'ZaynOps_Clients_Import_Template.csv', 'text/csv;charset=utf-8;');
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleDataRow]);
    const guideWs = createGuideSheet('clients');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients Template');
    XLSX.utils.book_append_sheet(wb, guideWs, 'Migration Guide');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerBlobDownload(new Blob([wbout], { type: 'application/octet-stream' }), 'ZaynOps_Clients_Import_Template.xlsx');
  }
}

export function downloadCombinedTemplate(format: 'csv' | 'xlsx' = 'csv') {
  const headers = COMBINED_COLUMNS.map((c) => c.label);
  const sampleDataRow = [
    'Bahwan Building Systems LLC', // Company Name
    'Youssef Al-Harthy', // Contact Person
    '+968 92345678', // Phone
    '+968 92345678', // WhatsApp
    'youssef@bahwansystems.om', // Email
    'Muscat', // Location
    'Building 42, Knowledge Oasis Muscat', // Address
    'Active', // Client Status
    'Corporate, Fitout, MEP', // Tags
    'Saud Al-Harthy', // Salesman / Owner
    'Contractor', // Lead / Client Type
    'Direct Customer', // Source
    'Hot', // Deal Priority
    'Quotation', // Lead Stage
    'KOM Innovation Hub Phase 2', // Project Name
    'Commercial', // Project Type
    'KOM, Rusayl, Muscat', // Project Location
    'HVAC controls, acoustic ceiling panels, and boardroom fitout', // Requirement
    '45000', // Estimated Value
    '2026-12-15', // Expected Closing Date
    '2026-10-01', // Next Follow-up Date
    'Client converted from initial pilot contract. Excellent relationship history.', // Notes
  ];

  if (format === 'csv') {
    const csvContent = Papa.unparse([headers, sampleDataRow]);
    triggerBlobDownload(csvContent, 'ZaynOps_Combined_Clients_Leads_Template.csv', 'text/csv;charset=utf-8;');
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleDataRow]);
    const guideWs = createGuideSheet('clients_and_leads');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients & Leads Template');
    XLSX.utils.book_append_sheet(wb, guideWs, 'Migration Guide');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerBlobDownload(new Blob([wbout], { type: 'application/octet-stream' }), 'ZaynOps_Combined_Clients_Leads_Template.xlsx');
  }
}

/**
 * Generates and downloads the row-by-row Error Report
 */
export function downloadErrorReport(
  errors: Array<{ rowNumber: number; problem: string; suggestedCorrection?: string; field?: string }>,
  importType: string
) {
  const headers = ['Row Number', 'Field', 'Problem Identified', 'Suggested Correction'];
  const rows = errors.map((err) => [
    err.rowNumber,
    err.field || 'General',
    err.problem,
    err.suggestedCorrection || 'Check row formatting and re-upload',
  ]);

  const csvContent = Papa.unparse([headers, ...rows]);
  triggerBlobDownload(
    csvContent,
    `LeadFlow_${importType}_Import_Errors_${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8;'
  );
}

function triggerBlobDownload(content: string | Blob, filename: string, mimeType?: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType || 'text/plain' }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
