/**
 * Core Database & CRM Type Definitions for Phase 2
 * Matches required schema specifications exactly
 */

export type Priority = 'Hot' | 'Warm' | 'Cold';

export type LeadType =
  | 'Interior Designer'
  | 'Contractor'
  | 'Architect'
  | 'Direct Client'
  | 'Commercial Client'
  | 'Consultant'
  | 'Other';

export type ProjectType =
  | 'Residential'
  | 'Commercial'
  | 'Industrial'
  | 'Hospitality'
  | 'Healthcare'
  | 'Retail'
  | 'Mixed Use'
  | 'Other';

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Meeting'
  | 'Quotation'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type ActivityType =
  | 'Call'
  | 'WhatsApp'
  | 'Meeting'
  | 'Email'
  | 'Quotation'
  | 'Note'
  | 'Site Visit'
  | 'Follow-up'
  | 'Status Change'
  | 'Priority Change'
  | 'Assignment'
  | 'Lead Created'
  | 'Attachment Uploaded'
  | 'Attachment Deleted'
  | 'Other';

export type FollowUpStatus = 'pending' | 'completed' | 'rescheduled' | 'cancelled';

export type FollowUpActionType =
  | 'Call'
  | 'WhatsApp'
  | 'Email'
  | 'Meeting'
  | 'Site Visit'
  | 'Customer Check-in'
  | 'New Requirement'
  | 'Repeat Order Discussion'
  | 'General Follow-up'
  | 'Quotation Follow-up'
  | 'Contract Review'
  | 'Payment Follow-up'
  | 'Other';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SALESMAN' | 'CUSTOMER' | 'admin' | 'sales_rep' | 'customer';

export type CompanyStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Company record in Firestore: `companies/{companyId}`
 * Phase X — Multi-Company SaaS Architecture
 */
export interface CompanyRecord {
  id: string;
  name: string;
  code?: string;
  email?: string;
  contact_email?: string;
  contact_person?: string;
  phone?: string;
  contact_phone?: string;
  industry?: string;
  address?: string;
  website?: string;
  notes?: string;
  logo_url?: string;
  timezone?: string;
  currency?: string;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
  created_by?: string; // Super Admin UID
  // Denormalized/Aggregated usage metrics
  salesmen_count?: number;
  leads_count?: number;
  clients_count?: number;
  admin_id?: string;
  admin_name?: string;
  admin_email?: string;
}

export interface CreateCompanyInput {
  name: string;
  code?: string;
  email?: string;
  contact_email?: string;
  phone?: string;
  contact_phone?: string;
  industry?: string;
  address?: string;
  website?: string;
  notes?: string;
  logo_url?: string;
  timezone?: string;
  currency?: string;
  status?: CompanyStatus;
  // Initial Company Admin details
  admin_full_name?: string;
  admin_email?: string;
  admin_phone?: string;
  admin_password?: string;
}

export type UpdateCompanyInput = Partial<CreateCompanyInput>;

/**
 * Granular permissions configurable by Company Admin for Salesmen
 */
export type SalesmanPermission =
  | 'LEADS_VIEW'
  | 'LEADS_CREATE'
  | 'LEADS_EDIT'
  | 'LEADS_ASSIGN'
  | 'LEADS_TRANSFER'
  | 'LEADS_DELETE'
  | 'CLIENTS_VIEW'
  | 'CLIENTS_CREATE'
  | 'CLIENTS_EDIT'
  | 'CLIENTS_TRANSFER'
  | 'ACTIVITIES_VIEW'
  | 'ACTIVITIES_CREATE'
  | 'COMMUNICATIONS_VIEW'
  | 'COMMUNICATIONS_CREATE'
  | 'TRANSFER_HISTORY_VIEW'
  | 'FOLLOWUPS_VIEW'
  | 'FOLLOWUPS_CREATE'
  | 'FOLLOWUPS_EDIT'
  | 'CALENDAR_VIEW'
  | 'REPORTS_VIEW'
  | 'TARGETS_VIEW'
  | 'TAGS_VIEW'
  | 'TAGS_MANAGE'
  | 'NOTIFICATIONS_VIEW'
  | 'ATTACHMENTS_VIEW'
  | 'ATTACHMENTS_UPLOAD'
  | 'IMPORT_VIEW'
  | 'IMPORT_CREATE'
  | 'EXPORT_DATA';

export interface PermissionDefinition {
  key: SalesmanPermission;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  title: string;
  description?: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'leads',
    title: 'Leads Management',
    description: 'Control access to prospective customer leads & deals',
    permissions: [
      { key: 'LEADS_VIEW', label: 'View Leads', description: 'Access leads directory and pipeline stages' },
      { key: 'LEADS_CREATE', label: 'Create Leads', description: 'Add new leads manually or via quick action' },
      { key: 'LEADS_EDIT', label: 'Edit Leads', description: 'Update lead details, priority, and stages' },
      { key: 'LEADS_ASSIGN', label: 'Assign Leads', description: 'Reassign leads to other team members' },
      { key: 'LEADS_TRANSFER', label: 'Transfer Leads', description: 'Handover or transfer leads to another representative' },
      { key: 'LEADS_DELETE', label: 'Delete Leads', description: 'Permanently remove lead records' },
    ],
  },
  {
    id: 'clients',
    title: 'Clients Management',
    description: 'Manage won accounts and client relationship records',
    permissions: [
      { key: 'CLIENTS_VIEW', label: 'View Clients', description: 'Access clients directory and client details' },
      { key: 'CLIENTS_CREATE', label: 'Create Clients', description: 'Add new clients or convert leads' },
      { key: 'CLIENTS_EDIT', label: 'Edit Clients', description: 'Modify client records and status' },
      { key: 'CLIENTS_TRANSFER', label: 'Transfer Clients', description: 'Transfer client portfolio to another representative' },
    ],
  },
  {
    id: 'activities',
    title: 'Activities & Communications Hub',
    description: 'Log and review communications and client interactions',
    permissions: [
      { key: 'ACTIVITIES_VIEW', label: 'View Activities', description: 'See interaction timelines and call logs' },
      { key: 'ACTIVITIES_CREATE', label: 'Log Activities', description: 'Log phone calls, meetings, notes, and emails' },
      { key: 'COMMUNICATIONS_VIEW', label: 'View Communications Hub', description: 'Access company communication center' },
      { key: 'COMMUNICATIONS_CREATE', label: 'Log Communications', description: 'Record team customer communications' },
      { key: 'TRANSFER_HISTORY_VIEW', label: 'View Transfer History', description: 'Review audit logs of lead and client reassignments' },
    ],
  },
  {
    id: 'followups',
    title: 'Follow-ups & Tasks',
    description: 'Schedule and manage customer follow-up actions',
    permissions: [
      { key: 'FOLLOWUPS_VIEW', label: 'View Follow-ups', description: 'View scheduled follow-ups and action queues' },
      { key: 'FOLLOWUPS_CREATE', label: 'Create Follow-ups', description: 'Schedule new follow-ups, calls, and site visits' },
      { key: 'FOLLOWUPS_EDIT', label: 'Manage Follow-ups', description: 'Complete, reschedule, or edit follow-up tasks' },
    ],
  },
  {
    id: 'calendar',
    title: 'Sales Calendar',
    description: 'Interactive visual calendar of scheduled meetings & tasks',
    permissions: [
      { key: 'CALENDAR_VIEW', label: 'View Calendar', description: 'Access interactive schedule and date planner' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    description: 'Performance metrics, win/loss ratios, and team KPIs',
    permissions: [
      { key: 'REPORTS_VIEW', label: 'View Reports & KPIs', description: 'Access performance dashboards and analytics' },
    ],
  },
  {
    id: 'targets',
    title: 'Sales Targets',
    description: 'Personal and team sales revenue targets',
    permissions: [
      { key: 'TARGETS_VIEW', label: 'View Targets', description: 'View assigned monthly/quarterly sales quotas' },
    ],
  },
  {
    id: 'attachments',
    title: 'Document Attachments',
    description: 'Uploaded contracts, proposals, and customer files',
    permissions: [
      { key: 'ATTACHMENTS_VIEW', label: 'View Attachments', description: 'Open and inspect uploaded documents' },
      { key: 'ATTACHMENTS_UPLOAD', label: 'Upload Attachments', description: 'Upload proposals, files, and agreements' },
    ],
  },
  {
    id: 'data',
    title: 'Import & Export',
    description: 'Bulk CSV / Excel data operations',
    permissions: [
      { key: 'IMPORT_VIEW', label: 'View Import Tool', description: 'Access data import wizard' },
      { key: 'IMPORT_CREATE', label: 'Import Leads Data', description: 'Upload and ingest CSV lead datasets' },
      { key: 'EXPORT_DATA', label: 'Export Data', description: 'Download CSV and Excel CRM reports' },
    ],
  },
  {
    id: 'other',
    title: 'Tags & Notifications',
    description: 'Metadata tags and system notification alerts',
    permissions: [
      { key: 'TAGS_VIEW', label: 'View Tags & Segments', description: 'Filter leads by tags and custom segments' },
      { key: 'TAGS_MANAGE', label: 'Manage Tags', description: 'Create, edit, or remove CRM tags' },
      { key: 'NOTIFICATIONS_VIEW', label: 'View Notifications', description: 'Receive in-app alerts and notifications' },
    ],
  },
];

/**
 * Standard Salesman preset (default baseline permissions)
 */
export const DEFAULT_SALESMAN_PERMISSIONS: SalesmanPermission[] = [
  'LEADS_VIEW',
  'LEADS_CREATE',
  'LEADS_EDIT',
  'LEADS_TRANSFER',
  'CLIENTS_VIEW',
  'CLIENTS_CREATE',
  'CLIENTS_TRANSFER',
  'ACTIVITIES_VIEW',
  'ACTIVITIES_CREATE',
  'COMMUNICATIONS_VIEW',
  'COMMUNICATIONS_CREATE',
  'TRANSFER_HISTORY_VIEW',
  'FOLLOWUPS_VIEW',
  'FOLLOWUPS_CREATE',
  'FOLLOWUPS_EDIT',
  'CALENDAR_VIEW',
  'TARGETS_VIEW',
  'TAGS_VIEW',
  'NOTIFICATIONS_VIEW',
  'ATTACHMENTS_VIEW',
  'ATTACHMENTS_UPLOAD',
];

/**
 * Senior Salesman preset (elevated permissions: lead assignment, reports, export, tag management)
 */
export const SENIOR_SALESMAN_PERMISSIONS: SalesmanPermission[] = [
  'LEADS_VIEW',
  'LEADS_CREATE',
  'LEADS_EDIT',
  'LEADS_ASSIGN',
  'LEADS_TRANSFER',
  'CLIENTS_VIEW',
  'CLIENTS_CREATE',
  'CLIENTS_EDIT',
  'CLIENTS_TRANSFER',
  'ACTIVITIES_VIEW',
  'ACTIVITIES_CREATE',
  'COMMUNICATIONS_VIEW',
  'COMMUNICATIONS_CREATE',
  'TRANSFER_HISTORY_VIEW',
  'FOLLOWUPS_VIEW',
  'FOLLOWUPS_CREATE',
  'FOLLOWUPS_EDIT',
  'CALENDAR_VIEW',
  'REPORTS_VIEW',
  'TARGETS_VIEW',
  'TAGS_VIEW',
  'TAGS_MANAGE',
  'NOTIFICATIONS_VIEW',
  'ATTACHMENTS_VIEW',
  'ATTACHMENTS_UPLOAD',
  'EXPORT_DATA',
];

/**
 * Helper to evaluate whether a user has a specific permission
 */
export function hasPermission(
  user: UserProfile | null | undefined,
  permission: SalesmanPermission
): boolean {
  if (!user) return false;
  // Super Admin and Company Admin always have full authorization
  const role = (user.role || '').toUpperCase();
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    return true;
  }
  // For SALESMAN, if permissions array is present use it; otherwise fallback to default permissions
  const perms = Array.isArray(user.permissions) ? user.permissions : DEFAULT_SALESMAN_PERMISSIONS;
  return perms.includes(permission);
}

/**
 * User Profile in Firestore: `users/{userId}`
 */
export interface UserProfile {
  id: string; // Auth UID
  company_id?: string; // Company ID (Mandatory for ADMIN and SALESMAN)
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole; // 'SUPER_ADMIN' | 'ADMIN' | 'SALESMAN'
  is_active: boolean; // default: true
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  permissions?: SalesmanPermission[]; // Granular permissions configured by Company Admin
}

/**
 * Lead document in Firestore: `leads/{leadId}`
 */
export interface LeadRecord {
  id: string;
  company_id?: string; // Tenant company boundary
  company_name: string; // Required
  contact_person?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  lead_type?: string;
  location?: string;
  source?: string;
  priority: Priority; // Default: 'Warm'
  status: LeadStatus; // Default: 'New'
  notes?: string;
  next_action?: string;
  next_followup_date?: string; // YYYY-MM-DD or ISO string
  estimated_value?: number;
  project_name?: string;
  project_type?: string;
  project_location?: string;
  requirement?: string;
  expected_closing_date?: string;
  final_value?: number;
  closing_date?: string;
  lost_reason?: string;
  created_by: string; // User UID who originally created the lead
  assigned_to: string; // User UID of the salesman responsible
  created_at: string; // ISO string
  updated_at: string; // ISO string
  // Phase O: Client Conversion Relations
  converted_to_client_id?: string; // ID of the converted Client record in clients collection
  converted_at?: string; // ISO timestamp of conversion
  converted_by?: string; // UID of user who performed conversion
  // Phase P: Repeat Business Relationship Link
  source_client_id?: string; // Safe reference if this lead is a repeat opportunity from an existing client
  // Phase R: Advanced Tagging
  tags?: string[];
  // Phase S: Duplicate Detection & Safe Merge + Phase X Soft Deletion
  record_status?: 'active' | 'merged' | 'deleted';
  deleted_at?: string;
  deleted_by?: string;
  merged_into_id?: string;
  merged_at?: string;
  merged_by?: string;
  merged_by_name?: string;
  merge_notes?: string;
  normalized_phone?: string;
  normalized_whatsapp?: string;
  normalized_email?: string;
  normalized_company_name?: string;
}

/**
 * Client document in Firestore: `clients/{clientId}`
 * Phase O — Client Management Foundation & Sales Closing
 */
export type ClientStatus = 'Active' | 'Inactive';

export interface ClientRecord {
  id: string;
  company_id?: string; // Tenant company boundary
  company_name: string;
  contact_person?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  location?: string;
  address?: string;
  client_type?: string;
  source?: string; // 'Converted Lead' | 'Direct Customer' | 'Referral' | etc.
  source_lead_id?: string; // Direct link to immutable source lead (if converted from lead)
  owner_id: string; // Responsible salesman UID
  owner_name?: string; // Denormalized salesman display name
  status: ClientStatus; // 'Active' | 'Inactive'
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  converted_by?: string; // User UID who converted
  converted_by_name?: string;
  converted_at?: string; // ISO timestamp of conversion
  created_at: string; // ISO string
  updated_at: string; // ISO string
  // Phase R: Advanced Tagging
  tags?: string[];
  // Phase S: Duplicate Detection & Safe Merge
  record_status?: 'active' | 'merged';
  merged_into_id?: string;
  merged_at?: string;
  merged_by?: string;
  merged_by_name?: string;
  merge_notes?: string;
  normalized_phone?: string;
  normalized_whatsapp?: string;
  normalized_email?: string;
  normalized_company_name?: string;
}

/**
 * Lead Transfer Record in Firestore: `leads/{leadId}/transfers/{transferId}` & `lead_transfers/{transferId}`
 */
export interface LeadTransferRecord {
  id: string;
  company_id?: string;
  lead_id: string;
  lead_name?: string;
  previous_owner: string; // Previous assigned_to UID
  previous_owner_name?: string;
  from_user_id?: string;
  from_user_name?: string;
  new_owner: string; // New assigned_to UID
  new_owner_name?: string;
  to_user_id?: string;
  to_user_name?: string;
  transferred_by: string; // Actor UID
  transferred_by_name?: string;
  transferred_at: string; // ISO string
  timestamp?: string;
  reason?: string;
}

/**
 * Client Ownership Transfer Record in Firestore: `clients/{clientId}/transfers/{transferId}` & `client_transfers/{transferId}`
 */
export interface ClientTransferRecord {
  id: string;
  company_id?: string;
  client_id: string;
  client_name?: string;
  from_user_id: string;
  from_user_name?: string;
  previous_owner?: string;
  previous_owner_name?: string;
  to_user_id: string;
  to_user_name?: string;
  new_owner?: string;
  new_owner_name?: string;
  transferred_by: string;
  transferred_by_name?: string;
  transferred_at: string;
  timestamp?: string;
  reason?: string;
}

/**
 * Lead / Client Activity in Firestore: `leads/{leadId}/activities/{activityId}` or `clients/{clientId}/activities/{activityId}`
 */
export interface LeadActivityRecord {
  id: string;
  company_id?: string; // Tenant company boundary
  lead_id?: string; // Belongs to Lead (if lead activity)
  client_id?: string; // Belongs to Client (if client activity)
  client_name?: string;
  company_name?: string;
  entity_type?: 'lead' | 'client';
  activity_type: ActivityType;
  outcome?: string; // e.g. 'Connected', 'Message Sent', 'Quotation Accepted'
  description: string;
  notes?: string;
  activity_date: string; // ISO string
  activity_at?: string; // ISO string
  performed_by?: string; // User UID
  performed_by_name?: string;
  created_by: string; // User UID
  created_at: string; // ISO string
  updated_at?: string;
  is_system_activity?: boolean;
  previous_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
  scheduled_followup_id?: string;
}

/**
 * Follow-up record in Firestore: `leads/{leadId}/followups/{followupId}` and `/followups/{followupId}`
 */
export interface FollowUpRecord {
  id: string;
  company_id?: string; // Tenant company boundary
  lead_id: string; // Belongs to Lead
  company_name?: string; // Denormalized for display in Follow-up Center
  contact_person?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  priority?: Priority;
  lead_status?: LeadStatus;
  action: string;
  scheduled_at: string; // ISO string or datetime
  completed_at?: string; // ISO string
  completed_by?: string; // UID
  completed_by_name?: string;
  rescheduled_at?: string; // ISO string
  rescheduled_by?: string; // UID
  rescheduled_to_id?: string; // New Follow-up ID
  cancelled_at?: string; // ISO string
  cancelled_by?: string; // UID
  cancellation_reason?: string;
  status: FollowUpStatus; // 'pending' | 'completed' | 'rescheduled' | 'cancelled'
  outcome?: string; // e.g. 'Connected', 'Message Sent', 'No Answer'
  notes?: string; // Notes/details
  assigned_to: string; // User UID of responsible salesman
  assigned_to_name?: string;
  created_by: string; // User UID who scheduled
  created_at: string; // ISO string
  updated_at: string; // ISO string
  // Phase U: Calendar & Appointment Enhancement Fields
  title?: string; // Meeting/Visit title or subject
  end_time?: string; // ISO string or end timestamp
  location?: string; // Physical meeting/site address or virtual link
  client_id?: string; // Related client ID if booked for an existing customer
  entity_type?: 'Lead' | 'Client'; // Entity classification
}

export type AttachmentCategory =
  | 'Quotation'
  | 'Drawing'
  | 'BOQ'
  | 'Project Document'
  | 'Image'
  | 'Contract'
  | 'Specification'
  | 'Other';

/**
 * Attachment record in Firestore: `leads/{leadId}/attachments/{attachmentId}`
 */
export interface AttachmentRecord {
  id: string;
  company_id?: string; // Tenant company boundary
  lead_id: string; // Belongs to Lead
  file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string; // User UID
  uploaded_by_name?: string;
  uploaded_at: string; // ISO string
  updated_at?: string; // ISO string
  created_at?: string; // ISO string (for backward compatibility)
  category?: AttachmentCategory;
  description?: string;
  download_url?: string;
}

export interface UploadAttachmentInput {
  lead_id: string;
  file: File;
  category?: AttachmentCategory;
  description?: string;
  onProgress?: (progressPercent: number) => void;
}

/**
 * In-App Notifications & Reminders in Firestore: `notifications/{notificationId}`
 */
export type NotificationType =
  | 'followup_due_today'
  | 'followup_overdue'
  | 'upcoming_followup'
  | 'followup_completed'
  | 'lead_assigned'
  | 'lead_reassigned'
  | 'general';

export interface NotificationRecord {
  id: string;
  company_id?: string; // Tenant company boundary
  recipient_id: string; // Target User UID
  recipient_name?: string;
  type: NotificationType;
  title: string;
  message: string;
  lead_id?: string;
  lead_company_name?: string;
  follow_up_id?: string;
  is_read: boolean;
  created_at: string; // ISO 8601 string
  updated_at?: string;
  event_key?: string; // Deterministic deduplication key
  link_url?: string;
}

export interface CreateNotificationInput {
  recipient_id: string;
  recipient_name?: string;
  type: NotificationType;
  title: string;
  message: string;
  lead_id?: string;
  lead_company_name?: string;
  follow_up_id?: string;
  event_key?: string;
  link_url?: string;
}

/**
 * Audit Log Record in Firestore: `audit_logs/{auditLogId}`
 * Phase M — Dedicated Admin-only Security & System Accountability Log
 */
export type AuditActionType =
  | 'company_created'
  | 'company_updated'
  | 'company_activated'
  | 'company_deactivated'
  | 'company_admin_created'
  | 'company_admin_activated'
  | 'company_admin_deactivated'
  | 'salesman_created'
  | 'salesman_activated'
  | 'salesman_deactivated'
  | 'user_created'
  | 'user_activated'
  | 'user_deactivated'
  | 'user_role_changed'
  | 'lead_assigned'
  | 'lead_reassigned'
  | 'lead_ownership_changed'
  | 'lead_created'
  | 'lead_deleted'
  | 'lead_converted_to_client'
  | 'client_created'
  | 'client_status_changed'
  | 'client_ownership_transferred'
  | 'settings_changed'
  | 'tag_created'
  | 'tag_updated'
  | 'tag_activated'
  | 'tag_deactivated'
  | 'tag_deleted'
  | 'bulk_tag_added'
  | 'bulk_tag_removed'
  | 'segment_created'
  | 'segment_updated'
  | 'segment_deleted'
  | 'lead_merged'
  | 'client_merged'
  | 'duplicate_marked_not_duplicate'
  | 'bulk_lead_updated'
  | 'bulk_client_updated'
  | 'lead_imported'
  | 'client_imported'
  | 'data_exported'
  | 'security_unauthorized_lead_access'
  | 'security_unauthorized_client_access'
  | 'security_unauthorized_action'
  | 'security_permission_denied'
  | 'system_action';

export type AuditEntityType = 'Company' | 'User' | 'Lead' | 'Client' | 'Tag' | 'Segment' | 'Duplicate' | 'DataQuality' | 'Security' | 'Settings' | 'System';

export interface AuditLogRecord {
  id: string;
  company_id?: string; // Tenant company boundary (empty for system-wide/Super Admin logs)
  action: AuditActionType | string;
  entity_type: AuditEntityType | string;
  entity_id: string;
  performed_by: string; // User UID
  performed_by_name: string;
  performed_by_role: string; // 'SUPER_ADMIN' | 'ADMIN' | 'SALESMAN'
  target_user_id?: string;
  target_user_name?: string;
  lead_id?: string;
  lead_company_name?: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string; // ISO 8601 string
}

export interface CreateAuditLogInput {
  company_id?: string;
  action: AuditActionType | string;
  entity_type: AuditEntityType | string;
  entity_id: string;
  performed_by?: string;
  performed_by_name?: string;
  performed_by_role?: string;
  target_user_id?: string;
  target_user_name?: string;
  lead_id?: string;
  lead_company_name?: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface AuditFilterState {
  searchQuery: string;
  action: string | 'all';
  performerId: string | 'all';
  entityType: string | 'all';
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
}

/**
 * Input DTOs for Database Access Layer
 */
export interface CreateLeadInput {
  company_id?: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  lead_type?: string;
  location?: string;
  source?: string;
  priority?: Priority;
  status?: LeadStatus;
  notes?: string;
  next_action?: string;
  next_followup_date?: string;
  estimated_value?: number;
  project_name?: string;
  project_type?: string;
  project_location?: string;
  requirement?: string;
  expected_closing_date?: string;
  final_value?: number;
  closing_date?: string;
  lost_reason?: string;
  assigned_to?: string; // Optional: Admin can assign to specific salesman; Salesman defaults to self
  source_client_id?: string; // Phase P: Safe reference to source client for repeat opportunities
  tags?: string[];
}

export type UpdateLeadInput = Partial<Omit<LeadRecord, 'id' | 'created_by' | 'created_at' | 'updated_at'>>;

export interface TransferLeadInput {
  lead_id: string;
  new_owner: string;
  new_owner_name?: string;
  previous_owner: string;
  previous_owner_name?: string;
  reason?: string;
}

export interface CreateClientInput {
  name?: string;
  company_name: string;
  contact_person?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  location?: string;
  address?: string;
  client_type?: string;
  source?: string;
  notes?: string;
  tags?: string[];
  status?: ClientStatus;
  owner_id?: string;
  owner_name?: string;
}

export interface CreateActivityInput {
  lead_id?: string;
  client_id?: string;
  client_name?: string;
  company_name?: string;
  activity_type: ActivityType;
  description: string;
  outcome?: string;
  notes?: string;
  activity_date?: string;
  activity_at?: string;
  performed_by?: string;
  performed_by_name?: string;
  is_system_activity?: boolean;
  previous_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
  next_followup?: {
    action_type: string;
    scheduled_at: string;
    notes?: string;
  };
}

export interface CreateFollowUpInput {
  lead_id: string;
  action: string;
  scheduled_at: string;
  notes?: string;
  status?: FollowUpStatus;
  assigned_to?: string;
  company_name?: string;
  contact_person?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  priority?: Priority;
  lead_status?: LeadStatus;
  // Phase U Fields
  title?: string;
  end_time?: string;
  location?: string;
  client_id?: string;
  entity_type?: 'Lead' | 'Client';
}

export type UpdateFollowUpInput = Partial<Omit<FollowUpRecord, 'id' | 'lead_id' | 'created_by' | 'created_at' | 'updated_at'>>;

export interface CompleteFollowUpInput {
  lead_id: string;
  followup_id: string;
  outcome: string;
  notes?: string;
  performer_id?: string;
  performer_name?: string;
  next_followup?: {
    action: string;
    scheduled_at: string;
    notes?: string;
  };
}

export interface RescheduleFollowUpInput {
  lead_id: string;
  followup_id: string;
  new_scheduled_at: string;
  new_action?: string;
  new_end_time?: string;
  new_location?: string;
  notes?: string;
  performer_id?: string;
  performer_name?: string;
}

export interface CancelFollowUpInput {
  lead_id: string;
  followup_id: string;
  cancellation_reason?: string;
  performer_id?: string;
  performer_name?: string;
}

/**
 * Phase O: Client Management Inputs
 */
export interface CreateClientFromLeadInput {
  lead_id: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  location?: string;
  client_type?: string;
  owner_id: string; // Must follow lead assigned_to
  status?: ClientStatus;
  notes?: string;
}

export interface UpdateClientInput {
  company_name?: string;
  contact_person?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  location?: string;
  client_type?: string;
  status?: ClientStatus;
  notes?: string;
}

export interface TransferClientInput {
  client_id: string;
  new_owner_id: string;
  new_owner_name?: string;
  reason?: string;
}

/**
 * Phase R: Advanced Tagging & Customer Segmentation
 */
export type TagType = 'Lead' | 'Client' | 'Both';

export interface TagRecord {
  id: string;
  company_id?: string; // Tenant company boundary
  name: string; // Trimmed, unique case-insensitively
  description?: string;
  type: TagType;
  is_active: boolean; // default: true
  color?: string; // Color token: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'blue' | 'slate'
  created_by: string; // Admin UID
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
}

export interface CreateTagInput {
  name: string;
  description?: string;
  type: TagType;
  color?: string;
  is_active?: boolean;
}

export interface UpdateTagInput {
  name?: string;
  description?: string;
  type?: TagType;
  color?: string;
  is_active?: boolean;
}

export type SegmentEntityType = 'Lead' | 'Client' | 'Both';

export interface SegmentFilterCriteria {
  tags?: string[];
  tag_mode?: 'ANY' | 'ALL' | 'any' | 'all';
  stages?: string[];
  statuses?: string[];
  priorities?: string[];
  assigned_to?: string;
  date_field?: string;
  date_from?: string;
  date_to?: string;
  min_value?: number;
  max_value?: number;
  city?: string;
  [key: string]: any;
}

export interface SegmentFilterDefinition {
  recordType: SegmentEntityType;
  tagMode?: 'any' | 'all';
  tags?: string[];
  leadStatuses?: LeadStatus[];
  priorities?: Priority[];
  clientStatuses?: ClientStatus[];
  salesmanId?: string; // 'all' or specific salesman ID
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  closingDateFilter?: {
    mode: 'before' | 'after' | 'between' | 'any';
    date?: string;
    startDate?: string;
    endDate?: string;
  };
  followUpStatus?: 'any' | 'upcoming' | 'overdue' | 'none';
}

export interface SavedSegmentRecord {
  id: string;
  company_id?: string; // Tenant company boundary
  name: string;
  description: string;
  entity_type: SegmentEntityType;
  filter_definition: SegmentFilterDefinition;
  is_active: boolean;
  created_by: string; // Admin UID
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface CreateSavedSegmentInput {
  name: string;
  description?: string;
  entity_type: SegmentEntityType;
  filter_definition: SegmentFilterDefinition;
  is_active?: boolean;
}

export interface UpdateSavedSegmentInput {
  name?: string;
  description?: string;
  entity_type?: SegmentEntityType;
  filter_definition?: SegmentFilterDefinition;
  is_active?: boolean;
}

/**
 * Phase S: Dismissed Duplicate Record Pair: `not_duplicates/{pairId}`
 */
export interface NotDuplicateRecord {
  id: string; // [idA, idB].sort().join('_')
  company_id?: string; // Tenant company boundary
  record_a_id: string;
  record_b_id: string;
  entity_type: 'Lead' | 'Client';
  marked_by: string; // Admin UID
  marked_by_name?: string;
  created_at: string; // ISO string
}

export type DuplicateMatchField = 'phone' | 'whatsapp' | 'email' | 'company_name' | 'contact_person';

export interface DuplicateMatch<T> {
  id: string; // Unique pair key
  recordA: T;
  recordB: T;
  score: number; // Match confidence score 0-100
  reasons: string[];
  matchedFields: DuplicateMatchField[];
  detectedAt?: string;
}

export interface DuplicateMatchCandidate {
  pair_id: string;
  entity_type: 'Lead' | 'Client';
  record_a: any;
  record_b: any;
  confidence_score: number;
  match_reasons: string[];
  detected_at?: string;
}

export interface HygieneIssue {
  record_id: string;
  company_name: string;
  entity_type: 'Lead' | 'Client';
  missing_fields: string[];
}

export interface DatabaseCompletenessReport {
  issues: HygieneIssue[];
  totalRecordsChecked: number;
  healthPercentage: number;
}

export type DataIssueSeverity = 'critical' | 'warning' | 'optional';

export interface DataCompletenessIssue {
  field: string;
  label: string;
  severity: DataIssueSeverity;
  description: string;
}

export interface DataQualityReport<T> {
  record: T;
  recordType: 'Lead' | 'Client';
  score: number; // 0-100%
  issues: DataCompletenessIssue[];
  hasInvalidData: boolean;
  invalidFields: string[];
}

export interface MergeLeadsParams {
  survivingLeadId: string;
  mergedLeadId: string;
  survivingOwnerId: string;
  winningFields: {
    company_name: string;
    contact_person?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    location?: string;
    lead_type?: string;
    source?: string;
    priority?: Priority;
    status?: LeadStatus;
    estimated_value?: number;
    expected_closing_date?: string;
    notes?: string;
    tags?: string[];
  };
  notesMode: 'combine' | 'survivor_only';
  tagsMode: 'combine' | 'survivor_only';
  mergeNotes?: string;
}

export interface MergeClientsParams {
  survivingClientId: string;
  mergedClientId: string;
  survivingOwnerId: string;
  winningFields: {
    company_name: string;
    contact_person?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    location?: string;
    client_type?: string;
    status?: ClientStatus;
    notes?: string;
    tags?: string[];
  };
  notesMode: 'combine' | 'survivor_only';
  tagsMode: 'combine' | 'survivor_only';
  mergeNotes?: string;
}

/**
 * Phase U: Calendar & Appointment Management Types
 */
export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export type CalendarActionType =
  | 'Call'
  | 'WhatsApp'
  | 'WhatsApp Follow-up'
  | 'Email'
  | 'Email Follow-up'
  | 'Meeting'
  | 'Site Visit'
  | 'Customer Check-in'
  | 'New Requirement'
  | 'Repeat Order Discussion'
  | 'General Follow-up'
  | 'Follow-up';

export interface CalendarFilterState {
  eventType: string; // 'all' or specific action
  status: string; // 'all' | 'pending' | 'completed' | 'overdue' | 'rescheduled' | 'cancelled'
  recordType: 'all' | 'lead' | 'client';
  salesmanId: string; // 'all' or specific UID (Admin only)
  searchQuery: string;
}

export interface ScheduleConflictDetail {
  existingEvent: FollowUpRecord;
  salesmanName: string;
  salesmanId: string;
  conflictingTimeSlot: string;
  requestedTimeSlot: string;
  reason: string;
}


