/**
 * Centralized Database Access Layer (DAL)
 * Resilient, decoupled methods for all CRM CRUD operations & Role-Based Access Control
 * Seamless dual-persistence: Firestore Real-Time Cloud + Local Sync Engine
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  QueryConstraint,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, auth, storage, createAuthUserWithoutSignOut } from './firebase';
import {
  LeadRecord,
  CreateLeadInput,
  UpdateLeadInput,
  LeadActivityRecord,
  CreateActivityInput,
  FollowUpRecord,
  CreateFollowUpInput,
  UpdateFollowUpInput,
  CompleteFollowUpInput,
  RescheduleFollowUpInput,
  CancelFollowUpInput,
  UserProfile,
  AttachmentRecord,
  AttachmentCategory,
  UploadAttachmentInput,
  LeadTransferRecord,
  TransferLeadInput,
  UserRole,
  LeadStatus,
  Priority,
  NotificationRecord,
  NotificationType,
  CreateNotificationInput,
  AuditLogRecord,
  AuditActionType,
  AuditEntityType,
  CreateAuditLogInput,
  AuditFilterState,
  ClientRecord,
  ClientStatus,
  CreateClientInput,
  CreateClientFromLeadInput,
  UpdateClientInput,
  TransferClientInput,
  ClientTransferRecord,
  TagRecord,
  TagType,
  CreateTagInput,
  UpdateTagInput,
  SavedSegmentRecord,
  SegmentEntityType,
  SegmentFilterDefinition,
  CreateSavedSegmentInput,
  UpdateSavedSegmentInput,
  NotDuplicateRecord,
  MergeLeadsParams,
  MergeClientsParams,
  CompanyRecord,
  CompanyStatus,
  CreateCompanyInput,
  UpdateCompanyInput,
  SalesmanPermission,
  DEFAULT_SALESMAN_PERMISSIONS,
  hasPermission,
  TargetRecord,
  TargetType,
  TargetPeriodType,
  TargetStatus,
  CreateTargetInput,
  UpdateTargetInput,
} from '../types/database';
import { PREDEFINED_ACCOUNTS } from './predefinedAccounts';
import { normalizePhone, normalizeEmail, normalizeCompanyName, phonesMatch, getPairKey } from './dataQuality';
export { normalizePhone, normalizeEmail, normalizeCompanyName, phonesMatch };

const LOCAL_STORAGE_SESSION_KEY = 'crm_active_session_v1';
const LOCAL_STORAGE_LEADS_KEY = 'crm_local_leads_v2';
const LOCAL_STORAGE_ACTIVITIES_KEY = 'crm_local_activities_v2';
const LOCAL_STORAGE_FOLLOWUPS_KEY = 'crm_local_followups_v2';
const LOCAL_STORAGE_USERS_KEY = 'crm_local_users_v2';
const LOCAL_STORAGE_ATTACHMENTS_KEY = 'crm_local_attachments_v2';
const LOCAL_STORAGE_NOTIFICATIONS_KEY = 'crm_local_notifications_v2';
const LOCAL_STORAGE_AUDIT_LOGS_KEY = 'crm_local_audit_logs_v2';
const LOCAL_STORAGE_CLIENTS_KEY = 'crm_local_clients_v2';
const LOCAL_STORAGE_CLIENT_TRANSFERS_KEY = 'crm_local_client_transfers_v2';
const LOCAL_STORAGE_LEAD_TRANSFERS_KEY = 'crm_local_lead_transfers_v2';
const LOCAL_STORAGE_TAGS_KEY = 'crm_local_tags_v2';
const LOCAL_STORAGE_SAVED_SEGMENTS_KEY = 'crm_local_saved_segments_v2';
const LOCAL_STORAGE_NOT_DUPLICATES_KEY = 'crm_local_not_duplicates_v2';
export const LOCAL_STORAGE_COMPANIES_KEY = 'crm_local_companies_v1';
export const LOCAL_STORAGE_TARGETS_KEY = 'crm_local_targets_v1';

export const DEFAULT_COMPANY_ID = 'company-bahwan-mge';

export const INITIAL_DEFAULT_COMPANY: CompanyRecord = {
  id: DEFAULT_COMPANY_ID,
  name: 'Bahwan M&E LLC',
  code: 'BMGE',
  industry: 'Engineering & Construction Fitout',
  contact_email: 'info@bahwanmge.com',
  contact_phone: '+968 24 123456',
  address: 'CBD Area, Muscat, Sultanate of Oman',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

export function getLocalCompanies(): CompanyRecord[] {
  if (typeof localStorage === 'undefined') return [INITIAL_DEFAULT_COMPANY];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_COMPANIES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_COMPANIES_KEY, JSON.stringify([INITIAL_DEFAULT_COMPANY]));
      return [INITIAL_DEFAULT_COMPANY];
    }
    const parsed: CompanyRecord[] = JSON.parse(raw);
    if (!parsed || parsed.length === 0) {
      localStorage.setItem(LOCAL_STORAGE_COMPANIES_KEY, JSON.stringify([INITIAL_DEFAULT_COMPANY]));
      return [INITIAL_DEFAULT_COMPANY];
    }
    return parsed;
  } catch (e) {
    return [INITIAL_DEFAULT_COMPANY];
  }
}

export function setLocalCompanies(companies: CompanyRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_COMPANIES_KEY, JSON.stringify(companies));
  } catch (e) {
    console.warn('LocalStorage save failed for companies:', e);
  }
  notifyCompaniesChanged();
}

export function notifyCompaniesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_companies_changed'));
  }
}

// ----------------------------------------------------------------------
// Phase M: Audit Log Seed Data & Local Synchronizers
// ----------------------------------------------------------------------

const INITIAL_SAMPLE_AUDIT_LOGS: AuditLogRecord[] = [
  {
    id: 'audit-seed-1',
    action: 'user_created',
    entity_type: 'User',
    entity_id: 'uid-mujahid',
    performed_by: 'uid-mujahid',
    performed_by_name: 'Mujahid Islam',
    performed_by_role: 'ADMIN',
    target_user_id: 'uid-mujahid',
    target_user_name: 'Mujahid Islam',
    description: 'Master Administrator Mujahid Islam configured enterprise security credentials and RBAC access policies.',
    metadata: { role: 'ADMIN', email: 'itsyourmujahid@gmail.com', access_level: 'Full Superadmin' },
    created_at: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
  },
  {
    id: 'audit-seed-2',
    action: 'user_role_changed',
    entity_type: 'User',
    entity_id: 'uid-rashid',
    performed_by: 'uid-mujahid',
    performed_by_name: 'Mujahid Islam',
    performed_by_role: 'ADMIN',
    target_user_id: 'uid-rashid',
    target_user_name: 'Rashid Khan',
    description: 'User Rashid Khan configured with Sales Representative privileges in Commercial Fitout Division.',
    metadata: { previous_role: 'NONE', new_role: 'SALESMAN', department: 'Commercial Sales' },
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  },
  {
    id: 'audit-seed-3',
    action: 'lead_reassigned',
    entity_type: 'Lead',
    entity_id: 'lead-1',
    lead_id: 'lead-1',
    lead_company_name: 'Al Noor Tower Contracting',
    performed_by: 'uid-mujahid',
    performed_by_name: 'Mujahid Islam',
    performed_by_role: 'ADMIN',
    target_user_id: 'uid-saud',
    target_user_name: 'Saud Al-Otaibi',
    description: 'Admin Mujahid Islam reassigned Lead "Al Noor Tower Contracting" from Rashid Khan to Saud Al-Otaibi.',
    metadata: {
      previous_owner_id: 'uid-rashid',
      previous_owner_name: 'Rashid Khan',
      new_owner_id: 'uid-saud',
      new_owner_name: 'Saud Al-Otaibi',
      reason: 'High-value enterprise lead strategy re-assignment',
    },
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  {
    id: 'audit-seed-4',
    action: 'security_unauthorized_lead_access',
    entity_type: 'Security',
    entity_id: 'sec-block-01',
    performed_by: 'uid-joseph',
    performed_by_name: 'Joseph M.',
    performed_by_role: 'SALESMAN',
    description: 'Security Warning: Salesman Joseph M. attempted unauthorized direct URL access to unassigned Lead "Al Noor Tower Contracting" (Access Denied by RBAC policy).',
    metadata: {
      attempted_lead_id: 'lead-1',
      rbac_policy: 'salesman_scope_isolation',
      status: 'BLOCKED',
    },
    created_at: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
  },
];

export function getLocalAuditLogs(): AuditLogRecord[] {
  if (typeof localStorage === 'undefined') return INITIAL_SAMPLE_AUDIT_LOGS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUDIT_LOGS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_AUDIT_LOGS_KEY, JSON.stringify(INITIAL_SAMPLE_AUDIT_LOGS));
      return INITIAL_SAMPLE_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SAMPLE_AUDIT_LOGS;
  }
}

export function setLocalAuditLogs(logs: AuditLogRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('LocalStorage save failed for audit logs:', e);
  }
  notifyAuditLogsChanged();
}

export function notifyAuditLogsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_audit_logs_changed'));
  }
}

// ----------------------------------------------------------------------
// Local State Synchronizer
// ----------------------------------------------------------------------

const INITIAL_SAMPLE_LEADS: LeadRecord[] = [
  {
    id: 'lead-1',
    company_name: 'Al Noor Tower Contracting',
    contact_person: 'Ahmed Al-Shehri',
    phone: '+966 50 123 4567',
    whatsapp: '+966 50 123 4567',
    email: 'ahmed@alnoortower.sa',
    lead_type: 'b2b',
    location: 'Riyadh, Olaya District',
    source: 'inbound_call',
    priority: 'Hot',
    status: 'Quotation',
    notes: 'HVAC fitout and curtain wall glazing project for 24-storey commercial tower.',
    next_action: 'Follow up on revised quotation rev 3',
    next_followup_date: new Date(Date.now() + 86400000).toISOString(),
    estimated_value: 85000,
    project_name: 'Al Noor Commercial Complex',
    project_type: 'Commercial Tower',
    project_location: 'Riyadh',
    requirement: 'Glazing, Curtain Wall & HVAC installation',
    created_by: 'uid-mujahid',
    assigned_to: 'uid-rashid',
    tags: ['Hot Prospect', 'Large Project', 'Glass Project'],
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'lead-2',
    company_name: 'Gulf Marble & Granite',
    contact_person: 'Mansour Al-Harbi',
    phone: '+966 55 987 6543',
    whatsapp: '+966 55 987 6543',
    email: 'mansour@gulfmarble.com',
    lead_type: 'b2b',
    location: 'Jeddah, Industrial Area 2',
    source: 'referral',
    priority: 'Warm',
    status: 'Negotiation',
    notes: 'Flooring and wall marble supply. Requires BOQ validation.',
    next_action: 'Meeting with procurement team',
    next_followup_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    estimated_value: 45000,
    project_name: 'Jeddah Waterfront Mall',
    project_type: 'Retail Mall',
    project_location: 'Jeddah',
    requirement: 'Imported Marble & Granite Cladding',
    created_by: 'uid-mujahid',
    assigned_to: 'uid-saud',
    tags: ['Follow-up Required', 'High Value'],
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'lead-3',
    company_name: 'Modern Villas Development',
    contact_person: 'Sultan Al-Dosari',
    phone: '+966 56 321 0987',
    whatsapp: '+966 56 321 0987',
    email: 'sultan@modernvillas.sa',
    lead_type: 'b2c',
    location: 'Dammam, Corniche',
    source: 'website',
    priority: 'Cold',
    status: 'New',
    notes: 'Aluminum windows and sliding doors for luxury compound.',
    next_action: 'Initial discovery call',
    next_followup_date: new Date(Date.now() + 86400000 * 3).toISOString(),
    estimated_value: 32000,
    project_name: 'Corniche Luxury Villas',
    project_type: 'Residential Compound',
    project_location: 'Dammam',
    requirement: 'Thermal-break aluminum sliding systems',
    created_by: 'uid-mujahid',
    assigned_to: 'uid-joseph',
    tags: ['Local Customer'],
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
];

let inMemoryLeads: LeadRecord[] | null = null;

export function getLocalLeads(): LeadRecord[] {
  if (typeof localStorage === 'undefined') {
    if (!inMemoryLeads) inMemoryLeads = [...INITIAL_SAMPLE_LEADS];
    return inMemoryLeads;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LEADS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_LEADS_KEY, JSON.stringify(INITIAL_SAMPLE_LEADS));
      return INITIAL_SAMPLE_LEADS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SAMPLE_LEADS;
  }
}

function setLocalLeads(leads: LeadRecord[]) {
  if (typeof localStorage === 'undefined') {
    inMemoryLeads = [...leads];
    return;
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_LEADS_KEY, JSON.stringify(leads));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function notifyLeadsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_leads_changed'));
  }
}

export function getLocalActivities(): LeadActivityRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setLocalActivities(acts: LeadActivityRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_ACTIVITIES_KEY, JSON.stringify(acts));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

export function getLocalFollowUps(): FollowUpRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FOLLOWUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setLocalFollowUps(fu: FollowUpRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_FOLLOWUPS_KEY, JSON.stringify(fu));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

export function notifyFollowupsChanged(leadId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_followups_changed', { detail: { leadId } }));
  }
}

// ----------------------------------------------------------------------
// Phase O: Client Management Seed Data & Local Synchronizers
// ----------------------------------------------------------------------

const INITIAL_SAMPLE_CLIENTS: ClientRecord[] = [
  {
    id: 'client-seed-1',
    company_name: 'Apex Commercial Hub',
    contact_person: 'Fahad Al-Husseini',
    phone: '+966 54 892 1104',
    whatsapp: '+966 54 892 1104',
    email: 'fahad@apexcorp.sa',
    location: 'Riyadh, Business Gate',
    client_type: 'enterprise',
    source_lead_id: 'lead-3',
    owner_id: 'uid-joseph',
    owner_name: 'Joseph Varghese',
    status: 'Active',
    notes: 'Key commercial tower fitout project won after 3 rounds of commercial negotiation. Active delivery.',
    converted_by: 'uid-joseph',
    converted_by_name: 'Joseph Varghese',
    tags: ['VIP Client', 'Large Project'],
    converted_at: new Date(Date.now() - 3600000 * 24 * 14).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24 * 14).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
  {
    id: 'client-seed-2',
    company_name: 'Al-Madina Hospitality Group',
    contact_person: 'Tariq Mansoor',
    phone: '+966 50 412 8890',
    whatsapp: '+966 50 412 8890',
    email: 'tariq@madinahotels.com',
    location: 'Madinah, Central Zone',
    client_type: 'b2b',
    source_lead_id: 'lead-legacy-1',
    owner_id: 'uid-rashid',
    owner_name: 'Rashid Khan',
    status: 'Active',
    notes: 'Multi-property hotel supply agreement signed. 5-star hotel refurbishment project.',
    converted_by: 'uid-rashid',
    converted_by_name: 'Rashid Khan',
    tags: ['Repeat Customer'],
    converted_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  },
  {
    id: 'client-seed-3',
    company_name: 'Red Sea Development Partners',
    contact_person: 'Nasser Al-Ghamdi',
    phone: '+966 55 771 2345',
    whatsapp: '+966 55 771 2345',
    email: 'nasser@redseapartners.sa',
    location: 'Jeddah, Corniche Tower',
    client_type: 'enterprise',
    source_lead_id: 'lead-legacy-2',
    owner_id: 'uid-saud',
    owner_name: 'Saud Al-Otaibi',
    status: 'Inactive',
    notes: 'Phase 1 delivered successfully. Currently awaiting budget sign-off for Phase 2 infrastructure.',
    converted_by: 'uid-admin',
    converted_by_name: 'Mujahid Islam',
    tags: ['Glass Project'],
    converted_at: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
  },
];

let inMemoryClients: ClientRecord[] | null = null;

export function getLocalClients(): ClientRecord[] {
  if (typeof localStorage === 'undefined') {
    if (!inMemoryClients) inMemoryClients = [...INITIAL_SAMPLE_CLIENTS];
    return inMemoryClients;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CLIENTS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_CLIENTS_KEY, JSON.stringify(INITIAL_SAMPLE_CLIENTS));
      return INITIAL_SAMPLE_CLIENTS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SAMPLE_CLIENTS;
  }
}

function setLocalClients(clients: ClientRecord[]) {
  if (typeof localStorage === 'undefined') {
    inMemoryClients = [...clients];
    return;
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.warn('LocalStorage save failed for clients:', e);
  }
  notifyClientsChanged();
}

export function notifyClientsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_clients_changed'));
  }
}

export function notifyTransfersChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_transfers_changed'));
  }
}

let inMemoryClientTransfers: ClientTransferRecord[] = [];

export function getLocalClientTransfers(): ClientTransferRecord[] {
  if (typeof localStorage === 'undefined') return inMemoryClientTransfers;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CLIENT_TRANSFERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function setLocalClientTransfers(transfers: ClientTransferRecord[]) {
  if (typeof localStorage === 'undefined') {
    inMemoryClientTransfers = [...transfers];
    return;
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_CLIENT_TRANSFERS_KEY, JSON.stringify(transfers));
  } catch (e) {
    console.warn('LocalStorage save failed for client transfers:', e);
  }
  notifyTransfersChanged();
}

export function getLocalLeadTransfers(): LeadTransferRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LEAD_TRANSFERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function setLocalLeadTransfers(transfers: LeadTransferRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_LEAD_TRANSFERS_KEY, JSON.stringify(transfers));
  } catch (e) {
    console.warn('LocalStorage save failed for lead transfers:', e);
  }
  notifyTransfersChanged();
}

// ----------------------------------------------------------------------
// Phase R: Tags & Saved Segments Seed Data & Local Synchronizers
// ----------------------------------------------------------------------

const INITIAL_SAMPLE_TAGS: TagRecord[] = [
  {
    id: 'tag-hot-prospect',
    name: 'Hot Prospect',
    description: 'High-probability sales leads ready for closing',
    type: 'Lead',
    is_active: true,
    color: 'rose',
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
  },
  {
    id: 'tag-vip-client',
    name: 'VIP Client',
    description: 'Key executive accounts requiring priority service',
    type: 'Client',
    is_active: true,
    color: 'purple',
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 25).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 25).toISOString(),
  },
  {
    id: 'tag-repeat-customer',
    name: 'Repeat Customer',
    description: 'Accounts with recurring commercial purchase history',
    type: 'Client',
    is_active: true,
    color: 'emerald',
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 20).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 20).toISOString(),
  },
  {
    id: 'tag-large-project',
    name: 'Large Project',
    description: 'Contracts exceeding 25,000 OMR or multi-storey fitouts',
    type: 'Both',
    is_active: true,
    color: 'indigo',
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 18).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 18).toISOString(),
  },
  {
    id: 'tag-glass-project',
    name: 'Glass Project',
    description: 'Specialized architectural glazing, curtain walls, and glass partitions',
    type: 'Both',
    is_active: true,
    color: 'cyan',
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 15).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 15).toISOString(),
  },
  {
    id: 'tag-followup-required',
    name: 'Follow-up Required',
    description: 'Needs urgent sales rep outreach or quotation review',
    type: 'Both',
    is_active: true,
    color: 'amber',
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
  },
  {
    id: 'tag-high-value',
    name: 'High Value',
    description: 'High revenue potential prospect or major enterprise client',
    type: 'Both',
    is_active: true,
    color: 'emerald',
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 8).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 8).toISOString(),
  },
  {
    id: 'tag-local-customer',
    name: 'Local Customer',
    description: 'Muscat and capital area accounts for quick site dispatch',
    type: 'Both',
    is_active: true,
    color: 'slate',
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  },
];

export function getLocalTags(): TagRecord[] {
  if (typeof localStorage === 'undefined') return INITIAL_SAMPLE_TAGS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TAGS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_TAGS_KEY, JSON.stringify(INITIAL_SAMPLE_TAGS));
      return INITIAL_SAMPLE_TAGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SAMPLE_TAGS;
  }
}

export function setLocalTags(tags: TagRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_TAGS_KEY, JSON.stringify(tags));
  } catch (e) {
    console.warn('LocalStorage save failed for tags:', e);
  }
  notifyTagsChanged();
}

export function notifyTagsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_tags_changed'));
  }
}

const INITIAL_SAMPLE_SAVED_SEGMENTS: SavedSegmentRecord[] = [
  {
    id: 'seg-hot-leads',
    name: 'Hot & High Value Prospects',
    description: 'High priority leads with urgent pipeline focus and high revenue target',
    entity_type: 'Lead',
    filter_definition: {
      recordType: 'Lead',
      priorities: ['Hot'],
      tagMode: 'any',
      tags: ['Hot Prospect', 'High Value'],
    },
    is_active: true,
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 14).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 14).toISOString(),
  },
  {
    id: 'seg-vip-clients',
    name: 'VIP Key Accounts',
    description: 'Active enterprise clients marked with VIP or Repeat Customer status',
    entity_type: 'Client',
    filter_definition: {
      recordType: 'Client',
      clientStatuses: ['Active'],
      tagMode: 'any',
      tags: ['VIP Client', 'Repeat Customer'],
    },
    is_active: true,
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 12).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 12).toISOString(),
  },
  {
    id: 'seg-large-glass-projects',
    name: 'Large Glass Fitouts',
    description: 'Both Leads and Clients associated with architectural glass and large scale fitouts',
    entity_type: 'Both',
    filter_definition: {
      recordType: 'Both',
      tagMode: 'any',
      tags: ['Large Project', 'Glass Project'],
    },
    is_active: true,
    created_by: 'uid-mujahid',
    created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
  },
];

export function getLocalSavedSegments(): SavedSegmentRecord[] {
  if (typeof localStorage === 'undefined') return INITIAL_SAMPLE_SAVED_SEGMENTS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SAVED_SEGMENTS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_SAVED_SEGMENTS_KEY, JSON.stringify(INITIAL_SAMPLE_SAVED_SEGMENTS));
      return INITIAL_SAMPLE_SAVED_SEGMENTS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SAMPLE_SAVED_SEGMENTS;
  }
}

export function setLocalSavedSegments(segments: SavedSegmentRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_SAVED_SEGMENTS_KEY, JSON.stringify(segments));
  } catch (e) {
    console.warn('LocalStorage save failed for saved segments:', e);
  }
  notifySavedSegmentsChanged();
}

export function notifySavedSegmentsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_saved_segments_changed'));
  }
}

const INITIAL_SAMPLE_ATTACHMENTS: AttachmentRecord[] = [
  {
    id: 'att-seed-1',
    lead_id: 'lead-1',
    file_name: 'Tower_HVAC_Quotation_Rev3.pdf',
    storage_path: 'leads/lead-1/attachments/att-seed-1/Tower_HVAC_Quotation_Rev3.pdf',
    file_type: 'application/pdf',
    file_size: 2450000,
    uploaded_by: 'uid-rashid',
    uploaded_by_name: 'Rashid Khan',
    uploaded_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    category: 'Quotation',
    description: 'Final commercial quotation including 5% milestone discount on HVAC chillers.',
    download_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  },
  {
    id: 'att-seed-2',
    lead_id: 'lead-1',
    file_name: 'Al_Noor_Floor_Layout_CAD_v2.dwg',
    storage_path: 'leads/lead-1/attachments/att-seed-2/Al_Noor_Floor_Layout_CAD_v2.dwg',
    file_type: 'application/acad',
    file_size: 8900000,
    uploaded_by: 'uid-rashid',
    uploaded_by_name: 'Rashid Khan',
    uploaded_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    category: 'Drawing',
    description: 'Architectural structural drawings for floors 12-24.',
    download_url: '',
  },
  {
    id: 'att-seed-3',
    lead_id: 'lead-2',
    file_name: 'Gulf_BOQ_Material_Costing.xlsx',
    storage_path: 'leads/lead-2/attachments/att-seed-3/Gulf_BOQ_Material_Costing.xlsx',
    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    file_size: 1150000,
    uploaded_by: 'uid-saud',
    uploaded_by_name: 'Saud Al-Otaibi',
    uploaded_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    category: 'BOQ',
    description: 'Bill of quantities for marble and electrical installations.',
    download_url: '',
  },
  {
    id: 'att-seed-4',
    lead_id: 'lead-2',
    file_name: 'Site_Inspection_Photo_East_Wing.jpg',
    storage_path: 'leads/lead-2/attachments/att-seed-4/Site_Inspection_Photo_East_Wing.jpg',
    file_type: 'image/jpeg',
    file_size: 3400000,
    uploaded_by: 'uid-saud',
    uploaded_by_name: 'Saud Al-Otaibi',
    uploaded_at: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
    category: 'Image',
    description: 'Site inspection progress picture showing structural concrete curing.',
    download_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'att-seed-5',
    lead_id: 'lead-3',
    file_name: 'Master_Supply_Agreement_Draft.pdf',
    storage_path: 'leads/lead-3/attachments/att-seed-5/Master_Supply_Agreement_Draft.pdf',
    file_type: 'application/pdf',
    file_size: 1850000,
    uploaded_by: 'uid-admin',
    uploaded_by_name: 'Mujahid Islam',
    uploaded_at: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    category: 'Contract',
    description: 'Draft master supply terms approved by legal.',
    download_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  },
];

function getLocalAttachments(): AttachmentRecord[] {
  if (typeof localStorage === 'undefined') return INITIAL_SAMPLE_ATTACHMENTS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ATTACHMENTS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_ATTACHMENTS_KEY, JSON.stringify(INITIAL_SAMPLE_ATTACHMENTS));
      return INITIAL_SAMPLE_ATTACHMENTS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SAMPLE_ATTACHMENTS;
  }
}

function setLocalAttachments(att: AttachmentRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_ATTACHMENTS_KEY, JSON.stringify(att));
  } catch (e) {
    console.warn('LocalStorage save failed for attachments:', e);
  }
}

export function notifyAttachmentsChanged(leadId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_attachments_changed', { detail: { leadId } }));
  }
}

// ----------------------------------------------------------------------
// Notification Seed Data & Local Synchronizers
// ----------------------------------------------------------------------

const INITIAL_SAMPLE_NOTIFICATIONS: NotificationRecord[] = [
  {
    id: 'notif-seed-1',
    recipient_id: 'uid-rashid',
    recipient_name: 'Rashid Khan',
    type: 'followup_due_today',
    title: 'Follow-up Due Today',
    message: 'Scheduled follow-up call with Al Noor Tower Contracting.',
    lead_id: 'lead-1',
    lead_company_name: 'Al Noor Tower Contracting',
    follow_up_id: 'fu-seed-1',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    event_key: 'reminder_due_fu-seed-1_seed',
  },
  {
    id: 'notif-seed-2',
    recipient_id: 'uid-rashid',
    recipient_name: 'Rashid Khan',
    type: 'lead_assigned',
    title: 'New Lead Assigned',
    message: 'Al Noor Tower Contracting was assigned to you by Admin.',
    lead_id: 'lead-1',
    lead_company_name: 'Al Noor Tower Contracting',
    is_read: true,
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    event_key: 'lead_assign_lead-1_uid-rashid_seed',
  },
  {
    id: 'notif-seed-3',
    recipient_id: 'uid-saud',
    recipient_name: 'Saud Al-Otaibi',
    type: 'followup_due_today',
    title: 'Follow-up Due Today',
    message: 'Quotation review meeting with Gulf Marble & Granite.',
    lead_id: 'lead-2',
    lead_company_name: 'Gulf Marble & Granite',
    follow_up_id: 'fu-seed-2',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    event_key: 'reminder_due_fu-seed-2_seed',
  },
  {
    id: 'notif-seed-4',
    recipient_id: 'uid-admin',
    recipient_name: 'Mujahid Islam',
    type: 'followup_completed',
    title: 'Follow-up Completed',
    message: 'Rashid Khan completed follow-up with Al Noor Tower Contracting: "Sent revised quotation".',
    lead_id: 'lead-1',
    lead_company_name: 'Al Noor Tower Contracting',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    event_key: 'followup_comp_fu-seed-1_seed',
  },
  {
    id: 'notif-seed-5',
    recipient_id: 'uid-admin',
    recipient_name: 'Mujahid Islam',
    type: 'lead_assigned',
    title: 'Lead Assignment Notice',
    message: 'Al Noor Tower Contracting was assigned to Rashid Khan.',
    lead_id: 'lead-1',
    lead_company_name: 'Al Noor Tower Contracting',
    is_read: true,
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    event_key: 'lead_assign_lead-1_admin_seed',
  },
  {
    id: 'notif-seed-6',
    recipient_id: 'uid-joseph',
    recipient_name: 'Joseph Varghese',
    type: 'upcoming_followup',
    title: 'Upcoming Follow-up',
    message: 'Payment collection follow-up scheduled with Apex Commercial Hub.',
    lead_id: 'lead-3',
    lead_company_name: 'Apex Commercial Hub',
    follow_up_id: 'fu-seed-3',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    event_key: 'reminder_upcoming_fu-seed-3_seed',
  }
];

function getLocalNotifications(): NotificationRecord[] {
  if (typeof localStorage === 'undefined') return INITIAL_SAMPLE_NOTIFICATIONS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTIFICATIONS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_NOTIFICATIONS_KEY, JSON.stringify(INITIAL_SAMPLE_NOTIFICATIONS));
      return INITIAL_SAMPLE_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SAMPLE_NOTIFICATIONS;
  }
}

function setLocalNotifications(list: NotificationRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_NOTIFICATIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('LocalStorage save failed for notifications:', e);
  }
}

export function notifyNotificationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_notifications_changed'));
  }
}

let inMemorySession: any = null;

export function setEffectiveSession(session: {
  userId?: string;
  userName?: string;
  userRole?: UserRole;
  companyId?: string;
  email?: string;
}) {
  inMemorySession = {
    id: session.userId,
    uid: session.userId,
    name: session.userName,
    full_name: session.userName,
    role: session.userRole,
    company_id: session.companyId,
    email: session.email,
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(inMemorySession));
    } catch (e) {}
  }
}

export function clearEffectiveSession() {
  inMemorySession = null;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    } catch (e) {}
  }
}

// Helper to get current authenticated user ID with fallbacks
export function getEffectiveUserId(): string {
  if (inMemorySession?.id || inMemorySession?.uid) {
    return inMemorySession.id || inMemorySession.uid;
  }
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const cachedSessionStr = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (cachedSessionStr) {
        const cached = JSON.parse(cachedSessionStr);
        if (cached && (cached.id || cached.uid)) {
          return cached.id || cached.uid;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return 'uid-admin';
}

export function requireAuthUserId(): string {
  return getEffectiveUserId();
}

export function getEffectiveUserName(): string {
  if (inMemorySession?.name || inMemorySession?.full_name) {
    return inMemorySession.name || inMemorySession.full_name;
  }
  if (auth.currentUser?.displayName) {
    return auth.currentUser.displayName;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const cachedSessionStr = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (cachedSessionStr) {
        const cached = JSON.parse(cachedSessionStr);
        if (cached && (cached.name || cached.full_name)) {
          return cached.name || cached.full_name;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  const uid = getEffectiveUserId();
  return getUserDisplayName(uid);
}

export function normalizeUserRole(rawRole?: any, email?: string): UserRole | null {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail === 'itsyourmujahid@gmail.com') {
    return 'SUPER_ADMIN';
  }
  if (!rawRole) return null;
  const str = String(rawRole).trim().toUpperCase();
  if (str === 'SUPER_ADMIN' || str === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (str === 'ADMIN' || str === 'COMPANY_ADMIN') return 'ADMIN';
  if (str === 'SALESMAN' || str === 'SALES_REP' || str === 'SALES') return 'SALESMAN';
  if (str === 'CUSTOMER' || str === 'CLIENT') return 'CUSTOMER';
  return null;
}

export function getEffectiveUserRole(): UserRole {
  if (inMemorySession?.role || inMemorySession?.email) {
    const norm = normalizeUserRole(inMemorySession.role, inMemorySession.email);
    if (norm) return norm;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const cachedSessionStr = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (cachedSessionStr) {
        const cached = JSON.parse(cachedSessionStr);
        if (cached && (cached.role || cached.email)) {
          const norm = normalizeUserRole(cached.role, cached.email);
          if (norm) return norm;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  if (auth.currentUser?.email?.toLowerCase() === 'itsyourmujahid@gmail.com') {
    return 'SUPER_ADMIN';
  }
  // If no authenticated or valid role exists, do NOT default to SALESMAN
  return 'UNASSIGNED' as UserRole;
}

export function isEffectiveSuperAdmin(): boolean {
  if (inMemorySession?.role === 'SUPER_ADMIN' || inMemorySession?.email?.toLowerCase() === 'itsyourmujahid@gmail.com') {
    return true;
  }
  if (auth.currentUser?.email?.toLowerCase() === 'itsyourmujahid@gmail.com') return true;
  return getEffectiveUserRole() === 'SUPER_ADMIN';
}

export function isUserAdminOrSuper(role?: UserRole | string | null): boolean {
  if (isEffectiveSuperAdmin()) return true;
  const upper = String(role || getEffectiveUserRole()).toUpperCase();
  return upper === 'ADMIN' || upper === 'SUPER_ADMIN';
}

export function getEffectiveCompanyId(): string {
  if (inMemorySession?.company_id) {
    return inMemorySession.company_id;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const cachedSessionStr = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (cachedSessionStr) {
        const cached = JSON.parse(cachedSessionStr);
        if (cached && cached.company_id) {
          return cached.company_id;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return DEFAULT_COMPANY_ID;
}

// ==========================================
// 1. User Profiles & Team Management API
// ==========================================

export async function findUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Check local storage first (instant & authoritative for onboarded tenants)
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (raw) {
        const users: UserProfile[] = JSON.parse(raw);
        const match = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
        if (match) {
          const normRole = normalizeUserRole(match.role, match.email);
          return {
            ...match,
            role: (normRole || match.role) as UserRole,
          };
        }
      }
    } catch (e) {}
  }

  // 2. Check Firestore users collection by email
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      const normRole = normalizeUserRole(data.role, data.email);
      return {
        id: docSnap.id,
        ...data,
        role: (normRole || data.role) as UserRole,
        company_id: data.company_id,
        is_active: data.is_active !== false,
      } as UserProfile;
    }
  } catch (e) {
    console.warn('Firestore findUserProfileByEmail query notice:', e);
  }

  // 3. Check PREDEFINED_ACCOUNTS
  const predefined = PREDEFINED_ACCOUNTS.find((a) => a.email.toLowerCase() === cleanEmail);
  if (predefined) {
    return {
      id: `uid-${predefined.name.toLowerCase()}`,
      full_name: predefined.name,
      email: predefined.email,
      role: predefined.role,
      company_id: predefined.company_id,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
  }

  // 4. Check if this email is the contact_email of a registered company
  try {
    const companies = await getCompanies();
    const matchingCompany = companies.find(
      (c) => c.contact_email && c.contact_email.toLowerCase() === cleanEmail
    );
    if (matchingCompany) {
      // This user was designated as the initial Company Admin during onboarding!
      return {
        id: `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        full_name: matchingCompany.admin_name || matchingCompany.contact_person || `${matchingCompany.name} Admin`,
        email: cleanEmail,
        role: 'ADMIN',
        company_id: matchingCompany.id,
        is_active: matchingCompany.status !== 'INACTIVE',
        created_at: matchingCompany.created_at,
        updated_at: matchingCompany.updated_at,
      };
    }
  } catch (e) {}

  return null;
}

export async function repairCompanyAdminAccounts(): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  try {
    const companies = await getCompanies();
    const rawUsers = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    let users: UserProfile[] = rawUsers ? JSON.parse(rawUsers) : [];
    let modified = false;

    for (const company of companies) {
      const contactEmail = company.contact_email?.trim().toLowerCase();
      if (!contactEmail) continue;

      const userIndex = users.findIndex((u) => u.email.toLowerCase() === contactEmail);
      if (userIndex >= 0) {
        const user = users[userIndex];
        if (user.role !== 'ADMIN' || user.company_id !== company.id) {
          console.info(`[ZaynOps Repair] Restoring Company Admin role for ${user.email} in company ${company.name}`);
          users[userIndex] = {
            ...user,
            role: 'ADMIN',
            company_id: company.id,
            is_active: true,
            updated_at: new Date().toISOString(),
          };
          modified = true;

          try {
            const userRef = doc(db, 'users', user.id);
            await setDoc(userRef, { role: 'ADMIN', company_id: company.id }, { merge: true });
          } catch (e) {}
        }
      } else {
        const newAdmin: UserProfile = {
          id: `usr_${contactEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          full_name: company.admin_name || company.contact_person || `${company.name} Admin`,
          email: contactEmail,
          role: 'ADMIN',
          company_id: company.id,
          is_active: true,
          created_at: company.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        users.push(newAdmin);
        modified = true;
      }
    }

    if (modified) {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
      const sessionRaw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (sessionRaw) {
        try {
          const session = JSON.parse(sessionRaw);
          const repaired = users.find((u) => u.email.toLowerCase() === session.email?.toLowerCase());
          if (repaired && repaired.role === 'ADMIN' && session.role !== 'ADMIN') {
            session.role = 'ADMIN';
            session.company_id = repaired.company_id;
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[ZaynOps Repair] repairCompanyAdminAccounts warning:', err);
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  // 1. Direct lookup by document ID in Firestore
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const normRole = normalizeUserRole(data.role, data.email);
      const isSuper = normRole === 'SUPER_ADMIN' || data.email?.toLowerCase() === 'itsyourmujahid@gmail.com' || userId === 'uid-mujahid';
      const resolvedRole: UserRole = isSuper ? 'SUPER_ADMIN' : (normRole || (data.role as UserRole));
      return {
        id: snap.id,
        ...data,
        role: resolvedRole,
        company_id: data.company_id || (isSuper ? undefined : DEFAULT_COMPANY_ID),
        is_active: data.is_active !== false,
      } as UserProfile;
    }
  } catch (err) {
    console.warn('Firestore getUserProfile fallback to local store:', err);
  }

  // 2. Fallback to local storage (by id or by email)
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (raw) {
        const users: UserProfile[] = JSON.parse(raw);
        const found = users.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
        if (found) {
          const normRole = normalizeUserRole(found.role, found.email);
          const isSuper = normRole === 'SUPER_ADMIN' || found.email?.toLowerCase() === 'itsyourmujahid@gmail.com' || userId === 'uid-mujahid';
          const resolvedRole: UserRole = isSuper ? 'SUPER_ADMIN' : (normRole || found.role);
          return {
            ...found,
            role: resolvedRole,
            company_id: found.company_id || (isSuper ? undefined : DEFAULT_COMPANY_ID),
          };
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Fallback to finding by email if userId could be an email
  if (userId.includes('@')) {
    return await findUserProfileByEmail(userId);
  }

  return null;
}

export async function createOrUpdateUserProfile(
  userId: string,
  data: Partial<UserProfile>
): Promise<UserProfile> {
  const now = new Date().toISOString();

  // Find existing profile first to prevent downgrading an existing ADMIN
  let existingProfile: UserProfile | null = null;
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (raw) {
        const localUsers: UserProfile[] = JSON.parse(raw);
        existingProfile = localUsers.find(
          (u) => u.id === userId || (data.email && u.email.toLowerCase() === data.email.toLowerCase())
        ) || null;
      }
    } catch (e) {}
  }

  const incomingRole = normalizeUserRole(data.role, data.email);
  let roleToSet: UserRole;

  if (incomingRole) {
    roleToSet = incomingRole;
  } else if (existingProfile?.role) {
    roleToSet = existingProfile.role;
  } else if (data.email?.toLowerCase() === 'itsyourmujahid@gmail.com') {
    roleToSet = 'SUPER_ADMIN';
  } else {
    // If no role provided or recognized, preserve or throw/mark unassigned
    roleToSet = (data.role as UserRole) || ('UNASSIGNED' as UserRole);
  }

  // Crucial protection: If existing user is ADMIN and an update lacks an explicit role or attempts demotion without cause, preserve ADMIN!
  if (existingProfile?.role === 'ADMIN' && roleToSet !== 'ADMIN' && !data.role) {
    roleToSet = 'ADMIN';
  }

  const userProfile: UserProfile = {
    id: userId,
    full_name: data.full_name || existingProfile?.full_name || 'CRM User',
    email: data.email || existingProfile?.email || '',
    avatar_url: data.avatar_url || existingProfile?.avatar_url || '',
    role: roleToSet,
    company_id: data.company_id !== undefined ? data.company_id : existingProfile?.company_id,
    is_active: data.is_active !== undefined ? data.is_active : (existingProfile?.is_active !== undefined ? existingProfile.is_active : true),
    created_at: existingProfile?.created_at || now,
    updated_at: now,
    ...(data.permissions ? { permissions: data.permissions } : existingProfile?.permissions ? { permissions: existingProfile.permissions } : {}),
  };

  // Local storage save
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      let users: UserProfile[] = raw ? JSON.parse(raw) : [];
      const idx = users.findIndex((u) => u.id === userId || (data.email && u.email.toLowerCase() === data.email.toLowerCase()));
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...userProfile, id: userId, updated_at: now };
      } else {
        users.push(userProfile);
      }
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      // ignore
    }
  }

  // Firestore async attempt
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, userProfile, { merge: true });
  } catch (err) {
    console.warn('Firestore createOrUpdateUserProfile local fallback:', err);
  }

  return userProfile;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const usersMap = new Map<string, UserProfile>();

  // 1. Seed predefined accounts
  PREDEFINED_ACCOUNTS.forEach((account) => {
    const slugId = `uid-${account.name.toLowerCase()}`;
    usersMap.set(slugId, {
      id: slugId,
      full_name: account.name,
      email: account.email,
      role: account.role,
      company_id: account.company_id,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
  });

  // 2. Merge local storage users
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (raw) {
        const localUsers: UserProfile[] = JSON.parse(raw);
        localUsers.forEach((u) => {
          const norm = normalizeUserRole(u.role, u.email);
          const cleanedUser = {
            ...u,
            role: (norm || u.role) as UserRole,
          };
          usersMap.set(u.id, cleanedUser);
          for (const [key, existing] of usersMap.entries()) {
            if (existing.email.toLowerCase() === u.email.toLowerCase() && key !== u.id) {
              usersMap.set(key, cleanedUser);
            }
          }
        });
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Merge Firestore users
  try {
    const usersRef = collection(db, 'users');
    const snap = await getDocs(usersRef);
    if (!snap.empty) {
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const norm = normalizeUserRole(data.role, data.email);
        const isSuper = norm === 'SUPER_ADMIN' || data.email?.toLowerCase() === 'itsyourmujahid@gmail.com' || docSnap.id === 'uid-mujahid';
        const role = norm || (data.role as UserRole);
        const profile: UserProfile = {
          id: docSnap.id,
          ...data,
          role: role,
          company_id: data.company_id || (isSuper ? undefined : DEFAULT_COMPANY_ID),
          is_active: data.is_active !== false,
        } as UserProfile;
        usersMap.set(docSnap.id, profile);
      });
    }
  } catch (e) {
    console.warn('Firestore getAllUsers fallback to local/predefined cache:', e);
  }

  return Array.from(usersMap.values());
}

export async function getActiveSalesmen(userList?: UserProfile[]): Promise<UserProfile[]> {
  const all = userList && userList.length > 0 ? userList : await getAllUsers();
  return all.filter((u) => u.is_active && (u.role === 'SALESMAN' || u.role === 'sales_rep'));
}

export function filterActiveSalesmen(userList: UserProfile[]): UserProfile[] {
  return userList.filter((u) => u.is_active && (u.role === 'SALESMAN' || u.role === 'sales_rep'));
}

export function getUserDisplayName(userId: string, userList?: UserProfile[]): string {
  if (!userId) return 'Unassigned';

  // Check in userList if provided
  if (userList && userList.length > 0) {
    const match = userList.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
    if (match) return match.full_name || match.email.split('@')[0];
  }

  // Check predefined
  const pre = PREDEFINED_ACCOUNTS.find(
    (p) =>
      `uid-${p.name.toLowerCase()}` === userId ||
      p.name.toLowerCase() === userId.toLowerCase() ||
      p.email.toLowerCase() === userId.toLowerCase()
  );
  if (pre) return pre.name;

  if (userId.startsWith('uid-')) {
    const name = userId.replace('uid-', '');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return userId.length > 12 ? userId.substring(0, 8) + '...' : userId;
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<void> {
  let targetUser: UserProfile | undefined;
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (raw) {
        let users: UserProfile[] = JSON.parse(raw);
        targetUser = users.find((u) => u.id === userId);
        users = users.map((u) => (u.id === userId ? { ...u, is_active: isActive } : u));
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      is_active: isActive,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Firestore updateUserStatus fallback:', e);
  }

  // Phase M: Administrative Audit Log
  try {
    const adminId = getEffectiveUserId();
    const adminName = getEffectiveUserName();
    const userName = targetUser?.full_name || getUserDisplayName(userId);
    await createAuditLog({
      action: isActive ? 'user_activated' : 'user_deactivated',
      entity_type: 'User',
      entity_id: userId,
      target_user_id: userId,
      target_user_name: userName,
      performed_by: adminId,
      performed_by_name: adminName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${adminName} ${isActive ? 'activated' : 'deactivated'} access account for user "${userName}".`,
      metadata: {
        previous_status: !isActive ? 'Active' : 'Inactive',
        new_status: isActive ? 'Active' : 'Inactive',
        target_email: targetUser?.email || '',
      },
    });
  } catch (auditErr) {
    console.warn('updateUserStatus audit log notice:', auditErr);
  }
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const safeRole = role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'SALESMAN';
  let targetUser: UserProfile | undefined;
  let prevRole: string = 'SALESMAN';

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (raw) {
        let users: UserProfile[] = JSON.parse(raw);
        targetUser = users.find((u) => u.id === userId);
        prevRole = targetUser?.role || 'SALESMAN';
        users = users.map((u) => (u.id === userId ? { ...u, role: safeRole } : u));
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: safeRole,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Firestore updateUserRole fallback:', e);
  }

  // Phase M: Administrative Audit Log
  try {
    const adminId = getEffectiveUserId();
    const adminName = getEffectiveUserName();
    const userName = targetUser?.full_name || getUserDisplayName(userId);
    await createAuditLog({
      action: 'user_role_changed',
      entity_type: 'User',
      entity_id: userId,
      target_user_id: userId,
      target_user_name: userName,
      performed_by: adminId,
      performed_by_name: adminName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${adminName} modified role for user "${userName}" from ${prevRole} to ${safeRole}.`,
      metadata: {
        previous_role: prevRole,
        new_role: safeRole,
        target_email: targetUser?.email || '',
      },
    });
  } catch (auditErr) {
    console.warn('updateUserRole audit log notice:', auditErr);
  }
}

// ==========================================
// 2. Leads Data Access Layer with Dual Engine
// ==========================================

export async function createLead(
  input: CreateLeadInput,
  currentUserRole?: UserRole
): Promise<LeadRecord> {
  const userId = getEffectiveUserId();

  if (!input.company_name || input.company_name.trim() === '') {
    throw new Error('Validation Error: company_name is required.');
  }

  const now = new Date().toISOString();
  const isUserAdmin = isUserAdminOrSuper(currentUserRole);
  const assignedTo = isUserAdmin && input.assigned_to ? input.assigned_to : userId;

  const generatedId = 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  const newLeadData: LeadRecord = {
    id: generatedId,
    company_name: input.company_name.trim(),
    contact_person: input.contact_person || '',
    phone: input.phone || '',
    whatsapp: input.whatsapp || '',
    email: input.email || '',
    lead_type: input.lead_type || 'b2b',
    location: input.location || '',
    source: input.source || 'direct',
    priority: input.priority || 'Warm',
    status: input.status || 'New',
    notes: input.notes || '',
    next_action: input.next_action || '',
    next_followup_date: input.next_followup_date || '',
    estimated_value: input.estimated_value || 0,
    project_name: input.project_name || '',
    project_type: input.project_type || '',
    project_location: input.project_location || '',
    requirement: input.requirement || '',
    expected_closing_date: input.expected_closing_date || '',
    final_value: input.final_value || 0,
    closing_date: input.closing_date || '',
    lost_reason: input.lost_reason || '',
    created_by: userId,
    assigned_to: assignedTo,
    company_id: input.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID,
    source_client_id: input.source_client_id || input.client_id || undefined,
    client_id: input.client_id || input.source_client_id || undefined,
    converted_to_client_id: input.converted_to_client_id || undefined,
    record_status: 'active',
    normalized_phone: normalizePhone(input.phone),
    normalized_whatsapp: normalizePhone(input.whatsapp),
    normalized_email: normalizeEmail(input.email),
    normalized_company_name: normalizeCompanyName(input.company_name),
    created_at: now,
    updated_at: now,
  };

  // Immediate save to local cache
  const localList = getLocalLeads();
  localList.unshift(newLeadData);
  setLocalLeads(localList);
  notifyLeadsChanged();

  // Async sync to Firestore
  try {
    const leadsCollectionRef = collection(db, 'leads');
    const { id, ...dataToSync } = newLeadData;
    const docRef = await addDoc(leadsCollectionRef, dataToSync);
    if (docRef.id) {
      newLeadData.id = docRef.id;
      // Update local item with Firestore ID
      const updatedLocal = getLocalLeads().map((l) => (l.id === generatedId ? newLeadData : l));
      setLocalLeads(updatedLocal);
      notifyLeadsChanged();
    }
  } catch (err) {
    console.warn('Firestore createLead background sync notice:', err);
  }

  // Create initial Lead Created System Activity
  try {
    await createActivity({
      lead_id: newLeadData.id,
      activity_type: 'Lead Created',
      description: 'Lead account created in CRM database',
      notes: `Account registered for ${newLeadData.company_name}. Initial stage: ${newLeadData.status}, Priority: ${newLeadData.priority}.`,
      performed_by: userId,
      performed_by_name: getUserDisplayName(userId),
      activity_date: now,
      activity_at: now,
      is_system_activity: true,
      new_value: newLeadData.status,
    });
  } catch (e) {
    console.warn('Initial activity log notice:', e);
  }

  // Trigger Lead Assigned Notification if assigned to someone
  if (newLeadData.assigned_to) {
    try {
      await createNotification({
        recipient_id: newLeadData.assigned_to,
        recipient_name: getUserDisplayName(newLeadData.assigned_to),
        type: 'lead_assigned',
        title: 'New Lead Assigned',
        message: `${newLeadData.company_name} has been assigned to you.`,
        lead_id: newLeadData.id,
        lead_company_name: newLeadData.company_name,
        event_key: `lead_assign_${newLeadData.id}_${newLeadData.assigned_to}`,
      });
    } catch (nErr) {
      console.warn('Lead assignment notification notice:', nErr);
    }
  }

  return newLeadData;
}

export async function getLeadById(leadId: string, userRole?: UserRole): Promise<LeadRecord | null> {
  const localList = getLocalLeads();
  const local = localList.find((l) => l.id === leadId);
  const userId = getEffectiveUserId();
  const role = userRole || getEffectiveUserRole();

  // Security Policy Check: Non-admins cannot access leads not created by or assigned to them
  if (local && role !== 'ADMIN' && local.assigned_to !== userId && local.created_by !== userId) {
    try {
      await recordSecurityAuditLog({
        action: 'security_unauthorized_lead_access',
        entity_type: 'Security',
        entity_id: leadId,
        description: `Security Notice: Sales representative ${getEffectiveUserName()} (${userId}) attempted direct access to unassigned Lead "${local.company_name}" (${leadId}).`,
        metadata: {
          attempted_lead_id: leadId,
          lead_company_name: local.company_name,
          assigned_to: local.assigned_to,
          action: 'getLeadById',
          status: 'BLOCKED',
        },
      });
    } catch (e) {
      // non-blocking
    }
    return null;
  }

  try {
    const docRef = doc(db, 'leads', leadId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const fsLead = { id: snap.id, ...snap.data() } as LeadRecord;
      // Update local cache with fresh data
      const updated = localList.map((l) => (l.id === leadId ? fsLead : l));
      if (!local) updated.unshift(fsLead);
      setLocalLeads(updated);
      return fsLead;
    }
  } catch (e) {
    console.warn('getLeadById Firestore fetch fallback:', e);
  }

  return local || null;
}

/**
 * Real-time subscription to a single lead with instant local cache push
 */
export function subscribeToSingleLead(
  leadId: string,
  onUpdate: (lead: LeadRecord | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // Push local version immediately
  const localList = getLocalLeads();
  const found = localList.find((l) => l.id === leadId) || null;
  onUpdate(found);

  const handleLeadsChanged = () => {
    const freshLocal = getLocalLeads().find((l) => l.id === leadId) || null;
    onUpdate(freshLocal);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_leads_changed', handleLeadsChanged);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const leadDocRef = doc(db, 'leads', leadId);
    firestoreUnsub = onSnapshot(
      leadDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const lead = { id: docSnap.id, ...docSnap.data() } as LeadRecord;
          // Sync with local cache
          const currentLocal = getLocalLeads();
          const exists = currentLocal.some((l) => l.id === lead.id);
          const updated = exists
            ? currentLocal.map((l) => (l.id === lead.id ? lead : l))
            : [lead, ...currentLocal];
          setLocalLeads(updated);
          onUpdate(lead);
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        console.warn('Firestore subscribeToSingleLead fallback notice:', err);
        const freshLocal = getLocalLeads().find((l) => l.id === leadId) || null;
        onUpdate(freshLocal);
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore single lead onSnapshot:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_leads_changed', handleLeadsChanged);
    }
  };
}

export async function getLeads(options?: {
  status?: string;
  priority?: string;
  assigned_to?: string;
  userRole?: UserRole;
  limitCount?: number;
  includeMerged?: boolean;
  companyId?: string;
}): Promise<LeadRecord[]> {
  const userId = getEffectiveUserId();
  const currentRole = options?.userRole || getEffectiveUserRole();
  const isSuper = currentRole === 'SUPER_ADMIN';
  const isUserAdmin = isSuper || currentRole.toUpperCase() === 'ADMIN';
  const effectiveCompany = options?.companyId || getEffectiveCompanyId();

  let local = getLocalLeads();

  // Multi-tenant company isolation
  if (!isSuper || options?.companyId) {
    local = local.filter((l) => (l.company_id || DEFAULT_COMPANY_ID) === effectiveCompany);
  }

  if (!options?.includeMerged) {
    local = local.filter((l) => l.record_status !== 'merged');
  }
  if (!isUserAdmin) {
    local = local.filter((l) => l.assigned_to === userId || l.created_by === userId);
  } else if (options?.assigned_to) {
    local = local.filter((l) => l.assigned_to === options.assigned_to);
  }
  if (options?.status) {
    local = local.filter((l) => l.status.toLowerCase() === options.status?.toLowerCase());
  }
  if (options?.priority) {
    local = local.filter((l) => l.priority.toLowerCase() === options.priority?.toLowerCase());
  }
  if (options?.limitCount) {
    local = local.slice(0, options.limitCount);
  }
  return local;
}

/**
 * Subscribes to real-time updates for leads with role-based scoping and instant local feedback
 */
export function subscribeToLeads(
  onUpdate: (leads: LeadRecord[]) => void,
  userRole?: UserRole,
  onError?: (error: Error) => void,
  targetUserId?: string,
  includeMerged: boolean = false,
  companyIdOverride?: string
): Unsubscribe {
  const userId = targetUserId || getEffectiveUserId();
  const currentRole = userRole || getEffectiveUserRole();
  const isSuper = currentRole === 'SUPER_ADMIN';
  const isUserAdmin = isSuper || currentRole.toUpperCase() === 'ADMIN';
  const effectiveCompany = companyIdOverride || getEffectiveCompanyId();

  const filterAndEmit = (rawList: LeadRecord[]) => {
    let filtered = rawList;

    // Multi-tenant company isolation filter
    if (!isSuper || companyIdOverride) {
      filtered = filtered.filter((l) => (l.company_id || DEFAULT_COMPANY_ID) === effectiveCompany);
    }

    if (!includeMerged) {
      filtered = filtered.filter((l) => l.record_status !== 'merged');
    }
    if (!isUserAdmin) {
      filtered = filtered.filter(
        (l) => l.assigned_to === userId || l.created_by === userId
      );
    }
    onUpdate(filtered);
  };

  // Immediate push from local storage
  filterAndEmit(getLocalLeads());

  const handleCustomEvent = () => {
    filterAndEmit(getLocalLeads());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_leads_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const leadsRef = collection(db, 'leads');
    let q;
    if (!isUserAdmin) {
      q = query(leadsRef, where('assigned_to', '==', userId));
    } else if (!isSuper && effectiveCompany) {
      q = query(leadsRef, where('company_id', '==', effectiveCompany));
    } else {
      q = query(leadsRef);
    }

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsLeads: LeadRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsLeads.push({ id: docSnap.id, ...docSnap.data() } as LeadRecord);
        });

        // Merge Firestore results with local leads
        const map = new Map<string, LeadRecord>();
        const localList = getLocalLeads();
        localList.forEach((l) => map.set(l.id, l));
        fsLeads.forEach((l) => map.set(l.id, l));

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setLocalLeads(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore subscription fallback to local cache:', err);
        filterAndEmit(getLocalLeads());
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('Could not establish Firestore onSnapshot:', err);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_leads_changed', handleCustomEvent);
    }
  };
}

export async function updateLead(leadId: string, input: UpdateLeadInput): Promise<void> {
  const now = new Date().toISOString();
  const updatePayload: any = {
    ...input,
    updated_at: now,
  };

  if (input.phone !== undefined) {
    updatePayload.normalized_phone = normalizePhone(input.phone);
  }
  if (input.whatsapp !== undefined) {
    updatePayload.normalized_whatsapp = normalizePhone(input.whatsapp);
  }
  if (input.email !== undefined) {
    updatePayload.normalized_email = normalizeEmail(input.email);
  }
  if (input.company_name !== undefined) {
    updatePayload.normalized_company_name = normalizeCompanyName(input.company_name);
  }

  // Update local cache
  const localList = getLocalLeads();
  const updated = localList.map((l) => (l.id === leadId ? { ...l, ...updatePayload } : l));
  setLocalLeads(updated);
  notifyLeadsChanged();

  // Update Firestore async
  try {
    const docRef = doc(db, 'leads', leadId);
    await updateDoc(docRef, updatePayload);
  } catch (err) {
    console.warn('Firestore updateLead fallback notice:', err);
  }
}

export function notifyActivitiesChanged(leadId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_activities_changed', { detail: { leadId } }));
  }
}

export async function transferLead(input: TransferLeadInput): Promise<void> {
  return reassignLead(
    input.lead_id,
    input.new_owner || input.new_owner_id || '',
    input.new_owner_name || 'New Representative',
    input.previous_owner_name || 'Previous Representative',
    input.reason
  );
}

export async function reassignLead(
  leadId: string,
  newOwnerId: string,
  newOwnerName: string,
  previousOwnerName: string,
  reason?: string,
  performerId?: string,
  performerName?: string
): Promise<void> {
  const adminId = performerId || getEffectiveUserId();
  const adminName = performerName || getUserDisplayName(adminId);
  const now = new Date().toISOString();

  const actorProfile = await getUserProfile(adminId);
  const role = actorProfile?.role || getEffectiveUserRole();
  const localList = getLocalLeads();
  const prevLead = localList.find((l) => l.id === leadId);
  const prevOwnerId = prevLead?.assigned_to || '';

  if (!reason || !reason.trim()) {
    throw new Error('Transfer reason is required.');
  }

  if (prevOwnerId && newOwnerId === prevOwnerId) {
    throw new Error('Selected representative is already the current owner of this lead.');
  }

  const canAssign =
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    hasPermission(actorProfile, 'LEADS_ASSIGN') ||
    hasPermission(actorProfile, 'LEADS_TRANSFER') ||
    prevOwnerId === adminId;
  if (!canAssign) {
    throw new Error('Unauthorized: You do not have permission to transfer or assign this lead.');
  }

  // Cross-tenant and Salesman validation: Target representative must belong to same company and be active salesman
  const companyId = prevLead?.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const targetProfile = await getUserProfile(newOwnerId);
  if (targetProfile) {
    if (targetProfile.company_id && targetProfile.company_id !== companyId) {
      throw new Error('Cannot transfer lead: Target representative belongs to a different company.');
    }
    if (targetProfile.role !== 'SALESMAN' && targetProfile.role !== 'sales_rep') {
      throw new Error('Cannot transfer lead: Target representative must be an active salesman.');
    }
    if (targetProfile.is_active === false) {
      throw new Error('Cannot transfer lead: Target representative is inactive.');
    }
  }

  const updated = localList.map((l) =>
    l.id === leadId ? { ...l, assigned_to: newOwnerId, updated_at: now } : l
  );
  setLocalLeads(updated);
  notifyLeadsChanged();

  // Save transfer record in subcollection and root collection
  const transferRecord: LeadTransferRecord = {
    id: 'tr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    company_id: companyId,
    lead_id: leadId,
    lead_name: prevLead?.company_name,
    previous_owner: prevOwnerId,
    previous_owner_name: previousOwnerName,
    from_user_id: prevOwnerId,
    from_user_name: previousOwnerName,
    new_owner: newOwnerId,
    new_owner_name: newOwnerName,
    to_user_id: newOwnerId,
    to_user_name: newOwnerName,
    transferred_by: adminId,
    transferred_by_name: adminName,
    transferred_at: now,
    timestamp: now,
    reason: reason.trim(),
  };

  // Cache in local lead transfers
  const localLeadTransfers = getLocalLeadTransfers();
  setLocalLeadTransfers([transferRecord, ...localLeadTransfers]);

  try {
    const transferCol = collection(db, 'leads', leadId, 'transfers');
    const { id, ...data } = transferRecord;
    await addDoc(transferCol, data);
  } catch (e) {
    console.warn('Firestore transfer record fallback notice:', e);
  }

  try {
    const rootCol = doc(db, 'lead_transfers', transferRecord.id);
    const { id, ...data } = transferRecord;
    await setDoc(rootCol, data);
  } catch (e) {
    console.warn('Firestore root lead_transfers fallback notice:', e);
  }

  // Unified transfer record for company-level Communication Hub
  try {
    const unifiedCol = doc(db, 'transfers', transferRecord.id);
    await setDoc(unifiedCol, {
      id: transferRecord.id,
      company_id: companyId,
      record_type: 'LEAD',
      record_id: leadId,
      record_name: prevLead?.company_name || 'Lead',
      from_user_id: prevOwnerId,
      from_user_name: previousOwnerName,
      to_user_id: newOwnerId,
      to_user_name: newOwnerName,
      transferred_by: adminId,
      transferred_by_name: adminName,
      reason: reason.trim(),
      transferred_at: now,
      timestamp: now,
    });
  } catch (e) {
    console.warn('Firestore root transfers fallback notice:', e);
  }

  // Update lead doc in Firestore
  try {
    const leadDocRef = doc(db, 'leads', leadId);
    await updateDoc(leadDocRef, {
      assigned_to: newOwnerId,
      updated_at: now,
    });
  } catch (err) {
    console.warn('Firestore reassignLead updateDoc fallback notice:', err);
  }

  // Log system timeline activity (Section 10 Timeline Integration)
  await createActivity({
    lead_id: leadId,
    activity_type: 'Transfer',
    description: `Lead Transferred: ${previousOwnerName} → ${newOwnerName}${reason ? ` (Reason: ${reason})` : ''}`,
    notes: `Lead transferred by ${adminName}. Reason: ${reason}`,
    outcome: 'Transferred',
    performed_by: adminId,
    performed_by_name: adminName,
    activity_date: now,
    activity_at: now,
    is_system_activity: true,
    previous_value: previousOwnerName,
    new_value: newOwnerName,
    metadata: { reason, previous_owner_id: prevOwnerId, new_owner_id: newOwnerId, transfer_id: transferRecord.id },
  });

  // In-app notification for the newly assigned representative (Section 11 Notifications)
  try {
    await createNotification({
      recipient_id: newOwnerId,
      recipient_name: newOwnerName,
      type: 'lead_reassigned',
      title: 'Lead Transferred to You',
      message: `${adminName} transferred the lead ${prevLead?.company_name || 'Project'} to you.${reason ? ` Reason: ${reason}` : ''}`,
      lead_id: leadId,
      lead_company_name: prevLead?.company_name,
      event_key: `lead_transfer_${leadId}_${newOwnerId}_${now}`,
    });
  } catch (nErr) {
    console.warn('Reassignment notification notice:', nErr);
  }

  // Phase M: Administrative Audit Log (Separate from Lead Timeline Activity)
  try {
    await createAuditLog({
      action: 'lead_reassigned',
      entity_type: 'Lead',
      entity_id: leadId,
      lead_id: leadId,
      lead_company_name: prevLead?.company_name || 'Lead',
      target_user_id: newOwnerId,
      target_user_name: newOwnerName,
      performed_by: adminId,
      performed_by_name: adminName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${adminName} reassigned Lead "${prevLead?.company_name || leadId}" from ${previousOwnerName} to ${newOwnerName}.${reason ? ` Reason: ${reason}` : ''}`,
      metadata: {
        previous_owner_id: prevOwnerId,
        previous_owner_name: previousOwnerName,
        new_owner_id: newOwnerId,
        new_owner_name: newOwnerName,
        reason: reason || 'Territory & pipeline balancing',
      },
    });
  } catch (auditErr) {
    console.warn('reassignLead audit log notice:', auditErr);
  }
}

export async function updateLeadStatus(
  leadId: string,
  newStatus: LeadStatus,
  currentLead: LeadRecord,
  performerId?: string,
  performerName?: string
): Promise<void> {
  const userId = performerId || getEffectiveUserId();
  const name = performerName || getUserDisplayName(userId);
  const prevStatus = currentLead.status;
  if (prevStatus === newStatus) return;

  const now = new Date().toISOString();

  // Update lead document
  await updateLead(leadId, {
    status: newStatus,
  });

  // Log automatic system activity
  await createActivity({
    lead_id: leadId,
    activity_type: 'Status Change',
    description: `Status changed: ${prevStatus} → ${newStatus}`,
    notes: `Pipeline stage progressed from ${prevStatus} to ${newStatus}.`,
    outcome: newStatus,
    performed_by: userId,
    performed_by_name: name,
    activity_date: now,
    activity_at: now,
    is_system_activity: true,
    previous_value: prevStatus,
    new_value: newStatus,
  });
}

export async function updateLeadPriority(
  leadId: string,
  newPriority: Priority,
  currentLead: LeadRecord,
  performerId?: string,
  performerName?: string
): Promise<void> {
  const userId = performerId || getEffectiveUserId();
  const name = performerName || getUserDisplayName(userId);
  const prevPriority = currentLead.priority;
  if (prevPriority === newPriority) return;

  const now = new Date().toISOString();

  // Update lead document
  await updateLead(leadId, {
    priority: newPriority,
  });

  // Log automatic system activity
  await createActivity({
    lead_id: leadId,
    activity_type: 'Priority Change',
    description: `Priority changed: ${prevPriority} → ${newPriority}`,
    notes: `Account urgency updated from ${prevPriority} to ${newPriority}.`,
    outcome: newPriority,
    performed_by: userId,
    performed_by_name: name,
    activity_date: now,
    activity_at: now,
    is_system_activity: true,
    previous_value: prevPriority,
    new_value: newPriority,
  });
}

export async function updateLeadInformation(
  leadId: string,
  input: Partial<LeadRecord>
): Promise<void> {
  const { id, created_by, created_at, updated_at, ...allowedUpdates } = input as any;

  await updateLead(leadId, {
    ...allowedUpdates,
  });
}

export async function getTransferHistory(leadId: string): Promise<LeadTransferRecord[]> {
  try {
    const transferCol = collection(db, 'leads', leadId, 'transfers');
    const q = query(transferCol, orderBy('transferred_at', 'desc'));
    const snap = await getDocs(q);
    const list: LeadTransferRecord[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as LeadTransferRecord);
    });
    return list;
  } catch (e) {
    return [];
  }
}

export async function deleteLead(
  leadId: string,
  reason?: string,
  actor?: { id: string; name: string; role: UserRole }
): Promise<void> {
  const localList = getLocalLeads();
  const leadToDelete = localList.find((l) => l.id === leadId);
  const adminId = actor?.id || getEffectiveUserId();
  const adminName = actor?.name || getEffectiveUserName();
  const adminRole = actor?.role || getEffectiveUserRole();

  const actorProfile = await getUserProfile(adminId);
  const canDelete = adminRole === 'ADMIN' || adminRole === 'SUPER_ADMIN' || hasPermission(actorProfile, 'LEADS_DELETE');

  if (!canDelete) {
    throw new Error('Unauthorized: You do not have permission to delete leads (LEADS_DELETE required).');
  }

  // Update local cache
  const updatedList = localList.filter((l) => l.id !== leadId);
  setLocalLeads(updatedList);
  notifyLeadsChanged();

  try {
    const leadDocRef = doc(db, 'leads', leadId);
    await deleteDoc(leadDocRef);
  } catch (err) {
    console.warn('Firestore deleteLead fallback notice:', err);
  }

  // Phase M: Administrative Audit Log
  try {
    await createAuditLog({
      action: 'lead_deleted',
      entity_type: 'Lead',
      entity_id: leadId,
      lead_id: leadId,
      lead_company_name: leadToDelete?.company_name || 'Lead',
      performed_by: adminId,
      performed_by_name: adminName,
      performed_by_role: (adminRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN') as any,
      description: `${adminRole === 'SUPER_ADMIN' ? 'Super Administrator' : 'Company Administrator'} ${adminName} permanently deleted Lead "${leadToDelete?.company_name || leadId}".${reason ? ` Reason: ${reason}` : ''}`,
      metadata: {
        company_id: leadToDelete?.company_id || getEffectiveCompanyId(),
        company_name: leadToDelete?.company_name,
        previous_status: leadToDelete?.status,
        previous_priority: leadToDelete?.priority,
        assigned_to: leadToDelete?.assigned_to,
        reason: reason || 'Administrative Deletion',
        deleted_at: new Date().toISOString(),
      },
    });
  } catch (auditErr) {
    console.warn('deleteLead audit log notice:', auditErr);
  }
}

// ==========================================
// 3. Lead Activities Data Access Layer
// ==========================================

export async function createActivity(input: CreateActivityInput): Promise<LeadActivityRecord> {
  const userId = getEffectiveUserId();
  const targetLeadId = input.lead_id || '';
  const targetClientId = input.client_id || '';
  if (!targetLeadId && !targetClientId) {
    throw new Error('Validation Error: lead_id or client_id is required for logging an activity.');
  }

  const now = new Date().toISOString();
  const generatedId = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const performedBy = input.performed_by || userId;
  const performedByName = input.performed_by_name || getUserDisplayName(performedBy);
  const entityType: 'lead' | 'client' = targetClientId ? 'client' : 'lead';

  const activityData: LeadActivityRecord = {
    id: generatedId,
    lead_id: targetLeadId,
    client_id: targetClientId,
    entity_type: entityType,
    client_name: input.client_name || '',
    activity_type: input.activity_type,
    outcome: input.outcome || '',
    description: input.description || input.notes || '',
    notes: input.notes || input.description || '',
    activity_date: input.activity_date || input.activity_at || now,
    activity_at: input.activity_at || input.activity_date || now,
    performed_by: performedBy,
    performed_by_name: performedByName,
    created_by: userId,
    created_at: now,
    updated_at: now,
    is_system_activity: input.is_system_activity || false,
    previous_value: input.previous_value,
    new_value: input.new_value,
    metadata: input.metadata || {},
  };

  // Denormalize company_name for instant display on recent activity feeds
  if (!activityData.metadata?.company_name) {
    if (targetClientId) {
      const localClient = getLocalClients().find((c) => c.id === targetClientId);
      if (localClient?.company_name) {
        activityData.metadata = {
          ...activityData.metadata,
          company_name: localClient.company_name,
        };
        activityData.client_name = localClient.company_name;
      }
    } else if (targetLeadId) {
      const localLead = getLocalLeads().find((l) => l.id === targetLeadId);
      if (localLead?.company_name) {
        activityData.metadata = {
          ...activityData.metadata,
          company_name: localLead.company_name,
        };
      }
    }
  }

  // If next follow-up is scheduled
  if (input.next_followup && input.next_followup.scheduled_at) {
    try {
      const fuRecord = await createFollowUp({
        lead_id: targetLeadId || targetClientId,
        action: input.next_followup.action_type || 'Follow-up',
        scheduled_at: input.next_followup.scheduled_at,
        status: 'pending',
      });
      activityData.scheduled_followup_id = fuRecord.id;

      // Update lead's next_action and next_followup_date if it's a lead
      if (targetLeadId) {
        await updateLead(targetLeadId, {
          next_action: `${input.next_followup.action_type || 'Follow-up'} on ${new Date(input.next_followup.scheduled_at).toLocaleDateString()}`,
          next_followup_date: input.next_followup.scheduled_at,
        });
      }
    } catch (fuErr) {
      console.warn('Attached follow-up creation notice:', fuErr);
    }
  }

  const acts = getLocalActivities();
  acts.unshift(activityData);
  setLocalActivities(acts);
  notifyActivitiesChanged(targetLeadId || targetClientId);

  // Sync to Firestore in both locations
  try {
    // 1. Subcollection in lead or client
    const targetEntityCol = targetClientId
      ? collection(db, 'clients', targetClientId, 'activities')
      : collection(db, 'leads', targetLeadId, 'activities');
    const { id, ...data } = activityData;
    const docRef = await addDoc(targetEntityCol, data);
    if (docRef.id) {
      activityData.id = docRef.id;
      const updatedActs = getLocalActivities().map((a) =>
        a.id === generatedId ? activityData : a
      );
      setLocalActivities(updatedActs);
      notifyActivitiesChanged(targetLeadId || targetClientId);
    }
  } catch (e) {
    console.warn('Firestore createActivity subcollection fallback notice:', e);
  }

  try {
    // 2. Root collection for global CRM activity feeds
    const rootDocRef = doc(db, 'activities', activityData.id);
    const { id, ...rootData } = activityData;
    await setDoc(rootDocRef, rootData);
  } catch (e) {
    console.warn('Firestore createActivity root fallback notice:', e);
  }

  return activityData;
}

export function subscribeToAllActivities(
  onUpdate: (activities: LeadActivityRecord[]) => void,
  userRole?: UserRole,
  onError?: (error: Error) => void,
  targetUserId?: string,
  limitCount: number = 300
): Unsubscribe {
  const userId = targetUserId || getEffectiveUserId();
  const isUserAdmin = isUserAdminOrSuper(userRole);

  const filterAndEmit = (rawList: LeadActivityRecord[]) => {
    let filtered = rawList;
    if (!isUserAdmin) {
      filtered = rawList.filter(
        (a) => a.performed_by === userId || a.created_by === userId
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(a.activity_at || a.activity_date || a.created_at).getTime();
      const timeB = new Date(b.activity_at || b.activity_date || b.created_at).getTime();
      return timeB - timeA;
    });
    onUpdate(sorted);
  };

  // Immediate push from local storage
  filterAndEmit(getLocalActivities());

  const handleCustomEvent = () => {
    filterAndEmit(getLocalActivities());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_activities_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const actRef = collection(db, 'activities');
    let q;
    if (!isUserAdmin) {
      q = query(actRef, where('created_by', '==', userId), orderBy('created_at', 'desc'), limit(limitCount));
    } else {
      q = query(actRef, orderBy('created_at', 'desc'), limit(limitCount));
    }

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsActs: LeadActivityRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsActs.push({ id: docSnap.id, ...docSnap.data() } as LeadActivityRecord);
        });

        // Merge with local items
        const map = new Map<string, LeadActivityRecord>();
        getLocalActivities().forEach((a) => map.set(a.id, a));
        fsActs.forEach((a) => map.set(a.id, a));

        const merged = Array.from(map.values()).sort((a, b) => {
          const timeA = new Date(a.activity_at || a.activity_date || a.created_at).getTime();
          const timeB = new Date(b.activity_at || b.activity_date || b.created_at).getTime();
          return timeB - timeA;
        });

        setLocalActivities(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore all activities subscription fallback:', err);
        filterAndEmit(getLocalActivities());
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('Could not establish Firestore all activities subscription:', err);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_activities_changed', handleCustomEvent);
    }
  };
}

export function subscribeToUsers(
  onUpdate: (users: UserProfile[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const emitUsers = async () => {
    try {
      const list = await getAllUsers();
      onUpdate(list);
    } catch (err: any) {
      if (onError) onError(err);
    }
  };

  emitUsers();

  let firestoreUnsub: Unsubscribe = () => {};
  try {
    const usersRef = collection(db, 'users');
    firestoreUnsub = onSnapshot(
      usersRef,
      () => {
        emitUsers();
      },
      (err) => {
        console.warn('Firestore users subscription fallback:', err);
        if (onError) onError(err);
      }
    );
  } catch (e) {
    // fallback
  }

  return () => {
    firestoreUnsub();
  };
}

export function subscribeToActivities(
  targetId: string,
  onUpdate: (activities: LeadActivityRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const filterAndEmit = (list: LeadActivityRecord[]) => {
    const filtered = list
      .filter((a) => a.lead_id === targetId || a.client_id === targetId)
      .sort((a, b) => {
        const timeA = new Date(a.activity_at || a.activity_date || a.created_at).getTime();
        const timeB = new Date(b.activity_at || b.activity_date || b.created_at).getTime();
        return timeB - timeA;
      });
    onUpdate(filtered);
  };

  // Immediate push from local storage
  filterAndEmit(getLocalActivities());

  const handleCustomEvent = (e: any) => {
    if (!e.detail || !e.detail.leadId || e.detail.leadId === targetId) {
      filterAndEmit(getLocalActivities());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_activities_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const isClient = targetId.startsWith('cli_') || getLocalClients().some((c) => c.id === targetId);
    const activitiesCol = isClient
      ? collection(db, 'clients', targetId, 'activities')
      : collection(db, 'leads', targetId, 'activities');
    const q = query(activitiesCol, orderBy('created_at', 'desc'));

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsActs: LeadActivityRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsActs.push({ id: docSnap.id, ...docSnap.data() } as LeadActivityRecord);
        });

        // Merge with local items for this entity
        const otherLocal = getLocalActivities().filter((a) => a.lead_id !== targetId && a.client_id !== targetId);
        const merged = [...fsActs, ...otherLocal];
        setLocalActivities(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore activities subscription fallback:', err);
        filterAndEmit(getLocalActivities());
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore activities listener:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_activities_changed', handleCustomEvent);
    }
  };
}

/**
 * Subscribes to company-level communications for the Communication Hub.
 * Enforces strict company tenant isolation.
 */
export function subscribeToCompanyCommunications(
  onUpdate: (activities: LeadActivityRecord[]) => void,
  companyId?: string
): Unsubscribe {
  const targetCompanyId = companyId || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;

  const emitLocal = () => {
    const allActivities = getLocalActivities();
    const leads = getLocalLeads();
    const clients = getLocalClients();

    const companyLeadIds = new Set(
      leads.filter((l) => !l.company_id || l.company_id === targetCompanyId).map((l) => l.id)
    );
    const companyClientIds = new Set(
      clients.filter((c) => !c.company_id || c.company_id === targetCompanyId).map((c) => c.id)
    );

    const filtered = allActivities.filter((act) => {
      if (act.company_id && act.company_id !== targetCompanyId) return false;
      if (act.lead_id && companyLeadIds.has(act.lead_id)) return true;
      if (act.client_id && companyClientIds.has(act.client_id)) return true;
      if (act.company_id === targetCompanyId) return true;
      return false;
    });

    filtered.sort((a, b) => {
      const timeA = new Date(a.activity_at || a.activity_date || a.created_at).getTime();
      const timeB = new Date(b.activity_at || b.activity_date || b.created_at).getTime();
      return timeB - timeA;
    });

    onUpdate(filtered);
  };

  emitLocal();

  const handleCustomEvent = () => emitLocal();
  if (typeof window !== 'undefined') {
    window.addEventListener('crm_activities_changed', handleCustomEvent);
    window.addEventListener('crm_leads_changed', handleCustomEvent);
    window.addEventListener('crm_clients_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};
  try {
    const q = query(
      collection(db, 'activities'),
      where('company_id', '==', targetCompanyId),
      orderBy('activity_at', 'desc'),
      limit(250)
    );

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsActs: LeadActivityRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsActs.push({ id: docSnap.id, ...docSnap.data() } as LeadActivityRecord);
        });

        if (fsActs.length > 0) {
          const localList = getLocalActivities();
          const map = new Map<string, LeadActivityRecord>();
          fsActs.forEach((a) => map.set(a.id, a));
          localList.forEach((a) => {
            if (!map.has(a.id)) map.set(a.id, a);
          });
          setLocalActivities(Array.from(map.values()));
          emitLocal();
        }
      },
      (err) => {
        console.warn('subscribeToCompanyCommunications fallback notice:', err);
      }
    );
  } catch (err) {
    console.warn('Firestore company activities subscription error:', err);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_activities_changed', handleCustomEvent);
      window.removeEventListener('crm_leads_changed', handleCustomEvent);
      window.removeEventListener('crm_clients_changed', handleCustomEvent);
    }
  };
}

export async function getActivitiesByLeadId(leadId: string): Promise<LeadActivityRecord[]> {
  const local = getLocalActivities().filter((a) => a.lead_id === leadId);
  if (local.length > 0) return local;

  try {
    const activitiesCol = collection(db, 'leads', leadId, 'activities');
    const q = query(activitiesCol, orderBy('activity_date', 'desc'));
    const snap = await getDocs(q);
    const list: LeadActivityRecord[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as LeadActivityRecord);
    });
    return list;
  } catch (e) {
    return local;
  }
}

// ==========================================
// 4. Follow-ups Data Access Layer
// ==========================================

export async function recalculateLeadNextFollowUp(leadId: string): Promise<void> {
  try {
    const allFollowUps = getLocalFollowUps().filter((f) => f.lead_id === leadId);
    const pending = allFollowUps
      .filter((f) => f.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    if (pending.length > 0) {
      const nearest = pending[0];
      const scheduledDate = new Date(nearest.scheduled_at);
      const isToday = scheduledDate.toDateString() === new Date().toDateString();
      const timeStr = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const actionDisplay = `${nearest.action} (${isToday ? 'Today' : scheduledDate.toLocaleDateString()} ${timeStr})`;

      await updateLead(leadId, {
        next_action: actionDisplay,
        next_followup_date: nearest.scheduled_at,
      });
    } else {
      await updateLead(leadId, {
        next_action: '',
        next_followup_date: '',
      });
    }
  } catch (err) {
    console.warn('recalculateLeadNextFollowUp notice:', err);
  }
}

export async function createFollowUp(
  input: CreateFollowUpInput,
  currentUserRole?: UserRole
): Promise<FollowUpRecord> {
  const userId = getEffectiveUserId();
  if (!input.lead_id) {
    throw new Error('Validation Error: lead_id is required for creating a follow-up.');
  }

  const now = new Date().toISOString();
  const generatedId = 'fu_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  // Find lead or client to denormalize company_name, contact_person, phone, priority, assigned_to
  let leadInfo: Partial<LeadRecord> = {};
  let resolvedLeadId = input.lead_id;

  if (input.client_id) {
    const localClient = getLocalClients().find((c) => c.id === input.client_id);
    if (localClient) {
      leadInfo = {
        company_name: localClient.company_name,
        contact_person: localClient.contact_person,
        phone: localClient.phone,
        whatsapp: localClient.whatsapp,
        email: localClient.email,
        assigned_to: localClient.owner_id,
      };
      if (!resolvedLeadId && localClient.source_lead_id) {
        resolvedLeadId = localClient.source_lead_id;
      }
    }
  }

  if (resolvedLeadId) {
    const localLead = getLocalLeads().find((l) => l.id === resolvedLeadId);
    if (localLead) {
      leadInfo = { ...localLead, ...leadInfo };
    } else {
      try {
        const leadSnap = await getDoc(doc(db, 'leads', resolvedLeadId));
        if (leadSnap.exists()) {
          leadInfo = { id: leadSnap.id, ...leadSnap.data(), ...leadInfo } as LeadRecord;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  const assignedTo = input.assigned_to || leadInfo.assigned_to || userId;
  const assignedToName = getUserDisplayName(assignedTo);

  const followUpData: FollowUpRecord = {
    id: generatedId,
    lead_id: resolvedLeadId || input.client_id || 'lead_general',
    company_name: input.company_name || leadInfo.company_name || 'Lead Contact',
    contact_person: input.contact_person || leadInfo.contact_person || '',
    phone: input.phone || leadInfo.phone || leadInfo.whatsapp || '',
    whatsapp: input.whatsapp || leadInfo.whatsapp || leadInfo.phone || '',
    email: input.email || leadInfo.email || '',
    priority: input.priority || leadInfo.priority || 'Warm',
    lead_status: input.lead_status || leadInfo.status || 'New',
    action: input.action || 'Follow-up',
    scheduled_at: input.scheduled_at,
    notes: input.notes || '',
    status: input.status || 'pending',
    assigned_to: assignedTo,
    assigned_to_name: assignedToName,
    created_by: userId,
    created_at: now,
    updated_at: now,
    title: input.title,
    end_time: input.end_time,
    location: input.location,
    client_id: input.client_id,
    entity_type: input.entity_type || (input.client_id ? 'Client' : 'Lead'),
  };

  const list = getLocalFollowUps();
  list.unshift(followUpData);
  setLocalFollowUps(list);
  notifyFollowupsChanged(resolvedLeadId || input.lead_id);

  // Sync to Firestore in both locations
  try {
    // 1. In lead's subcollection
    const subColDocRef = doc(db, 'leads', input.lead_id, 'followups', generatedId);
    const { id, ...dataToSync } = followUpData;
    await setDoc(subColDocRef, dataToSync);
  } catch (e) {
    console.warn('Firestore subcollection createFollowUp fallback:', e);
  }

  try {
    // 2. In root followups collection for global queries
    const rootDocRef = doc(db, 'followups', generatedId);
    const { id, ...dataToSync } = followUpData;
    await setDoc(rootDocRef, dataToSync);
  } catch (e) {
    console.warn('Firestore root createFollowUp fallback:', e);
  }

  // Recalculate lead's next follow up
  await recalculateLeadNextFollowUp(input.lead_id);

  return followUpData;
}

export async function completeFollowUp(input: CompleteFollowUpInput): Promise<void> {
  const userId = input.performer_id || getEffectiveUserId();
  const userName = input.performer_name || getUserDisplayName(userId);
  const now = new Date().toISOString();

  const list = getLocalFollowUps();
  const existing = list.find((f) => f.id === input.followup_id);
  const actionType = existing?.action || 'Follow-up';

  const updatePayload: Partial<FollowUpRecord> = {
    status: 'completed',
    outcome: input.outcome,
    notes: input.notes || existing?.notes || '',
    completed_at: now,
    completed_by: userId,
    completed_by_name: userName,
    updated_at: now,
  };

  const updatedList = list.map((f) =>
    f.id === input.followup_id ? { ...f, ...updatePayload } : f
  );
  setLocalFollowUps(updatedList);
  notifyFollowupsChanged(input.lead_id);

  // Sync Firestore
  try {
    const subRef = doc(db, 'leads', input.lead_id, 'followups', input.followup_id);
    await updateDoc(subRef, updatePayload);
  } catch (e) {
    console.warn('Firestore completeFollowUp subcollection fallback:', e);
  }

  try {
    const rootRef = doc(db, 'followups', input.followup_id);
    await updateDoc(rootRef, updatePayload);
  } catch (e) {
    console.warn('Firestore completeFollowUp root fallback:', e);
  }

  // Log activity on Lead Timeline
  let mappedActivityType: any = 'Follow-up';
  const actionLower = actionType.toLowerCase();
  if (actionLower.includes('call')) mappedActivityType = 'Call';
  else if (actionLower.includes('whatsapp')) mappedActivityType = 'WhatsApp';
  else if (actionLower.includes('email')) mappedActivityType = 'Email';
  else if (actionLower.includes('meeting')) mappedActivityType = 'Meeting';
  else if (actionLower.includes('visit')) mappedActivityType = 'Site Visit';
  else if (actionLower.includes('quotation')) mappedActivityType = 'Quotation';

  await createActivity({
    lead_id: input.lead_id,
    activity_type: mappedActivityType,
    description: `${actionType} Follow-up completed: ${input.outcome}`,
    notes: `Result: ${input.outcome}${input.notes ? `. Notes: ${input.notes}` : ''}`,
    outcome: input.outcome,
    performed_by: userId,
    performed_by_name: userName,
    activity_date: now,
    activity_at: now,
    is_system_activity: false,
    new_value: input.outcome,
  });

  // If next follow-up is scheduled immediately
  if (input.next_followup && input.next_followup.scheduled_at) {
    await createFollowUp({
      lead_id: input.lead_id,
      action: input.next_followup.action || 'Follow-up',
      scheduled_at: input.next_followup.scheduled_at,
      notes: input.next_followup.notes || '',
      status: 'pending',
    });
  } else {
    // Recalculate lead's next follow up
    await recalculateLeadNextFollowUp(input.lead_id);
  }

  // Notify Admin of completed follow-up
  try {
    const adminAccounts = PREDEFINED_ACCOUNTS.filter((a) => a.role === 'ADMIN');
    for (const admin of adminAccounts) {
      const adminId = `uid-${admin.name.toLowerCase()}`;
      if (adminId !== userId) {
        await createNotification({
          recipient_id: adminId,
          recipient_name: admin.name,
          type: 'followup_completed',
          title: 'Follow-up Completed',
          message: `${userName} completed follow-up for ${existing?.company_name || 'Lead'}: "${input.outcome}".`,
          lead_id: input.lead_id,
          lead_company_name: existing?.company_name,
          follow_up_id: input.followup_id,
          event_key: `followup_comp_${input.followup_id}_${now}`,
        });
      }
    }
  } catch (nErr) {
    console.warn('Admin follow-up completion notification notice:', nErr);
  }
}

export async function rescheduleFollowUp(input: RescheduleFollowUpInput): Promise<FollowUpRecord> {
  const userId = input.performer_id || getEffectiveUserId();
  const userName = input.performer_name || getUserDisplayName(userId);
  const now = new Date().toISOString();

  const list = getLocalFollowUps();
  const existing = list.find((f) => f.id === input.followup_id);
  const oldAction = existing?.action || 'Follow-up';
  const oldDateStr = existing?.scheduled_at ? new Date(existing.scheduled_at).toLocaleString() : 'Previous date';
  const newDateStr = new Date(input.new_scheduled_at).toLocaleString();

  // 1. Create the new pending follow-up
  const newFu = await createFollowUp({
    lead_id: input.lead_id,
    action: input.new_action || oldAction,
    scheduled_at: input.new_scheduled_at,
    notes: input.notes || existing?.notes || '',
    status: 'pending',
    assigned_to: existing?.assigned_to,
    company_name: existing?.company_name,
    contact_person: existing?.contact_person,
    phone: existing?.phone,
    whatsapp: existing?.whatsapp,
    email: existing?.email,
    priority: existing?.priority,
    lead_status: existing?.lead_status,
    title: existing?.title,
    end_time: input.new_end_time || existing?.end_time,
    location: input.new_location || existing?.location,
    client_id: existing?.client_id,
    entity_type: existing?.entity_type,
  });

  // 2. Mark old follow-up as rescheduled
  const updatePayload: Partial<FollowUpRecord> = {
    status: 'rescheduled',
    rescheduled_at: now,
    rescheduled_by: userId,
    rescheduled_to_id: newFu.id,
    notes: input.notes ? `${existing?.notes ? existing.notes + ' | ' : ''}Rescheduled: ${input.notes}` : existing?.notes,
    updated_at: now,
  };

  const updatedList = getLocalFollowUps().map((f) =>
    f.id === input.followup_id ? { ...f, ...updatePayload } : f
  );
  setLocalFollowUps(updatedList);
  notifyFollowupsChanged(input.lead_id);

  // Sync Firestore
  try {
    const subRef = doc(db, 'leads', input.lead_id, 'followups', input.followup_id);
    await updateDoc(subRef, updatePayload);
  } catch (e) {
    console.warn('Firestore rescheduleFollowUp sub fallback:', e);
  }

  try {
    const rootRef = doc(db, 'followups', input.followup_id);
    await updateDoc(rootRef, updatePayload);
  } catch (e) {
    console.warn('Firestore rescheduleFollowUp root fallback:', e);
  }

  // 3. Log Timeline Activity
  await createActivity({
    lead_id: input.lead_id,
    activity_type: 'Follow-up',
    description: `Follow-up rescheduled: ${oldAction} (${oldDateStr} → ${newDateStr})`,
    notes: `Rescheduled by ${userName}.${input.notes ? ` Reason/Notes: ${input.notes}` : ''}`,
    performed_by: userId,
    performed_by_name: userName,
    activity_date: now,
    activity_at: now,
    is_system_activity: true,
    previous_value: oldDateStr,
    new_value: newDateStr,
  });

  // 4. Recalculate lead's next follow up
  await recalculateLeadNextFollowUp(input.lead_id);

  return newFu;
}

export async function cancelFollowUp(input: CancelFollowUpInput): Promise<void> {
  const userId = input.performer_id || getEffectiveUserId();
  const userName = input.performer_name || getUserDisplayName(userId);
  const now = new Date().toISOString();

  const list = getLocalFollowUps();
  const existing = list.find((f) => f.id === input.followup_id);
  const actionType = existing?.action || 'Follow-up';

  const updatePayload: Partial<FollowUpRecord> = {
    status: 'cancelled',
    cancelled_at: now,
    cancelled_by: userId,
    cancellation_reason: input.cancellation_reason || 'Cancelled by user',
    updated_at: now,
  };

  const updatedList = list.map((f) =>
    f.id === input.followup_id ? { ...f, ...updatePayload } : f
  );
  setLocalFollowUps(updatedList);
  notifyFollowupsChanged(input.lead_id);

  // Sync Firestore
  try {
    const subRef = doc(db, 'leads', input.lead_id, 'followups', input.followup_id);
    await updateDoc(subRef, updatePayload);
  } catch (e) {
    console.warn('Firestore cancelFollowUp sub fallback:', e);
  }

  try {
    const rootRef = doc(db, 'followups', input.followup_id);
    await updateDoc(rootRef, updatePayload);
  } catch (e) {
    console.warn('Firestore cancelFollowUp root fallback:', e);
  }

  // Log Timeline Activity
  await createActivity({
    lead_id: input.lead_id,
    activity_type: 'Follow-up',
    description: `Follow-up cancelled: ${actionType}`,
    notes: `Follow-up cancelled by ${userName}.${input.cancellation_reason ? ` Reason: ${input.cancellation_reason}` : ''}`,
    performed_by: userId,
    performed_by_name: userName,
    activity_date: now,
    activity_at: now,
    is_system_activity: true,
  });

  // Recalculate lead's next follow up
  await recalculateLeadNextFollowUp(input.lead_id);
}

export async function updateFollowUp(
  leadId: string,
  followUpId: string,
  input: UpdateFollowUpInput
): Promise<void> {
  const now = new Date().toISOString();
  const list = getLocalFollowUps().map((f) =>
    f.id === followUpId ? { ...f, ...input, updated_at: now } : f
  );
  setLocalFollowUps(list);
  notifyFollowupsChanged(leadId);

  try {
    const docRef = doc(db, 'leads', leadId, 'followups', followUpId);
    await updateDoc(docRef, { ...input, updated_at: now });
  } catch (e) {
    console.warn('Firestore updateFollowUp fallback:', e);
  }

  try {
    const rootRef = doc(db, 'followups', followUpId);
    await updateDoc(rootRef, { ...input, updated_at: now });
  } catch (e) {
    console.warn('Firestore root updateFollowUp fallback:', e);
  }

  await recalculateLeadNextFollowUp(leadId);
}

export async function getFollowUpsByLeadId(leadId: string): Promise<FollowUpRecord[]> {
  const local = getLocalFollowUps().filter((f) => f.lead_id === leadId);
  if (local.length > 0) {
    return local.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }

  try {
    const followupsCol = collection(db, 'leads', leadId, 'followups');
    const q = query(followupsCol, orderBy('scheduled_at', 'asc'));
    const snap = await getDocs(q);
    const list: FollowUpRecord[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as FollowUpRecord);
    });
    return list;
  } catch (e) {
    return local;
  }
}

/**
 * Real-time subscription to all follow-ups with role-based scoping
 */
export function subscribeToFollowUps(
  onUpdate: (followups: FollowUpRecord[]) => void,
  userRole?: UserRole,
  onError?: (error: Error) => void,
  targetUserId?: string
): Unsubscribe {
  const userId = targetUserId || getEffectiveUserId();
  const isUserAdmin = isUserAdminOrSuper(userRole);

  const filterAndEmit = (rawList: FollowUpRecord[]) => {
    let filtered = rawList;
    if (!isUserAdmin) {
      filtered = rawList.filter(
        (f) => f.assigned_to === userId || f.created_by === userId
      );
    }
    onUpdate(filtered);
  };

  // Immediate push from local storage
  filterAndEmit(getLocalFollowUps());

  const handleCustomEvent = () => {
    filterAndEmit(getLocalFollowUps());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_followups_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const followupsRef = collection(db, 'followups');
    let q;
    if (!isUserAdmin) {
      q = query(followupsRef, where('assigned_to', '==', userId));
    } else {
      q = query(followupsRef);
    }

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsFollowups: FollowUpRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsFollowups.push({ id: docSnap.id, ...docSnap.data() } as FollowUpRecord);
        });

        // Merge Firestore results with local items
        const map = new Map<string, FollowUpRecord>();
        getLocalFollowUps().forEach((f) => map.set(f.id, f));
        fsFollowups.forEach((f) => map.set(f.id, f));

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        );

        setLocalFollowUps(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore followups subscription fallback to local cache:', err);
        filterAndEmit(getLocalFollowUps());
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('Could not establish Firestore followups onSnapshot:', err);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_followups_changed', handleCustomEvent);
    }
  };
}

/**
 * Real-time subscription to follow-ups for a specific lead
 */
export function subscribeToLeadFollowUps(
  leadId: string,
  onUpdate: (followups: FollowUpRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const filterAndEmit = (list: FollowUpRecord[]) => {
    const filtered = list
      .filter((f) => f.lead_id === leadId)
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    onUpdate(filtered);
  };

  // Immediate push
  filterAndEmit(getLocalFollowUps());

  const handleCustomEvent = (e: any) => {
    if (!e.detail || !e.detail.leadId || e.detail.leadId === leadId) {
      filterAndEmit(getLocalFollowUps());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_followups_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const fuCol = collection(db, 'leads', leadId, 'followups');
    const q = query(fuCol, orderBy('scheduled_at', 'desc'));

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsList: FollowUpRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsList.push({ id: docSnap.id, ...docSnap.data() } as FollowUpRecord);
        });

        // Merge with local
        const otherLocal = getLocalFollowUps().filter((f) => f.lead_id !== leadId);
        const merged = [...fsList, ...otherLocal];
        setLocalFollowUps(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore lead followups subscription fallback:', err);
        filterAndEmit(getLocalFollowUps());
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore lead followups listener:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_followups_changed', handleCustomEvent);
    }
  };
}

// ==========================================
// 5. Secure Lead Attachments & Documents DAL
// ==========================================

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bin', 'msi', 'jar', 'vbs', 'ps1', 'scr', 'pif',
  'com', 'hta', 'cpl', 'gadget', 'wsf', 'msc', 'msp', 'reg'
]);

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function validateAttachmentFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  // 1. Max size check (30 MB limit)
  const MAX_BYTES = 30 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of 30 MB.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File appears to be empty (0 bytes).' };
  }

  // 2. Dangerous extension check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Executable or script files (.${ext}) are strictly blocked for enterprise security reasons.`,
    };
  }

  return { valid: true };
}

export async function uploadLeadAttachment(
  input: UploadAttachmentInput,
  currentUserRole?: UserRole
): Promise<AttachmentRecord> {
  const userId = getEffectiveUserId();
  const userName = getUserDisplayName(userId);
  const now = new Date().toISOString();

  if (!input.lead_id) {
    throw new Error('Validation Error: lead_id is required for uploading an attachment.');
  }

  // Validate file
  const validation = validateAttachmentFile(input.file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file.');
  }

  // Check lead access
  const lead = await getLeadById(input.lead_id);
  const isUserAdmin = isUserAdminOrSuper(currentUserRole);
  if (!isUserAdmin && lead && lead.assigned_to !== userId && lead.created_by !== userId) {
    throw new Error('Permission Denied: You are not authorized to attach files to this lead.');
  }

  // Clean filename and generate path
  const sanitizedFileName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileId = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const path = `leads/${input.lead_id}/attachments/${fileId}/${sanitizedFileName}`;

  let downloadUrl = '';

  // 1. Try Firebase Storage upload with progress monitoring
  try {
    const fileRef = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(fileRef, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      customMetadata: {
        lead_id: input.lead_id,
        uploaded_by: userId,
        category: input.category || 'Project Document',
      },
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (input.onProgress && snapshot.totalBytes > 0) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            input.onProgress(Math.min(99, Math.round(progress)));
          }
        },
        (error) => {
          console.warn('Firebase Storage upload error, falling back:', error);
          reject(error);
        },
        async () => {
          try {
            downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (input.onProgress) input.onProgress(100);
            resolve();
          } catch (urlErr) {
            console.warn('getDownloadURL error:', urlErr);
            resolve();
          }
        }
      );
    });
  } catch (storageErr) {
    console.warn('Storage upload fallback triggered:', storageErr);
    // If running in an environment where Storage bucket isn't directly reachable,
    // convert small files to object/data URL for rich preview and local persistence
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        downloadUrl = URL.createObjectURL(input.file);
      } catch (e) {
        // ignore
      }
    }
    if (input.onProgress) input.onProgress(100);
  }

  // Build attachment record
  const attachmentRecord: AttachmentRecord = {
    id: fileId,
    lead_id: input.lead_id,
    file_name: input.file.name,
    storage_path: path,
    file_type: input.file.type || 'application/octet-stream',
    file_size: input.file.size,
    uploaded_by: userId,
    uploaded_by_name: userName,
    uploaded_at: now,
    updated_at: now,
    created_at: now,
    category: input.category || 'Project Document',
    description: input.description || '',
    download_url: downloadUrl,
  };

  // 2. Save to local storage cache immediately
  const localList = getLocalAttachments();
  localList.unshift(attachmentRecord);
  setLocalAttachments(localList);
  notifyAttachmentsChanged(input.lead_id);

  // 3. Save to Firestore subcollection: leads/{leadId}/attachments/{fileId}
  try {
    const docRef = doc(db, 'leads', input.lead_id, 'attachments', fileId);
    const { id, ...dataToSync } = attachmentRecord;
    await setDoc(docRef, dataToSync);
  } catch (fsErr) {
    console.warn('Firestore setDoc attachment notice:', fsErr);
  }

  // 4. Automatically create Lead Timeline Activity for audit trail
  try {
    const catLabel = input.category ? ` [${input.category}]` : '';
    await createActivity({
      lead_id: input.lead_id,
      activity_type: 'Attachment Uploaded',
      description: `Document attached: ${input.file.name} (${formatFileSize(input.file.size)})${catLabel}`,
      notes: `File "${input.file.name}" uploaded to project documents.${input.description ? `\nNotes: ${input.description}` : ''}`,
      outcome: input.category || 'Project Document',
      performed_by: userId,
      performed_by_name: userName,
      activity_date: now,
      activity_at: now,
      is_system_activity: true,
      new_value: input.file.name,
      metadata: {
        attachment_id: fileId,
        file_name: input.file.name,
        file_size: input.file.size,
        file_type: input.file.type,
        category: input.category || 'Project Document',
        storage_path: path,
        download_url: downloadUrl,
      },
    });
  } catch (actErr) {
    console.warn('System activity for attachment upload notice:', actErr);
  }

  return attachmentRecord;
}

export async function deleteLeadAttachment(
  leadId: string,
  attachment: AttachmentRecord,
  currentUserRole?: UserRole,
  performerId?: string,
  performerName?: string
): Promise<void> {
  const userId = performerId || getEffectiveUserId();
  const userName = performerName || getUserDisplayName(userId);
  const now = new Date().toISOString();

  const isUserAdmin = isUserAdminOrSuper(currentUserRole);
  const lead = await getLeadById(leadId);
  const isAssignedSalesman = lead && (lead.assigned_to === userId || lead.created_by === userId);

  if (!isUserAdmin && !isAssignedSalesman) {
    throw new Error('Permission Denied: You do not have permission to delete this document.');
  }

  // 1. Remove from local cache
  const localList = getLocalAttachments().filter((a) => a.id !== attachment.id);
  setLocalAttachments(localList);
  notifyAttachmentsChanged(leadId);

  // 2. Delete from Firebase Storage if storage_path exists
  if (attachment.storage_path) {
    try {
      const fileRef = storageRef(storage, attachment.storage_path);
      await deleteObject(fileRef);
    } catch (storageErr) {
      console.warn('Firebase Storage deleteObject notice:', storageErr);
    }
  }

  // 3. Delete document from Firestore
  try {
    const docRef = doc(db, 'leads', leadId, 'attachments', attachment.id);
    await deleteDoc(docRef);
  } catch (fsErr) {
    console.warn('Firestore deleteDoc attachment notice:', fsErr);
  }

  // 4. Automatically create Lead Timeline Activity for deletion audit
  try {
    await createActivity({
      lead_id: leadId,
      activity_type: 'Attachment Deleted',
      description: `Document removed: ${attachment.file_name}`,
      notes: `File "${attachment.file_name}" was deleted from lead documents by ${userName}.`,
      outcome: 'Deleted',
      performed_by: userId,
      performed_by_name: userName,
      activity_date: now,
      activity_at: now,
      is_system_activity: true,
      previous_value: attachment.file_name,
      metadata: {
        attachment_id: attachment.id,
        file_name: attachment.file_name,
      },
    });
  } catch (actErr) {
    console.warn('System activity for attachment deletion notice:', actErr);
  }
}

export async function getAttachmentsByLeadId(leadId: string): Promise<AttachmentRecord[]> {
  const local = getLocalAttachments().filter((a) => a.lead_id === leadId);
  if (local.length > 0) {
    return local.sort(
      (a, b) =>
        new Date(b.uploaded_at || b.created_at || 0).getTime() -
        new Date(a.uploaded_at || a.created_at || 0).getTime()
    );
  }

  try {
    const attachCol = collection(db, 'leads', leadId, 'attachments');
    const snap = await getDocs(attachCol);
    const list: AttachmentRecord[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as AttachmentRecord);
    });
    return list.sort(
      (a, b) =>
        new Date(b.uploaded_at || b.created_at || 0).getTime() -
        new Date(a.uploaded_at || a.created_at || 0).getTime()
    );
  } catch (e) {
    return local;
  }
}

export function subscribeToLeadAttachments(
  leadId: string,
  onUpdate: (attachments: AttachmentRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const filterAndEmit = (list: AttachmentRecord[]) => {
    const filtered = list
      .filter((a) => a.lead_id === leadId)
      .sort(
        (a, b) =>
          new Date(b.uploaded_at || b.created_at || 0).getTime() -
          new Date(a.uploaded_at || a.created_at || 0).getTime()
      );
    onUpdate(filtered);
  };

  // 1. Instant push from local cache
  filterAndEmit(getLocalAttachments());

  const handleCustomEvent = (e: any) => {
    if (!e.detail || !e.detail.leadId || e.detail.leadId === leadId) {
      filterAndEmit(getLocalAttachments());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_attachments_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const attachCol = collection(db, 'leads', leadId, 'attachments');
    firestoreUnsub = onSnapshot(
      attachCol,
      (snapshot) => {
        const fsList: AttachmentRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsList.push({ id: docSnap.id, ...docSnap.data() } as AttachmentRecord);
        });

        // Merge with local items for this lead
        const otherLocal = getLocalAttachments().filter((a) => a.lead_id !== leadId);
        const merged = [...fsList, ...otherLocal];
        setLocalAttachments(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore attachments subscription fallback:', err);
        filterAndEmit(getLocalAttachments());
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore attachments listener:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_attachments_changed', handleCustomEvent);
    }
  };
}

// Backward compatibility alias
export async function createAttachmentRecord(
  leadId: string,
  data: Omit<AttachmentRecord, 'id' | 'created_at' | 'uploaded_by'>
): Promise<AttachmentRecord> {
  const userId = getEffectiveUserId();
  const now = new Date().toISOString();
  const recordId = 'att_' + Date.now();

  const record: AttachmentRecord = {
    id: recordId,
    ...data,
    lead_id: leadId,
    uploaded_by: userId,
    uploaded_at: now,
    updated_at: now,
    created_at: now,
  };

  try {
    const attachCol = collection(db, 'leads', leadId, 'attachments');
    const { id, ...saveData } = record;
    const docRef = await addDoc(attachCol, saveData);
    record.id = docRef.id;
  } catch (e) {
    console.warn('Firestore createAttachmentRecord fallback:', e);
  }

  return record;
}

// ==========================================
// 6. Notifications & Reminder System DAL (Phase L)
// ==========================================

export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationRecord | null> {
  if (!input.recipient_id || !input.title) {
    return null;
  }

  const now = new Date().toISOString();
  const generatedId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  // 1. In-memory / Local Deduplication Check
  if (input.event_key) {
    const existing = getLocalNotifications().find(
      (n) => n.recipient_id === input.recipient_id && n.event_key === input.event_key
    );
    if (existing) {
      return existing;
    }
  }

  const newRecord: NotificationRecord = {
    id: generatedId,
    recipient_id: input.recipient_id,
    recipient_name: input.recipient_name || getUserDisplayName(input.recipient_id),
    type: input.type,
    title: input.title,
    message: input.message,
    lead_id: input.lead_id,
    lead_company_name: input.lead_company_name,
    follow_up_id: input.follow_up_id,
    is_read: false,
    created_at: now,
    updated_at: now,
    event_key: input.event_key,
    link_url: input.link_url,
  };

  // 2. Persist to local cache immediately
  const currentList = getLocalNotifications();
  if (input.event_key && currentList.some((n) => n.recipient_id === input.recipient_id && n.event_key === input.event_key)) {
    return currentList.find((n) => n.recipient_id === input.recipient_id && n.event_key === input.event_key) || null;
  }
  setLocalNotifications([newRecord, ...currentList]);
  notifyNotificationsChanged();

  // 3. Persist to Firestore with deduplication check
  try {
    const notifCol = collection(db, 'notifications');
    if (input.event_key) {
      const q = query(
        notifCol,
        where('recipient_id', '==', input.recipient_id),
        where('event_key', '==', input.event_key),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as NotificationRecord;
      }
    }

    const { id, ...saveData } = newRecord;
    const docRef = await addDoc(notifCol, saveData);
    if (docRef.id) {
      newRecord.id = docRef.id;
      const updatedLocal = getLocalNotifications().map((n) => (n.id === generatedId ? newRecord : n));
      setLocalNotifications(updatedLocal);
      notifyNotificationsChanged();
    }
  } catch (err) {
    console.warn('Firestore createNotification fallback notice:', err);
  }

  return newRecord;
}

export async function getUserNotifications(userId: string): Promise<NotificationRecord[]> {
  const localList = getLocalNotifications().filter((n) => n.recipient_id === userId);
  try {
    const notifCol = collection(db, 'notifications');
    const q = query(
      notifCol,
      where('recipient_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list: NotificationRecord[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as NotificationRecord);
      });
      return list;
    }
  } catch (e) {
    console.warn('getUserNotifications Firestore fallback notice:', e);
  }
  return localList.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (notifications: NotificationRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const filterAndEmit = (list: NotificationRecord[]) => {
    const userNotifs = list
      .filter((n) => n.recipient_id === userId)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    onUpdate(userNotifs);
  };

  // 1. Initial push from local storage
  filterAndEmit(getLocalNotifications());

  const handleCustomEvent = () => {
    filterAndEmit(getLocalNotifications());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_notifications_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const notifCol = collection(db, 'notifications');
    const q = query(
      notifCol,
      where('recipient_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(50)
    );

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsList: NotificationRecord[] = [];
        snapshot.forEach((d) => {
          fsList.push({ id: d.id, ...d.data() } as NotificationRecord);
        });

        const otherLocal = getLocalNotifications().filter((n) => n.recipient_id !== userId);
        const merged = [...fsList, ...otherLocal];
        setLocalNotifications(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore notifications subscription fallback notice:', err);
        filterAndEmit(getLocalNotifications());
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore notifications listener:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_notifications_changed', handleCustomEvent);
    }
  };
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  const current = getLocalNotifications();
  const updated = current.map((n) => {
    if (n.id === notificationId && n.recipient_id === userId) {
      return { ...n, is_read: true, updated_at: now };
    }
    return n;
  });
  setLocalNotifications(updated);
  notifyNotificationsChanged();

  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { is_read: true, updated_at: now });
  } catch (e) {
    console.warn('Firestore markNotificationAsRead fallback notice:', e);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const now = new Date().toISOString();
  const current = getLocalNotifications();
  const updated = current.map((n) => {
    if (n.recipient_id === userId) {
      return { ...n, is_read: true, updated_at: now };
    }
    return n;
  });
  setLocalNotifications(updated);
  notifyNotificationsChanged();

  try {
    const notifCol = collection(db, 'notifications');
    const q = query(
      notifCol,
      where('recipient_id', '==', userId),
      where('is_read', '==', false)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.update(d.ref, { is_read: true, updated_at: now });
      });
      await batch.commit();
    }
  } catch (e) {
    console.warn('Firestore markAllNotificationsAsRead fallback notice:', e);
  }
}

export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  const current = getLocalNotifications();
  const updated = current.filter((n) => !(n.id === notificationId && n.recipient_id === userId));
  setLocalNotifications(updated);
  notifyNotificationsChanged();

  try {
    const docRef = doc(db, 'notifications', notificationId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Firestore deleteNotification fallback notice:', e);
  }
}

/**
 * Intelligent follow-up reminder generator:
 * Inspects pending follow-ups and generates deduplicated reminders for:
 * - Overdue follow-ups
 * - Due today follow-ups
 * - Upcoming follow-ups
 */
export async function checkAndGenerateFollowUpReminders(
  userId: string,
  userRole?: string
): Promise<void> {
  if (!userId) return;

  try {
    const isUserAdmin = isUserAdminOrSuper(userRole);
    const allFollowUps = getLocalFollowUps();
    const followUps = isUserAdmin
      ? allFollowUps
      : allFollowUps.filter((f) => f.assigned_to === userId || f.created_by === userId);

    const today = new Date();
    const todayDateStr = today.toISOString().slice(0, 10);
    const nowMs = today.getTime();

    // Only process pending follow-ups
    const pendingFollowups = followUps.filter((fu) => fu.status === 'pending');

    for (const fu of pendingFollowups) {
      const isResponsible = fu.assigned_to === userId || (!fu.assigned_to && fu.created_by === userId);
      if (!isResponsible && !isUserAdmin) continue;

      const recipientId = isResponsible ? userId : (fu.assigned_to || userId);
      const fuDateStr = fu.scheduled_at ? fu.scheduled_at.slice(0, 10) : '';
      const fuTimeMs = new Date(fu.scheduled_at).getTime();

      // 1. Overdue: scheduled_at in the past
      if (fuTimeMs < nowMs) {
        const eventKey = `reminder_overdue_${fu.id}_${fuDateStr}`;
        await createNotification({
          recipient_id: recipientId,
          type: 'followup_overdue',
          title: 'Overdue Follow-up',
          message: `Pending follow-up "${fu.action}" for ${fu.company_name || 'Lead'} was scheduled on ${new Date(fu.scheduled_at).toLocaleDateString()} and is now overdue.`,
          lead_id: fu.lead_id,
          lead_company_name: fu.company_name,
          follow_up_id: fu.id,
          event_key: eventKey,
        });

        // If user is admin and follow-up belongs to another salesman, notify admin of critical overdue
        if (isUserAdmin && fu.assigned_to && fu.assigned_to !== userId) {
          const adminEventKey = `admin_escalate_overdue_${fu.id}_${fuDateStr}`;
          await createNotification({
            recipient_id: userId,
            type: 'followup_overdue',
            title: 'Team Overdue Follow-up Alert',
            message: `${fu.assigned_to_name || 'Representative'} has an overdue follow-up for ${fu.company_name || 'Lead'}.`,
            lead_id: fu.lead_id,
            lead_company_name: fu.company_name,
            follow_up_id: fu.id,
            event_key: adminEventKey,
          });
        }
      }
      // 2. Due Today
      else if (fuDateStr === todayDateStr) {
        const eventKey = `reminder_due_${fu.id}_${todayDateStr}`;
        await createNotification({
          recipient_id: recipientId,
          type: 'followup_due_today',
          title: 'Follow-up Due Today',
          message: `Follow-up "${fu.action}" with ${fu.company_name || 'Lead'} is scheduled for today.`,
          lead_id: fu.lead_id,
          lead_company_name: fu.company_name,
          follow_up_id: fu.id,
          event_key: eventKey,
        });
      }
      // 3. Upcoming within 24 hours
      else if (fuTimeMs > nowMs && fuTimeMs - nowMs < 24 * 3600000) {
        const eventKey = `reminder_upcoming_${fu.id}_${fuDateStr}`;
        await createNotification({
          recipient_id: recipientId,
          type: 'upcoming_followup',
          title: 'Upcoming Follow-up',
          message: `Follow-up "${fu.action}" with ${fu.company_name || 'Lead'} is scheduled in the next 24 hours.`,
          lead_id: fu.lead_id,
          lead_company_name: fu.company_name,
          follow_up_id: fu.id,
          event_key: eventKey,
        });
      }
    }
  } catch (e) {
    console.warn('checkAndGenerateFollowUpReminders notice:', e);
  }
}

// ==========================================
// 8. Phase M: Administrative Audit Log API
// ==========================================

/**
 * Creates an immutable audit log record.
 * Writes to local synchronizer cache and persists to Firestore /audit_logs.
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLogRecord> {
  const performerId = input.performed_by || getEffectiveUserId();
  const performerName = input.performed_by_name || getUserDisplayName(performerId);
  const performerRole = input.performed_by_role || getEffectiveUserRole();
  const now = new Date().toISOString();
  const generatedId = 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const record: AuditLogRecord = {
    id: generatedId,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    performed_by: performerId,
    performed_by_name: performerName,
    performed_by_role: performerRole,
    target_user_id: input.target_user_id,
    target_user_name: input.target_user_name,
    lead_id: input.lead_id,
    lead_company_name: input.lead_company_name,
    description: input.description,
    metadata: input.metadata || {},
    created_at: now,
  };

  // 1. Save to local audit cache immediately
  const localLogs = getLocalAuditLogs();
  setLocalAuditLogs([record, ...localLogs]);

  // 2. Persist to Firestore root /audit_logs
  try {
    const auditCol = collection(db, 'audit_logs');
    const { id, ...data } = record;
    const docRef = await addDoc(auditCol, data);
    if (docRef.id) {
      record.id = docRef.id;
    }
  } catch (err) {
    console.warn('Firestore createAuditLog local fallback notice:', err);
  }

  return record;
}

/**
 * Retrieves audit logs with optional filters and RBAC enforcement.
 * Only administrators can query audit logs.
 */
export async function getAuditLogs(options?: {
  limitCount?: number;
  action?: string;
  performerId?: string;
  entityType?: string;
  userRole?: UserRole;
}): Promise<AuditLogRecord[]> {
  const isUserAdmin = isUserAdminOrSuper(options?.userRole);

  if (!isUserAdmin) {
    // Record security audit log for unauthorized query attempt
    await recordSecurityAuditLog({
      action: 'security_unauthorized_action',
      description: `Access Denied: Non-administrator user ${getEffectiveUserName()} (${getEffectiveUserId()}) attempted to query Audit Logs.`,
      metadata: { requested_action: 'getAuditLogs', blocked_at: new Date().toISOString() },
    });
    throw new Error('Access Denied: Administrator privileges are required to view Audit Logs.');
  }

  let logs = getLocalAuditLogs();

  try {
    const auditCol = collection(db, 'audit_logs');
    const q = query(auditCol, orderBy('created_at', 'desc'), limit(options?.limitCount || 100));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const firestoreLogs: AuditLogRecord[] = [];
      snap.forEach((docSnap) => {
        firestoreLogs.push({ id: docSnap.id, ...docSnap.data() } as AuditLogRecord);
      });
      // Merge & deduplicate
      const map = new Map<string, AuditLogRecord>();
      firestoreLogs.forEach((l) => map.set(l.id, l));
      logs.forEach((l) => {
        if (!map.has(l.id)) map.set(l.id, l);
      });
      logs = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setLocalAuditLogs(logs);
    }
  } catch (e) {
    console.warn('Firestore getAuditLogs fallback notice:', e);
  }

  if (options?.action && options.action !== 'all') {
    logs = logs.filter((l) => l.action === options.action);
  }
  if (options?.performerId && options.performerId !== 'all') {
    logs = logs.filter((l) => l.performed_by === options.performerId);
  }
  if (options?.entityType && options.entityType !== 'all') {
    logs = logs.filter((l) => l.entity_type === options.entityType);
  }

  if (options?.limitCount) {
    logs = logs.slice(0, options.limitCount);
  }

  return logs;
}

/**
 * Real-time subscription to audit logs with instant local synchronization.
 * Only administrators can subscribe to audit logs.
 */
export function subscribeToAuditLogs(
  onUpdate: (logs: AuditLogRecord[]) => void,
  onError?: (err: any) => void,
  limitCount: number = 100
): () => void {
  const isUserAdmin = isUserAdminOrSuper();
  if (!isUserAdmin) {
    onUpdate([]);
    if (onError) onError(new Error('Access Denied: Administrator privileges required.'));
    return () => {};
  }

  const handleLogsChanged = () => {
    onUpdate(getLocalAuditLogs().slice(0, limitCount));
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_audit_logs_changed', handleLogsChanged);
  }

  // Initial local push
  onUpdate(getLocalAuditLogs().slice(0, limitCount));

  let firestoreUnsub: Unsubscribe = () => {};
  try {
    const auditCol = collection(db, 'audit_logs');
    const q = query(auditCol, orderBy('created_at', 'desc'), limit(limitCount));
    firestoreUnsub = onSnapshot(
      q,
      (snap) => {
        const firestoreLogs: AuditLogRecord[] = [];
        snap.forEach((docSnap) => {
          firestoreLogs.push({ id: docSnap.id, ...docSnap.data() } as AuditLogRecord);
        });
        if (firestoreLogs.length > 0) {
          const localLogs = getLocalAuditLogs();
          const map = new Map<string, AuditLogRecord>();
          firestoreLogs.forEach((l) => map.set(l.id, l));
          localLogs.forEach((l) => {
            if (!map.has(l.id)) map.set(l.id, l);
          });
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setLocalAuditLogs(merged);
          onUpdate(merged.slice(0, limitCount));
        }
      },
      (err) => {
        console.warn('Firestore subscribeToAuditLogs fallback notice:', err);
        onUpdate(getLocalAuditLogs().slice(0, limitCount));
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore subscribeToAuditLogs onSnapshot:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_audit_logs_changed', handleLogsChanged);
    }
  };
}

/**
 * Records an immutable security event into the audit trail.
 */
export async function recordSecurityAuditLog(input: {
  action: string;
  entity_type?: AuditEntityType;
  entity_id?: string;
  description: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const userId = getEffectiveUserId();
    const userName = getEffectiveUserName();
    const userRole = getEffectiveUserRole();
    await createAuditLog({
      action: input.action,
      entity_type: input.entity_type || 'Security',
      entity_id: input.entity_id || 'sec_' + Date.now(),
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: userRole,
      description: input.description,
      metadata: {
        ...input.metadata,
        timestamp: new Date().toISOString(),
        user_role: userRole,
      },
    });
  } catch (e) {
    console.warn('recordSecurityAuditLog non-blocking notice:', e);
  }
}

// ----------------------------------------------------------------------
// Phase O: Client Management & Conversion Operations
// ----------------------------------------------------------------------

/**
 * Converts a qualified won lead into an official customer Client record.
 * Crucial invariants:
 * 1. The original Lead is NOT deleted or replaced. It is preserved as the historical source of truth.
 * 2. Duplicate conversion is prevented via source_lead_id checks.
 * 3. Client ownership follows the Lead's responsible Salesman at conversion.
 * 4. Automatic Lead timeline activity and Audit Log entries are recorded.
 */
export async function createClientFromLead(
  input: CreateClientFromLeadInput,
  currentUserRole?: UserRole
): Promise<ClientRecord> {
  const currentUserId = getEffectiveUserId();
  const currentUserName = getEffectiveUserName();
  const role = currentUserRole || getEffectiveUserRole();
  const isAdmin = isUserAdminOrSuper(currentUserRole);

  // 1. Validate source lead exists
  const sourceLead = await getLeadById(input.lead_id, role);
  if (!sourceLead) {
    throw new Error('Source lead not found or access is restricted.');
  }

  const effectiveCompany = sourceLead.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const now = new Date().toISOString();

  // 2. Normalize lead phone for duplicate checking
  const rawPhone = input.phone !== undefined ? input.phone : (sourceLead.phone || '');
  const normalizedPhone = normalizePhone(rawPhone);

  // 3. Primary check: company_id + normalized_phone
  // Before creating a Client, check whether a matching Client already exists in the SAME company.
  const localClients = getLocalClients();
  let existingClient: ClientRecord | undefined = undefined;

  if (normalizedPhone && normalizedPhone.length >= 7) {
    existingClient = localClients.find(
      (c) =>
        c.record_status !== 'merged' &&
        (c.company_id || DEFAULT_COMPANY_ID) === effectiveCompany &&
        (c.normalized_phone === normalizedPhone || phonesMatch(c.phone, rawPhone))
    );
  }

  // Also check if this lead was already converted or has a source_client_id
  if (!existingClient && (sourceLead.converted_to_client_id || sourceLead.source_client_id || sourceLead.client_id)) {
    const matchedId = sourceLead.converted_to_client_id || sourceLead.source_client_id || sourceLead.client_id;
    existingClient = localClients.find((c) => c.id === matchedId && c.record_status !== 'merged');
  }

  // Also check Firestore for safety if not in local cache
  if (!existingClient && normalizedPhone && normalizedPhone.length >= 7) {
    try {
      const clientsRef = collection(db, 'clients');
      const q = query(
        clientsRef,
        where('company_id', '==', effectiveCompany),
        where('normalized_phone', '==', normalizedPhone)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const found = { id: snap.docs[0].id, ...snap.docs[0].data() } as ClientRecord;
        if (found.record_status !== 'merged') {
          existingClient = found;
        }
      }
    } catch (fsErr) {
      console.warn('Firestore duplicate check during conversion notice:', fsErr);
    }
  }

  // =========================================================================
  // CASE A: Client ALREADY EXISTS -> DO NOT CREATE DUPLICATE CLIENT
  // Instead: Link the Won Lead to the existing Client.
  // Preserve the existing Client owner unless the business workflow explicitly requires ownership transfer.
  // =========================================================================
  if (existingClient) {
    const targetClientId = existingClient.id;

    // Update existing client related leads and last activity
    const relatedLeadsSet = new Set(existingClient.related_lead_ids || []);
    relatedLeadsSet.add(sourceLead.id);

    const clientUpdatePayload: Partial<ClientRecord> = {
      related_lead_ids: Array.from(relatedLeadsSet),
      last_activity_at: now,
      last_communication_at: now,
      updated_at: now,
    };

    // If explicit owner reassignment was provided by Admin, honor it; otherwise preserve existing owner
    if (isAdmin && input.owner_id && input.owner_id !== existingClient.owner_id) {
      clientUpdatePayload.owner_id = input.owner_id;
      clientUpdatePayload.owner_name = getUserDisplayName(input.owner_id);
    }

    const updatedClient: ClientRecord = {
      ...existingClient,
      ...clientUpdatePayload,
    };

    // Update local cache
    const updatedLocal = localClients.map((c) => (c.id === targetClientId ? updatedClient : c));
    setLocalClients(updatedLocal);

    // Sync client update to Firestore
    try {
      const docRef = doc(db, 'clients', targetClientId);
      await updateDoc(docRef, clientUpdatePayload as any);
    } catch (err) {
      console.warn('Firestore update existing client on lead conversion notice:', err);
    }

    // Link the Won Lead to this existing Client
    try {
      await updateLead(sourceLead.id, {
        converted_to_client_id: targetClientId,
        client_id: targetClientId,
        converted_at: now,
        converted_by: currentUserId,
      });
    } catch (err) {
      console.warn('Failed to link lead to existing client:', err);
    }

    // Client Activity: Won Deal Linked
    try {
      await createActivity({
        client_id: targetClientId,
        client_name: updatedClient.company_name,
        company_name: updatedClient.company_name,
        activity_type: 'Other',
        description: `Won Deal Linked: "${sourceLead.project_name || sourceLead.company_name}"`,
        outcome: 'Won Deal Linked',
        notes: `Won Lead (Deal value: SAR ${(sourceLead.estimated_value || sourceLead.final_value || 0).toLocaleString()}) successfully linked to client portfolio by ${currentUserName}. Preserved client owner: ${updatedClient.owner_name || 'Sales Representative'}.`,
        performed_by: currentUserId,
        performed_by_name: currentUserName,
        activity_date: now,
        activity_at: now,
        is_system_activity: true,
        metadata: {
          client_id: targetClientId,
          lead_id: sourceLead.id,
          project_name: sourceLead.project_name || sourceLead.company_name,
          owner_id: updatedClient.owner_id,
          deal_value: sourceLead.estimated_value || sourceLead.final_value,
        },
      });
    } catch (actErr) {
      console.warn('Won deal linked client activity error:', actErr);
    }

    // Lead Activity: Linked to Existing Client
    try {
      await createActivity({
        lead_id: sourceLead.id,
        activity_type: 'Other',
        description: `Lead Won & Linked to Existing Client: ${updatedClient.company_name}`,
        notes: `Won project linked to existing client account "${updatedClient.company_name}" (Account owner: ${updatedClient.owner_name || 'Team member'}). No duplicate client created.`,
        outcome: 'Won Deal Linked',
        performed_by: currentUserId,
        performed_by_name: currentUserName,
        activity_date: now,
        activity_at: now,
        is_system_activity: true,
      });
    } catch (leadActErr) {
      console.warn('Won deal lead activity notice:', leadActErr);
    }

    // Audit Log: lead_linked_to_client
    try {
      await createAuditLog({
        action: 'lead_linked_to_client',
        entity_type: 'Client',
        entity_id: targetClientId,
        lead_id: sourceLead.id,
        lead_company_name: sourceLead.company_name,
        performed_by: currentUserId,
        performed_by_name: currentUserName,
        performed_by_role: role,
        target_user_id: updatedClient.owner_id,
        target_user_name: updatedClient.owner_name,
        description: `Won Lead "${sourceLead.project_name || sourceLead.company_name}" linked to existing Client "${updatedClient.company_name}" by ${currentUserName} (${role}). Duplicate creation prevented.`,
      });
    } catch (auditErr) {
      console.warn('Audit log lead_linked_to_client error:', auditErr);
    }

    return updatedClient;
  }

  // =========================================================================
  // CASE B: NO CLIENT EXISTS -> CREATE NEW CLIENT & LINK LEAD
  // =========================================================================
  // Client Ownership: Must follow the Lead's responsible Salesman at conversion
  // company_id = Lead company_id
  // owner_id = Lead owner/assigned salesperson
  // owner_name = Lead owner name
  const assignedOwnerId = input.owner_id || sourceLead.assigned_to || currentUserId;
  const ownerName = getUserDisplayName(assignedOwnerId);

  const generatedId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  const newClientData: ClientRecord = {
    id: generatedId,
    company_id: effectiveCompany,
    company_name: (input.company_name || sourceLead.company_name).trim(),
    name: input.contact_person !== undefined ? input.contact_person : (sourceLead.contact_person || ''),
    contact_person: input.contact_person !== undefined ? input.contact_person : (sourceLead.contact_person || ''),
    phone: rawPhone,
    whatsapp: input.whatsapp !== undefined ? input.whatsapp : (sourceLead.whatsapp || ''),
    email: input.email !== undefined ? input.email : (sourceLead.email || ''),
    location: input.location !== undefined ? input.location : (sourceLead.location || ''),
    address: input.address !== undefined ? input.address : (sourceLead.location || ''),
    client_type: input.client_type || sourceLead.lead_type || 'b2b',
    source: input.source || 'Converted Won Lead',
    source_lead_id: sourceLead.id,
    related_lead_ids: [sourceLead.id],
    owner_id: assignedOwnerId,
    owner_name: ownerName,
    status: input.status || 'Active',
    notes: input.notes !== undefined ? input.notes : (sourceLead.notes || ''),
    record_status: 'active',
    normalized_phone: normalizedPhone,
    normalized_whatsapp: normalizePhone(input.whatsapp !== undefined ? input.whatsapp : sourceLead.whatsapp),
    normalized_email: normalizeEmail(input.email !== undefined ? input.email : sourceLead.email),
    normalized_company_name: normalizeCompanyName(input.company_name || sourceLead.company_name),
    created_by: currentUserId,
    created_by_name: currentUserName,
    converted_by: currentUserId,
    converted_by_name: currentUserName,
    converted_at: now,
    created_at: now,
    updated_at: now,
    last_activity_at: now,
    last_communication_at: now,
    tags: sourceLead.tags || [],
  };

  // Immediate save to local cache
  const localList = getLocalClients();
  localList.unshift(newClientData);
  setLocalClients(localList);

  // Sync to Firestore
  try {
    const clientsCollectionRef = collection(db, 'clients');
    const { id, ...dataToSync } = newClientData;
    const docRef = await addDoc(clientsCollectionRef, dataToSync);
    if (docRef.id) {
      newClientData.id = docRef.id;
      const updatedLocal = getLocalClients().map((c) => (c.id === generatedId ? newClientData : c));
      setLocalClients(updatedLocal);
    }
  } catch (err) {
    console.warn('Firestore createClientFromLead background sync notice:', err);
  }

  // Update source Lead with converted_to_client_id and client_id
  try {
    await updateLead(sourceLead.id, {
      converted_to_client_id: newClientData.id,
      client_id: newClientData.id,
      converted_at: now,
      converted_by: currentUserId,
    });
  } catch (err) {
    console.warn('Failed to link lead to converted client:', err);
  }

  // Client Activity
  try {
    await createActivity({
      client_id: newClientData.id,
      client_name: newClientData.company_name,
      company_name: newClientData.company_name,
      activity_type: 'Other',
      description: `Client Account Created from Won Lead: ${newClientData.company_name}`,
      notes: `Account successfully created and assigned to ${ownerName} by ${currentUserName}.`,
      outcome: 'Account Created',
      performed_by: currentUserId,
      performed_by_name: currentUserName,
      activity_date: now,
      activity_at: now,
      is_system_activity: true,
      metadata: {
        client_id: newClientData.id,
        source_lead_id: sourceLead.id,
        owner_id: newClientData.owner_id,
        owner_name: ownerName,
      },
    });
  } catch (actErr) {
    console.warn('Initial client conversion activity notice:', actErr);
  }

  // Lead Activity
  try {
    await createActivity({
      lead_id: sourceLead.id,
      activity_type: 'Other',
      description: `Lead Converted to Client: ${newClientData.company_name}`,
      notes: `Account successfully converted to official active Client portfolio by ${currentUserName}. Client ID: ${newClientData.id}. Assigned Client Owner: ${ownerName}.`,
      outcome: 'Converted to Client',
      performed_by: currentUserId,
      performed_by_name: currentUserName,
      activity_date: now,
      activity_at: now,
      is_system_activity: true,
      new_value: 'Client Converted',
      metadata: {
        client_id: newClientData.id,
        owner_id: newClientData.owner_id,
        owner_name: ownerName,
        status: newClientData.status,
      },
    });
  } catch (actErr) {
    console.warn('Initial client conversion activity notice:', actErr);
  }

  // Record an immutable Audit Log
  try {
    await createAuditLog({
      action: 'lead_converted_to_client',
      entity_type: 'Client',
      entity_id: newClientData.id,
      lead_id: sourceLead.id,
      lead_company_name: sourceLead.company_name,
      performed_by: currentUserId,
      performed_by_name: currentUserName,
      performed_by_role: role,
      target_user_id: newClientData.owner_id,
      target_user_name: ownerName,
      description: `Lead "${sourceLead.company_name}" successfully converted to Client by ${currentUserName} (${role}). Assigned portfolio owner: ${ownerName}.`,
      metadata: {
        client_id: newClientData.id,
        source_lead_id: sourceLead.id,
        client_status: newClientData.status,
        owner_id: newClientData.owner_id,
        owner_name: ownerName,
        converted_by: currentUserId,
      },
    });
  } catch (auditErr) {
    console.warn('Conversion audit log notice:', auditErr);
  }

  // 7. If converted by Admin for a different salesman, send notification
  if (newClientData.owner_id !== currentUserId) {
    try {
      await createNotification({
        recipient_id: newClientData.owner_id,
        recipient_name: ownerName,
        type: 'general',
        title: 'New Client Account Assigned',
        message: `${newClientData.company_name} was converted from Lead to Client and assigned to your portfolio.`,
        lead_id: sourceLead.id,
        lead_company_name: sourceLead.company_name,
        event_key: `client_assigned_${newClientData.id}_${newClientData.owner_id}`,
      });
    } catch (notifErr) {
      console.warn('Client assignment notification notice:', notifErr);
    }
  }

  return newClientData;
}

/**
 * Fetches a single Client record by ID with strict ownership validation for Salesmen.
 */
export async function getClientById(clientId: string, userRole?: UserRole): Promise<ClientRecord | null> {
  const localList = getLocalClients();
  const local = localList.find((c) => c.id === clientId);
  const userId = getEffectiveUserId();
  const role = userRole || getEffectiveUserRole();
  const isSuper = role === 'SUPER_ADMIN';
  const isAdmin = isUserAdminOrSuper(role);
  const effectiveCompany = getEffectiveCompanyId() || DEFAULT_COMPANY_ID;

  // Tenant company isolation check
  if (local && !isSuper && local.company_id && local.company_id !== effectiveCompany) {
    return null;
  }

  // Security Policy Check: Non-admins cannot access clients not owned by them
  if (local && !isAdmin && local.owner_id !== userId) {
    try {
      await recordSecurityAuditLog({
        action: 'security_unauthorized_client_access',
        entity_type: 'Security',
        entity_id: clientId,
        description: `Security Notice: Sales representative ${getEffectiveUserName()} (${userId}) attempted unauthorized direct access to Client "${local.company_name}" (${clientId}).`,
        metadata: {
          attempted_client_id: clientId,
          client_company_name: local.company_name,
          client_owner_id: local.owner_id,
          action: 'getClientById',
          status: 'BLOCKED',
        },
      });
    } catch (e) {
      // non-blocking
    }
    return null;
  }

  try {
    const docRef = doc(db, 'clients', clientId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const fsClient = { id: snap.id, ...snap.data() } as ClientRecord;
      if (!isSuper && fsClient.company_id && fsClient.company_id !== effectiveCompany) {
        return null;
      }
      if (!isAdmin && fsClient.owner_id !== userId) {
        return null;
      }
      const updated = localList.map((c) => (c.id === clientId ? fsClient : c));
      if (!local) updated.unshift(fsClient);
      setLocalClients(updated);
      return fsClient;
    }
  } catch (e) {
    console.warn('getClientById Firestore fetch fallback:', e);
  }

  return local || null;
}

/**
 * Finds a client created from a specific source lead ID within the company.
 */
export async function getClientBySourceLeadId(leadId: string): Promise<ClientRecord | null> {
  const effectiveCompany = getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const localList = getLocalClients();
  const found = localList.find(
    (c) => c.source_lead_id === leadId && (c.company_id || DEFAULT_COMPANY_ID) === effectiveCompany
  );
  if (found) return found;

  try {
    const clientsRef = collection(db, 'clients');
    const q = query(
      clientsRef,
      where('company_id', '==', effectiveCompany),
      where('source_lead_id', '==', leadId),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const client = { id: docSnap.id, ...docSnap.data() } as ClientRecord;
      return client;
    }
  } catch (e) {
    console.warn('getClientBySourceLeadId fallback notice:', e);
  }

  return null;
}

/**
 * Returns all related leads for a client account across:
 * - Direct parent client link: lead.client_id === clientId
 * - Converted lead link: lead.converted_to_client_id === clientId
 * - Repeat opportunity link: lead.source_client_id === clientId
 * - Reverse source link: client.source_lead_id === lead.id
 * - Related lead IDs array: client.related_lead_ids.includes(lead.id)
 */
export function getRelatedLeadsForClient(clientId: string, allLeads?: LeadRecord[]): LeadRecord[] {
  const leads = allLeads || getLocalLeads();
  const client = getLocalClients().find((c) => c.id === clientId);
  return leads.filter(
    (l) =>
      l.record_status !== 'deleted' &&
      (l.client_id === clientId ||
        l.source_client_id === clientId ||
        l.converted_to_client_id === clientId ||
        (client?.source_lead_id && l.id === client.source_lead_id) ||
        (client?.related_lead_ids && client.related_lead_ids.includes(l.id)))
  );
}

/**
 * Identifies if another salesman in the same company owns a client matching the search term.
 * Used for Salesman workspace conflict detection without exposing confidential details.
 */
export function findCompanyClientConflict(
  searchTerm: string,
  currentUserId: string,
  companyId?: string
): { hasConflict: boolean; client?: ClientRecord; reason?: string } {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return { hasConflict: false };
  }
  const effectiveCompany = companyId || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const term = searchTerm.trim().toLowerCase();
  const normTermPhone = normalizePhone(searchTerm);
  const clients = getLocalClients().filter(
    (c) =>
      (c.company_id || DEFAULT_COMPANY_ID) === effectiveCompany &&
      c.record_status !== 'merged' &&
      c.owner_id !== currentUserId
  );

  for (const c of clients) {
    // Phone match
    if (normTermPhone && normTermPhone.length >= 7 && (c.normalized_phone === normTermPhone || phonesMatch(c.phone, searchTerm))) {
      return {
        hasConflict: true,
        client: c,
        reason: `This client already exists and is currently assigned to ${c.owner_name || 'another representative'}.`,
      };
    }
    // Company name or contact person match
    if (
      c.company_name?.toLowerCase().includes(term) ||
      c.contact_person?.toLowerCase().includes(term) ||
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    ) {
      return {
        hasConflict: true,
        client: c,
        reason: `This client already exists and is currently assigned to ${c.owner_name || 'another representative'}.`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Retrieves client records with role scoping and optional filters.
 */
export async function getClients(options?: {
  owner_id?: string;
  userRole?: UserRole;
  limitCount?: number;
  includeMerged?: boolean;
  companyIdOverride?: string;
}): Promise<ClientRecord[]> {
  const userId = getEffectiveUserId();
  const currentRole = options?.userRole || getEffectiveUserRole();
  const isSuper = currentRole === 'SUPER_ADMIN';
  const isUserAdmin = isUserAdminOrSuper(currentRole);
  const effectiveCompany = options?.companyIdOverride || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;

  let local = getLocalClients();
  // Tenant company isolation: Super admin can inspect all, everyone else is locked to company
  if (!isSuper || options?.companyIdOverride) {
    local = local.filter((c) => (c.company_id || DEFAULT_COMPANY_ID) === effectiveCompany);
  }
  if (!options?.includeMerged) {
    local = local.filter((c) => c.record_status !== 'merged');
  }
  if (!isUserAdmin) {
    local = local.filter((c) => c.owner_id === userId);
  } else if (options?.owner_id) {
    local = local.filter((c) => c.owner_id === options.owner_id);
  }
  if (options?.limitCount) {
    local = local.slice(0, options.limitCount);
  }
  return local;
}

/**
 * Subscribes to the clients collection with automatic role filtering and company tenant isolation.
 * Admin sees company clients; Salesman sees only their owned clients.
 */
export function subscribeToClients(
  onUpdate: (clients: ClientRecord[]) => void,
  userRole?: UserRole,
  onError?: (err: Error) => void,
  targetUserId?: string,
  includeMerged: boolean = false,
  companyIdOverride?: string
): Unsubscribe {
  const userId = targetUserId || getEffectiveUserId();
  const currentRole = userRole || getEffectiveUserRole();
  const isSuper = currentRole === 'SUPER_ADMIN';
  const isUserAdmin = isUserAdminOrSuper(currentRole);
  const effectiveCompany = companyIdOverride || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;

  const filterAndEmit = (rawList: ClientRecord[]) => {
    let filtered = rawList;
    if (!isSuper || companyIdOverride) {
      filtered = filtered.filter((c) => (c.company_id || DEFAULT_COMPANY_ID) === effectiveCompany);
    }
    if (!includeMerged) {
      filtered = filtered.filter((c) => c.record_status !== 'merged');
    }
    if (!isUserAdmin) {
      filtered = filtered.filter((c) => c.owner_id === userId);
    }
    onUpdate(filtered);
  };

  // Immediate push from local storage
  filterAndEmit(getLocalClients());

  const handleCustomEvent = () => {
    filterAndEmit(getLocalClients());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_clients_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const clientsRef = collection(db, 'clients');
    let q;
    if (!isUserAdmin) {
      if (effectiveCompany) {
        q = query(clientsRef, where('company_id', '==', effectiveCompany), where('owner_id', '==', userId));
      } else {
        q = query(clientsRef, where('owner_id', '==', userId));
      }
    } else if (!isSuper && effectiveCompany) {
      q = query(clientsRef, where('company_id', '==', effectiveCompany));
    } else {
      q = query(clientsRef);
    }

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsClients: ClientRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsClients.push({ id: docSnap.id, ...docSnap.data() } as ClientRecord);
        });

        // Merge Firestore results with local clients
        const map = new Map<string, ClientRecord>();
        const localList = getLocalClients();
        localList.forEach((c) => map.set(c.id, c));
        fsClients.forEach((c) => map.set(c.id, c));

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setLocalClients(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore clients subscription fallback:', err);
        filterAndEmit(getLocalClients());
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('Could not establish Firestore clients onSnapshot:', err);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_clients_changed', handleCustomEvent);
    }
  };
}

/**
 * Real-time listener for a single client document.
 */
export function subscribeToSingleClient(
  clientId: string,
  onUpdate: (client: ClientRecord | null) => void,
  onError?: (err: Error) => void,
  userRole?: UserRole,
  targetUserId?: string
): Unsubscribe {
  const userId = targetUserId || getEffectiveUserId();
  const isUserAdmin = isUserAdminOrSuper(userRole);

  // Push local version immediately if authorized
  const localList = getLocalClients();
  const found = localList.find((c) => c.id === clientId) || null;
  if (found && !isUserAdmin && found.owner_id !== userId) {
    onUpdate(null);
    if (onError) onError(new Error('Access Notice: You do not have permission to view this customer account.'));
    return () => {};
  }
  if (found) {
    onUpdate(found);
  }

  const handleClientsChanged = () => {
    const freshLocal = getLocalClients().find((c) => c.id === clientId) || null;
    if (freshLocal && !isUserAdmin && freshLocal.owner_id !== userId) {
      onUpdate(null);
      if (onError) onError(new Error('Access Notice: You do not have permission to view this customer account.'));
      return;
    }
    if (freshLocal) {
      onUpdate(freshLocal);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_clients_changed', handleClientsChanged);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const clientDocRef = doc(db, 'clients', clientId);
    firestoreUnsub = onSnapshot(
      clientDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const client = { id: docSnap.id, ...docSnap.data() } as ClientRecord;
          if (!isUserAdmin && client.owner_id !== userId) {
            onUpdate(null);
            if (onError) onError(new Error('Access Notice: You do not have permission to view this customer account.'));
            return;
          }
          const currentLocal = getLocalClients();
          const exists = currentLocal.some((c) => c.id === client.id);
          const updated = exists
            ? currentLocal.map((c) => (c.id === client.id ? client : c))
            : [client, ...currentLocal];
          setLocalClients(updated);
          onUpdate(client);
        } else {
          // Fallback to local cache if document not yet synced to Firestore
          const freshLocal = getLocalClients().find((c) => c.id === clientId) || null;
          if (freshLocal) {
            if (!isUserAdmin && freshLocal.owner_id !== userId) {
              onUpdate(null);
              if (onError) onError(new Error('Access Notice: You do not have permission to view this customer account.'));
              return;
            }
            onUpdate(freshLocal);
          } else {
            onUpdate(null);
          }
        }
      },
      (err) => {
        console.warn('Firestore subscribeToSingleClient fallback:', err);
        const freshLocal = getLocalClients().find((c) => c.id === clientId) || null;
        if (freshLocal) {
          if (!isUserAdmin && freshLocal.owner_id !== userId) {
            onUpdate(null);
            if (onError) onError(new Error('Access Notice: You do not have permission to view this customer account.'));
            return;
          }
          onUpdate(freshLocal);
        } else {
          onUpdate(null);
          if (onError) onError(err);
        }
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore single client onSnapshot:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_clients_changed', handleClientsChanged);
    }
  };
}

/**
 * Updates client profile fields (excluding immutable owner_id & source_lead_id for salesmen).
 */
export async function updateClient(
  clientId: string,
  input: UpdateClientInput,
  currentClient?: ClientRecord
): Promise<void> {
  const current = currentClient || (await getClientById(clientId));
  if (!current) throw new Error('Client record not found.');

  const now = new Date().toISOString();
  const updatePayload: any = {
    ...input,
    updated_at: now,
  };

  if (input.phone !== undefined) {
    updatePayload.normalized_phone = normalizePhone(input.phone);
  }
  if (input.whatsapp !== undefined) {
    updatePayload.normalized_whatsapp = normalizePhone(input.whatsapp);
  }
  if (input.email !== undefined) {
    updatePayload.normalized_email = normalizeEmail(input.email);
  }
  if (input.company_name !== undefined) {
    updatePayload.normalized_company_name = normalizeCompanyName(input.company_name);
  }

  // Update local cache
  const localList = getLocalClients();
  const updated = localList.map((c) => (c.id === clientId ? { ...c, ...updatePayload } : c));
  setLocalClients(updated);

  // Async update Firestore
  try {
    const docRef = doc(db, 'clients', clientId);
    await updateDoc(docRef, updatePayload);
  } catch (err) {
    console.warn('Firestore updateClient fallback notice:', err);
  }

  // If status changed, create an audit log
  if (input.status && input.status !== current.status) {
    try {
      const performerId = getEffectiveUserId();
      const performerName = getEffectiveUserName();
      const performerRole = getEffectiveUserRole();
      await createAuditLog({
        action: 'client_status_changed',
        entity_type: 'Client',
        entity_id: clientId,
        performed_by: performerId,
        performed_by_name: performerName,
        performed_by_role: performerRole,
        target_user_id: current.owner_id,
        target_user_name: current.owner_name,
        description: `Client "${current.company_name}" status updated from ${current.status} to ${input.status} by ${performerName}.`,
        metadata: {
          client_id: clientId,
          previous_status: current.status,
          new_status: input.status,
        },
      });
    } catch (auditErr) {
      console.warn('client_status_changed audit log notice:', auditErr);
    }
  }
}

/**
 * Transfers Client portfolio ownership to another salesman.
 * Accessible to Admins, salesmen with CLIENTS_TRANSFER permission, or current client owner.
 * INVARIANT: Does NOT alter original Lead's assigned_to (preserves historical source lead purity).
 * All activities, follow-ups, and notes remain attached to this Client without duplication.
 */
export async function transferClientOwnership(input: TransferClientInput): Promise<void> {
  const client = await getClientById(input.client_id);
  if (!client) throw new Error('Client record not found.');

  if (!input.reason || !input.reason.trim()) {
    throw new Error('Transfer reason is required.');
  }

  if (client.owner_id && input.new_owner_id === client.owner_id) {
    throw new Error('Selected representative is already the current owner of this client.');
  }

  const actorId = getEffectiveUserId();
  const actorName = getEffectiveUserName();
  const actorProfile = await getUserProfile(actorId);
  const currentRole = actorProfile?.role || getEffectiveUserRole();

  const isOwner = client.owner_id === actorId;
  const hasTransferPerm = hasPermission(actorProfile, 'CLIENTS_TRANSFER');
  const isAdminOrSuper = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';

  if (!isAdminOrSuper && !hasTransferPerm && !isOwner) {
    throw new Error('Unauthorized: You do not have permission to transfer this client.');
  }

  // Cross-tenant protection & salesman role check: Target representative must belong to the same company and be active salesman
  const companyId = client.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const targetProfile = await getUserProfile(input.new_owner_id);
  if (targetProfile) {
    if (targetProfile.company_id && targetProfile.company_id !== companyId) {
      throw new Error('Cannot transfer client: Target representative belongs to a different company.');
    }
    if (targetProfile.role !== 'SALESMAN' && targetProfile.role !== 'sales_rep') {
      throw new Error('Cannot transfer client: Target representative must be an active salesman.');
    }
    if (targetProfile.is_active === false) {
      throw new Error('Cannot transfer client: Target representative is inactive.');
    }
  }

  const previousOwnerId = client.owner_id;
  const previousOwnerName = client.owner_name || getUserDisplayName(previousOwnerId);
  const newOwnerName = input.new_owner_name || getUserDisplayName(input.new_owner_id);
  const now = new Date().toISOString();

  const updatePayload = {
    owner_id: input.new_owner_id,
    owner_name: newOwnerName,
    updated_at: now,
  };

  // 1. Local cache update
  const localList = getLocalClients();
  const updated = localList.map((c) => (c.id === input.client_id ? { ...c, ...updatePayload } : c));
  setLocalClients(updated);

  // 2. Transfer Record creation
  const transferRecord: ClientTransferRecord = {
    id: 'ctr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    company_id: companyId,
    client_id: input.client_id,
    client_name: client.company_name,
    from_user_id: previousOwnerId,
    from_user_name: previousOwnerName,
    to_user_id: input.new_owner_id,
    to_user_name: newOwnerName,
    transferred_by: actorId,
    transferred_by_name: actorName,
    transferred_at: now,
    timestamp: now,
    reason: input.reason.trim(),
  };

  // Cache in local client transfers
  const localTransfers = getLocalClientTransfers();
  setLocalClientTransfers([transferRecord, ...localTransfers]);

  // 3. Firestore client doc update
  try {
    const docRef = doc(db, 'clients', input.client_id);
    await updateDoc(docRef, updatePayload);
  } catch (err) {
    console.warn('Firestore transferClientOwnership fallback:', err);
  }

  // 4. Save transfer record in subcollection
  try {
    const transferCol = collection(db, 'clients', input.client_id, 'transfers');
    const { id, ...data } = transferRecord;
    await addDoc(transferCol, data);
  } catch (e) {
    console.warn('Firestore client subcollection transfer fallback notice:', e);
  }

  // 5. Save transfer record in root collection
  try {
    const rootCol = doc(db, 'client_transfers', transferRecord.id);
    const { id, ...data } = transferRecord;
    await setDoc(rootCol, data);
  } catch (e) {
    console.warn('Firestore root client_transfers fallback notice:', e);
  }

  // Unified transfer record for company-level Communication Hub
  try {
    const unifiedCol = doc(db, 'transfers', transferRecord.id);
    await setDoc(unifiedCol, {
      id: transferRecord.id,
      company_id: companyId,
      record_type: 'CLIENT',
      record_id: input.client_id,
      record_name: client.company_name,
      from_user_id: previousOwnerId,
      from_user_name: previousOwnerName,
      to_user_id: input.new_owner_id,
      to_user_name: newOwnerName,
      transferred_by: actorId,
      transferred_by_name: actorName,
      reason: input.reason.trim(),
      transferred_at: now,
      timestamp: now,
    });
  } catch (e) {
    console.warn('Firestore root transfers fallback notice:', e);
  }

  // 6. Log activity on Client timeline (Section 10 Timeline Integration)
  try {
    await createActivity({
      client_id: input.client_id,
      client_name: client.company_name,
      company_name: client.company_name,
      activity_type: 'Transfer',
      description: `Client Transferred: ${previousOwnerName} → ${newOwnerName}${input.reason ? ` (Reason: ${input.reason})` : ''}`,
      notes: `Client transferred by ${actorName}. Reason: ${input.reason}`,
      outcome: 'Transferred',
      performed_by: actorId,
      performed_by_name: actorName,
      is_system_activity: true,
      previous_value: previousOwnerName,
      new_value: newOwnerName,
      metadata: {
        reason: input.reason.trim(),
        previous_owner_id: previousOwnerId,
        new_owner_id: input.new_owner_id,
        transfer_id: transferRecord.id,
      },
    });
  } catch (actErr) {
    console.warn('Client transfer timeline activity notice:', actErr);
  }

  // 7. Audit log
  try {
    await createAuditLog({
      action: 'client_ownership_transferred',
      entity_type: 'Client',
      entity_id: input.client_id,
      performed_by: actorId,
      performed_by_name: actorName,
      performed_by_role: currentRole as any,
      target_user_id: input.new_owner_id,
      target_user_name: newOwnerName,
      description: `${actorName} transferred ownership of Client "${client.company_name}" from ${previousOwnerName} to ${newOwnerName}. Reason: ${input.reason}. (Original lead historical record preserved).`,
      metadata: {
        client_id: input.client_id,
        source_lead_id: client.source_lead_id,
        previous_owner_id: previousOwnerId,
        previous_owner_name: previousOwnerName,
        new_owner_id: input.new_owner_id,
        new_owner_name: newOwnerName,
        reason: input.reason.trim(),
      },
    });
  } catch (auditErr) {
    console.warn('client_ownership_transferred audit log notice:', auditErr);
  }

  // 8. Notification to new owner (Section 11 Notifications)
  try {
    await createNotification({
      recipient_id: input.new_owner_id,
      title: 'Client Transferred to You',
      message: `${actorName} transferred the client ${client.company_name} to you.${input.reason ? ` Reason: ${input.reason}` : ''}`,
      type: 'general',
      lead_id: client.source_lead_id || undefined,
      event_key: `client_transfer_${input.client_id}_${input.new_owner_id}_${now}`,
    });
  } catch (notifErr) {
    console.warn('transferClientOwnership notification notice:', notifErr);
  }
}

// Aliases matching prompt conventions
export const transferClient = transferClientOwnership;

/**
 * Validates and checks for client duplicates within the same company.
 * Hard Duplicate: Normalized phone number matches an existing client in the same company.
 * Soft Warnings: Matching company name or email.
 */
export function checkClientPotentialDuplicateSync(
  input: { phone?: string; company_name?: string; email?: string },
  companyId?: string,
  excludeClientId?: string
): { isHardDuplicate: boolean; hardDuplicateReason?: string; softWarnings: string[]; existingMatch?: ClientRecord } {
  const targetCompanyId = companyId || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const localClients = getLocalClients();
  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);
  const normCompName = normalizeCompanyName(input.company_name);

  let isHardDuplicate = false;
  let hardDuplicateReason = '';
  const softWarnings: string[] = [];
  let existingMatch: ClientRecord | undefined;

  for (const c of localClients) {
    if (c.id === excludeClientId || c.record_status === 'merged') continue;
    if (c.company_id && c.company_id !== targetCompanyId) continue;

    // 1. Phone match - HARD DUPLICATE
    if (normPhone && (c.normalized_phone === normPhone || phonesMatch(c.phone, input.phone))) {
      isHardDuplicate = true;
      existingMatch = c;
      hardDuplicateReason = `Duplicate Protected: A client with this phone number already exists in your company ("${c.company_name}", owner: ${c.owner_name || 'Team member'}).`;
      break;
    }

    // 2. Email match - SOFT WARNING
    if (normEmail && c.email && normalizeEmail(c.email) === normEmail) {
      softWarnings.push(`Same email address exists on client "${c.company_name}" (Owner: ${c.owner_name || 'Team member'}).`);
    }

    // 3. Company name match - SOFT WARNING
    if (normCompName && c.company_name && normalizeCompanyName(c.company_name) === normCompName) {
      softWarnings.push(`A client with an identical company name "${c.company_name}" already exists in your company.`);
    }
  }

  return { isHardDuplicate, hardDuplicateReason, softWarnings, existingMatch };
}

/**
 * Creates a direct Client/Customer account from a Salesman or Admin.
 * Enforces company tenant isolation and hard duplicate rejection by normalized phone.
 */
export async function createClient(input: CreateClientInput): Promise<ClientRecord> {
  const currentUserId = getEffectiveUserId();
  const currentUserName = getEffectiveUserName();
  const currentRole = getEffectiveUserRole();
  const companyId = input.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;

  if (!input.company_name?.trim()) {
    throw new Error('Client / Company Name is required.');
  }
  if (!input.phone?.trim()) {
    throw new Error('Phone number is required for client account creation.');
  }

  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone || normalizedPhone.length < 7) {
    throw new Error('Please enter a valid phone number (at least 7-8 digits).');
  }

  // 1. DUPLICATE CHECK WITHIN SAME COMPANY (LOCAL CACHE)
  const dupCheck = checkClientPotentialDuplicateSync(
    { phone: input.phone, company_name: input.company_name, email: input.email },
    companyId
  );
  if (dupCheck.isHardDuplicate) {
    throw new Error(dupCheck.hardDuplicateReason);
  }

  // 2. DUPLICATE CHECK WITHIN SAME COMPANY (FIRESTORE)
  try {
    const clientsRef = collection(db, 'clients');
    const q = query(
      clientsRef,
      where('company_id', '==', companyId),
      where('normalized_phone', '==', normalizedPhone)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const matchDoc = snap.docs[0].data() as ClientRecord;
      if (matchDoc.record_status !== 'merged') {
        throw new Error(
          `Duplicate Client Protected: A client with this phone number already exists in your company ("${matchDoc.company_name}", owner: ${matchDoc.owner_name || 'Team member'}).`
        );
      }
    }
  } catch (fsCheckErr: any) {
    if (fsCheckErr.message && fsCheckErr.message.includes('Duplicate Client Protected')) {
      throw fsCheckErr;
    }
    console.warn('Firestore duplicate check fallback:', fsCheckErr);
  }

  const clientId = 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const isAdmin = isUserAdminOrSuper(currentRole);
  // Do NOT trust company_id or owner_id supplied by the browser for salesmen.
  const assignedOwnerId = isAdmin ? (input.owner_id || currentUserId) : currentUserId;
  const ownerName =
    assignedOwnerId === currentUserId ? currentUserName : (input.owner_name || getUserDisplayName(assignedOwnerId));

  const clientData: ClientRecord = {
    id: clientId,
    company_id: companyId,
    name: input.contact_person?.trim() || input.name?.trim() || '',
    company_name: input.company_name.trim(),
    contact_person: input.contact_person?.trim() || input.name?.trim() || '',
    phone: input.phone.trim(),
    whatsapp: input.whatsapp?.trim() || '',
    email: input.email?.trim() || '',
    location: input.location?.trim() || input.address?.trim() || '',
    address: input.address?.trim() || input.location?.trim() || '',
    client_type: input.client_type || 'Direct Customer',
    source: input.source || 'Direct Existing Customer',
    source_lead_id: '',
    related_lead_ids: [],
    owner_id: assignedOwnerId,
    owner_name: ownerName,
    status: input.status || 'Active',
    notes: input.notes?.trim() || '',
    created_by: currentUserId,
    created_by_name: currentUserName,
    created_at: now,
    updated_at: now,
    last_activity_at: now,
    last_communication_at: now,
    record_status: 'active',
    normalized_phone: normalizedPhone,
    normalized_whatsapp: normalizePhone(input.whatsapp),
    normalized_email: normalizeEmail(input.email),
    normalized_company_name: normalizeCompanyName(input.company_name),
    tags: input.tags || [],
  };

  // Update local cache
  const localClients = getLocalClients();
  setLocalClients([clientData, ...localClients]);

  // Sync to Firestore
  try {
    const docRef = doc(db, 'clients', clientId);
    const { id, ...dataToSave } = clientData;
    await setDoc(docRef, dataToSave);
  } catch (fsErr) {
    console.warn('Firestore createClient fallback:', fsErr);
  }

  // Initial timeline activity
  try {
    await createActivity({
      client_id: clientId,
      client_name: clientData.company_name,
      company_name: clientData.company_name,
      activity_type: 'Other',
      description: `Client account created by ${currentUserName} and assigned to ${ownerName}`,
      outcome: 'Account Created',
      notes: input.notes ? `Initial notes: ${input.notes}` : 'Direct client account established in CRM.',
      performed_by: currentUserId,
      performed_by_name: currentUserName,
      is_system_activity: true,
    });
  } catch (actErr) {
    console.warn('createClient initial activity error:', actErr);
  }

  // Audit log
  try {
    await createAuditLog({
      action: 'client_created',
      entity_type: 'Client',
      entity_id: clientId,
      performed_by: currentUserId,
      performed_by_name: currentUserName,
      performed_by_role: currentRole as any,
      target_user_id: assignedOwnerId,
      target_user_name: ownerName,
      description: `Client account "${clientData.company_name}" created by ${currentUserName} and assigned to ${ownerName}.`,
      metadata: {
        client_id: clientId,
        company_name: clientData.company_name,
        phone: clientData.phone,
        owner_id: assignedOwnerId,
        owner_name: ownerName,
      },
    });
  } catch (auditErr) {
    console.warn('createClient audit log error:', auditErr);
  }

  return clientData;
}

/**
 * Creates a new sales opportunity (Lead) linked directly to a Client.
 * Establishes bidirectional relation: lead.source_client_id = clientId and lead.client_id = clientId.
 * Adds lead id to client.related_lead_ids.
 */
export async function createOpportunityForClient(input: {
  client_id: string;
  project_name: string;
  requirement?: string;
  estimated_value?: number;
  priority?: Priority;
  assigned_to?: string;
  notes?: string;
}): Promise<LeadRecord> {
  const client = await getClientById(input.client_id);
  if (!client) throw new Error('Client record not found.');

  const assignedSalesman = input.assigned_to || client.owner_id || getEffectiveUserId();
  const leadPayload: CreateLeadInput = {
    company_id: client.company_id,
    company_name: client.company_name,
    contact_person: client.contact_person || client.name,
    phone: client.phone,
    whatsapp: client.whatsapp,
    email: client.email,
    location: client.location || client.address,
    lead_type: client.client_type || 'b2b',
    source: 'Repeat Business',
    project_name: input.project_name.trim(),
    requirement: input.requirement?.trim(),
    estimated_value: input.estimated_value,
    priority: input.priority || 'Warm',
    status: 'New',
    assigned_to: assignedSalesman,
    source_client_id: client.id,
    client_id: client.id,
    notes: input.notes || `Repeat Opportunity generated from Client: ${client.company_name}`,
  };

  const newLead = await createLead(leadPayload, getEffectiveUserRole());

  // Link to client's related_lead_ids
  try {
    const related = Array.from(new Set([...(client.related_lead_ids || []), newLead.id]));
    await updateClient(client.id, { related_lead_ids: related }, client);
  } catch (err) {
    console.warn('Could not update client related_lead_ids:', err);
  }

  return newLead;
}

/**
 * Subscribes to Client Transfer history records
 */
export function subscribeToClientTransfers(
  onUpdate: (transfers: ClientTransferRecord[]) => void,
  clientId?: string
): Unsubscribe {
  const companyId = getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const emitLocal = () => {
    let list = getLocalClientTransfers();
    if (companyId) {
      list = list.filter((t) => !t.company_id || t.company_id === companyId);
    }
    if (clientId) {
      list = list.filter((t) => t.client_id === clientId);
    }
    list.sort(
      (a, b) =>
        new Date(b.transferred_at || b.timestamp || 0).getTime() -
        new Date(a.transferred_at || a.timestamp || 0).getTime()
    );
    onUpdate(list);
  };

  emitLocal();

  const handleEvent = () => emitLocal();
  if (typeof window !== 'undefined') {
    window.addEventListener('crm_transfers_changed', handleEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};
  try {
    let q;
    if (clientId) {
      q = query(collection(db, 'clients', clientId, 'transfers'), orderBy('transferred_at', 'desc'));
    } else {
      q = query(
        collection(db, 'client_transfers'),
        where('company_id', '==', companyId),
        orderBy('transferred_at', 'desc'),
        limit(150)
      );
    }

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsList: ClientTransferRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsList.push({ id: docSnap.id, ...docSnap.data() } as ClientTransferRecord);
        });
        if (fsList.length > 0) {
          const localList = getLocalClientTransfers();
          const map = new Map<string, ClientTransferRecord>();
          fsList.forEach((t) => map.set(t.id, t));
          localList.forEach((t) => {
            if (!map.has(t.id)) map.set(t.id, t);
          });
          const merged = Array.from(map.values());
          setLocalClientTransfers(merged);
          emitLocal();
        }
      },
      (err) => {
        console.warn('subscribeToClientTransfers fallback notice:', err);
      }
    );
  } catch (err) {
    console.warn('Firestore client transfers subscription notice:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_transfers_changed', handleEvent);
    }
    firestoreUnsub();
  };
}

/**
 * Subscribes to Lead Transfer history records
 */
export function subscribeToLeadTransfers(
  onUpdate: (transfers: LeadTransferRecord[]) => void,
  leadId?: string
): Unsubscribe {
  const companyId = getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const emitLocal = () => {
    let list = getLocalLeadTransfers();
    if (companyId) {
      list = list.filter((t) => !t.company_id || t.company_id === companyId);
    }
    if (leadId) {
      list = list.filter((t) => t.lead_id === leadId);
    }
    list.sort(
      (a, b) =>
        new Date(b.transferred_at || b.timestamp || 0).getTime() -
        new Date(a.transferred_at || a.timestamp || 0).getTime()
    );
    onUpdate(list);
  };

  emitLocal();

  const handleEvent = () => emitLocal();
  if (typeof window !== 'undefined') {
    window.addEventListener('crm_transfers_changed', handleEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};
  try {
    let q;
    if (leadId) {
      q = query(collection(db, 'leads', leadId, 'transfers'), orderBy('transferred_at', 'desc'));
    } else {
      q = query(
        collection(db, 'lead_transfers'),
        where('company_id', '==', companyId),
        orderBy('transferred_at', 'desc'),
        limit(150)
      );
    }

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsList: LeadTransferRecord[] = [];
        snapshot.forEach((docSnap) => {
          fsList.push({ id: docSnap.id, ...docSnap.data() } as LeadTransferRecord);
        });
        if (fsList.length > 0) {
          const localList = getLocalLeadTransfers();
          const map = new Map<string, LeadTransferRecord>();
          fsList.forEach((t) => map.set(t.id, t));
          localList.forEach((t) => {
            if (!map.has(t.id)) map.set(t.id, t);
          });
          const merged = Array.from(map.values());
          setLocalLeadTransfers(merged);
          emitLocal();
        }
      },
      (err) => {
        console.warn('subscribeToLeadTransfers fallback notice:', err);
      }
    );
  } catch (err) {
    console.warn('Firestore lead transfers subscription notice:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_transfers_changed', handleEvent);
    }
    firestoreUnsub();
  };
}

// ----------------------------------------------------------------------
// Phase R: Tags & Saved Segments DAL & RBAC Management
// ----------------------------------------------------------------------

export async function getAllTags(): Promise<TagRecord[]> {
  let localTags = getLocalTags();
  try {
    const tagsCol = collection(db, 'tags');
    const q = query(tagsCol, orderBy('name', 'asc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const fsTags: TagRecord[] = [];
      snap.forEach((docSnap) => {
        fsTags.push({ id: docSnap.id, ...docSnap.data() } as TagRecord);
      });
      // Merge
      const map = new Map<string, TagRecord>();
      fsTags.forEach((t) => map.set(t.id, t));
      localTags.forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, t);
      });
      localTags = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      setLocalTags(localTags);
    }
  } catch (e) {
    console.warn('Firestore getAllTags fallback notice:', e);
  }
  return localTags;
}

export function subscribeToTags(
  onUpdate: (tags: TagRecord[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  onUpdate(getLocalTags());

  const handleTagsChanged = () => {
    onUpdate(getLocalTags());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_tags_changed', handleTagsChanged);
  }

  let firestoreUnsub: Unsubscribe = () => {};
  try {
    const tagsCol = collection(db, 'tags');
    const q = query(tagsCol, orderBy('name', 'asc'));
    firestoreUnsub = onSnapshot(
      q,
      (snap) => {
        const fsTags: TagRecord[] = [];
        snap.forEach((docSnap) => {
          fsTags.push({ id: docSnap.id, ...docSnap.data() } as TagRecord);
        });
        if (fsTags.length > 0) {
          const current = getLocalTags();
          const map = new Map<string, TagRecord>();
          fsTags.forEach((t) => map.set(t.id, t));
          current.forEach((t) => {
            if (!map.has(t.id)) map.set(t.id, t);
          });
          const merged = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
          setLocalTags(merged);
          onUpdate(merged);
        }
      },
      (err) => {
        console.warn('subscribeToTags snapshot notice:', err);
        onUpdate(getLocalTags());
        if (onError) onError(err);
      }
    );
  } catch (e) {
    console.warn('subscribeToTags init notice:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_tags_changed', handleTagsChanged);
    }
  };
}

export async function createTag(input: CreateTagInput): Promise<TagRecord> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can create tags.');
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Validation Error: Tag name cannot be empty.');
  }

  const existingTags = getLocalTags();
  const nameExists = existingTags.some(
    (t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (nameExists) {
    throw new Error(`A tag with the name "${trimmedName}" already exists (case-insensitive).`);
  }

  const now = new Date().toISOString();
  const userId = getEffectiveUserId();
  const userName = getEffectiveUserName();
  const tagId = 'tag_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const newTag: TagRecord = {
    id: tagId,
    name: trimmedName,
    description: input.description?.trim() || '',
    type: input.type || 'Both',
    is_active: input.is_active !== undefined ? input.is_active : true,
    color: input.color || 'indigo',
    created_by: userId,
    created_at: now,
    updated_at: now,
  };

  // Local sync
  const updatedList = [...existingTags, newTag].sort((a, b) => a.name.localeCompare(b.name));
  setLocalTags(updatedList);

  // Firestore sync
  try {
    const docRef = doc(db, 'tags', tagId);
    await setDoc(docRef, newTag);
  } catch (err) {
    console.warn('Firestore createTag background sync notice:', err);
  }

  // Audit log
  try {
    await createAuditLog({
      action: 'tag_created',
      entity_type: 'Tag',
      entity_id: tagId,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${userName} created new CRM tag "${trimmedName}" (Type: ${newTag.type}).`,
      metadata: { tag_name: trimmedName, tag_type: newTag.type, is_active: newTag.is_active },
    });
  } catch (auditErr) {
    console.warn('createTag audit log notice:', auditErr);
  }

  return newTag;
}

export async function updateTag(tagId: string, input: UpdateTagInput): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can modify tags.');
  }

  const existingTags = getLocalTags();
  const targetTag = existingTags.find((t) => t.id === tagId);
  if (!targetTag) {
    throw new Error('Tag not found.');
  }

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error('Tag name cannot be empty.');
    }
    const duplicate = existingTags.some(
      (t) => t.id !== tagId && t.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Another tag with the name "${trimmed}" already exists.`);
    }
  }

  const now = new Date().toISOString();
  const updatedTag: TagRecord = {
    ...targetTag,
    ...input,
    name: input.name ? input.name.trim() : targetTag.name,
    description: input.description !== undefined ? input.description.trim() : targetTag.description,
    updated_at: now,
  };

  // If the name changed, update all Leads and Clients referencing the old name
  const oldName = targetTag.name;
  const newName = updatedTag.name;
  const nameChanged = oldName !== newName;

  const updatedTagsList = existingTags.map((t) => (t.id === tagId ? updatedTag : t));
  setLocalTags(updatedTagsList);

  if (nameChanged) {
    // Update local leads
    const leads = getLocalLeads();
    let leadsChanged = false;
    const newLeads = leads.map((l) => {
      if (l.tags && l.tags.includes(oldName)) {
        leadsChanged = true;
        return {
          ...l,
          tags: l.tags.map((t) => (t === oldName ? newName : t)),
          updated_at: now,
        };
      }
      return l;
    });
    if (leadsChanged) {
      setLocalLeads(newLeads);
    }

    // Update local clients
    const clients = getLocalClients();
    let clientsChanged = false;
    const newClients = clients.map((c) => {
      if (c.tags && c.tags.includes(oldName)) {
        clientsChanged = true;
        return {
          ...c,
          tags: c.tags.map((t) => (t === oldName ? newName : t)),
          updated_at: now,
        };
      }
      return c;
    });
    if (clientsChanged) {
      setLocalClients(newClients);
    }
  }

  // Firestore sync
  try {
    const docRef = doc(db, 'tags', tagId);
    await updateDoc(docRef, {
      ...input,
      name: updatedTag.name,
      updated_at: now,
    });
  } catch (err) {
    console.warn('Firestore updateTag background sync notice:', err);
  }

  // Audit log
  try {
    const userId = getEffectiveUserId();
    const userName = getEffectiveUserName();
    await createAuditLog({
      action: 'tag_updated',
      entity_type: 'Tag',
      entity_id: tagId,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${userName} updated CRM tag "${targetTag.name}"${nameChanged ? ` to "${newName}"` : ''}.`,
      metadata: { previous_name: oldName, new_name: newName, changes: input },
    });
  } catch (auditErr) {
    console.warn('updateTag audit log notice:', auditErr);
  }
}

export async function toggleTagActive(tagId: string, isActive: boolean): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can activate or deactivate tags.');
  }

  const existingTags = getLocalTags();
  const targetTag = existingTags.find((t) => t.id === tagId);
  if (!targetTag) throw new Error('Tag not found.');

  const now = new Date().toISOString();
  const updatedTags = existingTags.map((t) =>
    t.id === tagId ? { ...t, is_active: isActive, updated_at: now } : t
  );
  setLocalTags(updatedTags);

  try {
    const docRef = doc(db, 'tags', tagId);
    await updateDoc(docRef, { is_active: isActive, updated_at: now });
  } catch (err) {
    console.warn('Firestore toggleTagActive notice:', err);
  }

  try {
    const userId = getEffectiveUserId();
    const userName = getEffectiveUserName();
    await createAuditLog({
      action: isActive ? 'tag_activated' : 'tag_deactivated',
      entity_type: 'Tag',
      entity_id: tagId,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${userName} ${isActive ? 'activated' : 'deactivated'} CRM tag "${targetTag.name}".`,
      metadata: { tag_name: targetTag.name, is_active: isActive },
    });
  } catch (auditErr) {
    console.warn('toggleTagActive audit notice:', auditErr);
  }
}

export async function deleteTag(tagId: string): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can delete tags.');
  }

  const existingTags = getLocalTags();
  const targetTag = existingTags.find((t) => t.id === tagId);
  if (!targetTag) throw new Error('Tag not found.');

  // Check if tag is currently used by any leads or clients
  const leads = getLocalLeads();
  const clients = getLocalClients();
  const tagName = targetTag.name;

  const leadUsage = leads.filter((l) => l.tags && l.tags.includes(tagName)).length;
  const clientUsage = clients.filter((c) => c.tags && c.tags.includes(tagName)).length;
  const totalUsage = leadUsage + clientUsage;

  if (totalUsage > 0) {
    throw new Error(
      `Cannot delete tag "${tagName}" because it is currently assigned to ${leadUsage} Lead(s) and ${clientUsage} Client(s). Please deactivate the tag or remove it from all records first.`
    );
  }

  const updatedTags = existingTags.filter((t) => t.id !== tagId);
  setLocalTags(updatedTags);

  try {
    const docRef = doc(db, 'tags', tagId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore deleteTag notice:', err);
  }

  try {
    const userId = getEffectiveUserId();
    const userName = getEffectiveUserName();
    await createAuditLog({
      action: 'tag_deleted',
      entity_type: 'Tag',
      entity_id: tagId,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${userName} deleted unused CRM tag "${tagName}".`,
      metadata: { deleted_tag_name: tagName },
    });
  } catch (auditErr) {
    console.warn('deleteTag audit notice:', auditErr);
  }
}

export function getTagUsageCounts(): Record<string, { leads: number; clients: number; total: number }> {
  const leads = getLocalLeads();
  const clients = getLocalClients();
  const tags = getLocalTags();

  const counts: Record<string, { leads: number; clients: number; total: number }> = {};
  tags.forEach((t) => {
    counts[t.name] = { leads: 0, clients: 0, total: 0 };
  });

  leads.forEach((l) => {
    if (Array.isArray(l.tags)) {
      l.tags.forEach((tagName) => {
        if (!counts[tagName]) {
          counts[tagName] = { leads: 0, clients: 0, total: 0 };
        }
        counts[tagName].leads += 1;
        counts[tagName].total += 1;
      });
    }
  });

  clients.forEach((c) => {
    if (Array.isArray(c.tags)) {
      c.tags.forEach((tagName) => {
        if (!counts[tagName]) {
          counts[tagName] = { leads: 0, clients: 0, total: 0 };
        }
        counts[tagName].clients += 1;
        counts[tagName].total += 1;
      });
    }
  });

  return counts;
}

export async function addTagToLead(leadId: string, tagName: string): Promise<void> {
  const trimmed = tagName.trim();
  if (!trimmed) return;

  const lead = await getLeadById(leadId);
  if (!lead) throw new Error('Lead not found.');

  const userId = getEffectiveUserId();
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN' && lead.assigned_to !== userId && lead.created_by !== userId) {
    throw new Error('Permission Denied: You do not have permission to modify this lead.');
  }

  // Ensure tag is active
  const allTags = getLocalTags();
  const foundTag = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  if (foundTag && !foundTag.is_active) {
    throw new Error(`Cannot assign deactivated tag "${trimmed}".`);
  }

  const currentTags = Array.isArray(lead.tags) ? lead.tags : [];
  if (currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
    return; // Already has tag
  }

  const canonicalName = foundTag ? foundTag.name : trimmed;
  const newTags = [...currentTags, canonicalName];
  const now = new Date().toISOString();

  // Update local
  const leads = getLocalLeads();
  const updated = leads.map((l) => (l.id === leadId ? { ...l, tags: newTags, updated_at: now } : l));
  setLocalLeads(updated);

  // Firestore update
  try {
    const docRef = doc(db, 'leads', leadId);
    await updateDoc(docRef, { tags: newTags, updated_at: now });
  } catch (err) {
    console.warn('Firestore addTagToLead notice:', err);
  }

  // Log lead activity
  try {
    await createActivity({
      lead_id: leadId,
      activity_type: 'Other',
      description: `Tag added: "${canonicalName}"`,
      notes: `Applied by ${getEffectiveUserName()}`,
      is_system_activity: true,
      metadata: { tag: canonicalName, action: 'add_tag' },
    });
  } catch (actErr) {
    console.warn('Activity log notice:', actErr);
  }
}

export async function removeTagFromLead(leadId: string, tagName: string): Promise<void> {
  const lead = await getLeadById(leadId);
  if (!lead) throw new Error('Lead not found.');

  const userId = getEffectiveUserId();
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN' && lead.assigned_to !== userId && lead.created_by !== userId) {
    throw new Error('Permission Denied: You do not have permission to modify this lead.');
  }

  const currentTags = Array.isArray(lead.tags) ? lead.tags : [];
  const newTags = currentTags.filter((t) => t.toLowerCase() !== tagName.toLowerCase());
  const now = new Date().toISOString();

  const leads = getLocalLeads();
  const updated = leads.map((l) => (l.id === leadId ? { ...l, tags: newTags, updated_at: now } : l));
  setLocalLeads(updated);

  try {
    const docRef = doc(db, 'leads', leadId);
    await updateDoc(docRef, { tags: newTags, updated_at: now });
  } catch (err) {
    console.warn('Firestore removeTagFromLead notice:', err);
  }

  try {
    await createActivity({
      lead_id: leadId,
      activity_type: 'Other',
      description: `Tag removed: "${tagName}"`,
      notes: `Removed by ${getEffectiveUserName()}`,
      is_system_activity: true,
      metadata: { tag: tagName, action: 'remove_tag' },
    });
  } catch (actErr) {
    console.warn('Activity log notice:', actErr);
  }
}

export async function addTagToClient(clientId: string, tagName: string): Promise<void> {
  const trimmed = tagName.trim();
  if (!trimmed) return;

  const client = await getClientById(clientId);
  if (!client) throw new Error('Client not found.');

  const userId = getEffectiveUserId();
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN' && client.owner_id !== userId) {
    throw new Error('Permission Denied: You do not have permission to modify this client.');
  }

  const allTags = getLocalTags();
  const foundTag = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  if (foundTag && !foundTag.is_active) {
    throw new Error(`Cannot assign deactivated tag "${trimmed}".`);
  }

  const currentTags = Array.isArray(client.tags) ? client.tags : [];
  if (currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
    return;
  }

  const canonicalName = foundTag ? foundTag.name : trimmed;
  const newTags = [...currentTags, canonicalName];
  const now = new Date().toISOString();

  const clients = getLocalClients();
  const updated = clients.map((c) => (c.id === clientId ? { ...c, tags: newTags, updated_at: now } : c));
  setLocalClients(updated);

  try {
    const docRef = doc(db, 'clients', clientId);
    await updateDoc(docRef, { tags: newTags, updated_at: now });
  } catch (err) {
    console.warn('Firestore addTagToClient notice:', err);
  }
}

export async function removeTagFromClient(clientId: string, tagName: string): Promise<void> {
  const client = await getClientById(clientId);
  if (!client) throw new Error('Client not found.');

  const userId = getEffectiveUserId();
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN' && client.owner_id !== userId) {
    throw new Error('Permission Denied: You do not have permission to modify this client.');
  }

  const currentTags = Array.isArray(client.tags) ? client.tags : [];
  const newTags = currentTags.filter((t) => t.toLowerCase() !== tagName.toLowerCase());
  const now = new Date().toISOString();

  const clients = getLocalClients();
  const updated = clients.map((c) => (c.id === clientId ? { ...c, tags: newTags, updated_at: now } : c));
  setLocalClients(updated);

  try {
    const docRef = doc(db, 'clients', clientId);
    await updateDoc(docRef, { tags: newTags, updated_at: now });
  } catch (err) {
    console.warn('Firestore removeTagFromClient notice:', err);
  }
}

export async function bulkAddTag(
  entityType: 'lead' | 'client',
  recordIds: string[],
  tagName: string
): Promise<{ successCount: number; failedCount: number }> {
  const trimmed = tagName.trim();
  if (!trimmed || recordIds.length === 0) return { successCount: 0, failedCount: 0 };

  const allTags = getLocalTags();
  const foundTag = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  if (foundTag && !foundTag.is_active) {
    throw new Error(`Cannot assign deactivated tag "${trimmed}".`);
  }
  const canonicalName = foundTag ? foundTag.name : trimmed;

  const userId = getEffectiveUserId();
  const currentRole = getEffectiveUserRole();
  const isAdmin = currentRole === 'ADMIN';

  let successCount = 0;
  let failedCount = 0;

  if (entityType === 'lead') {
    const leads = getLocalLeads();
    const updatedLeads = [...leads];
    const now = new Date().toISOString();

    for (const leadId of recordIds) {
      const idx = updatedLeads.findIndex((l) => l.id === leadId);
      if (idx >= 0) {
        const lead = updatedLeads[idx];
        const isAuthorized = isAdmin || lead.assigned_to === userId || lead.created_by === userId;
        if (isAuthorized) {
          const currentTags = Array.isArray(lead.tags) ? lead.tags : [];
          if (!currentTags.includes(canonicalName)) {
            updatedLeads[idx] = {
              ...lead,
              tags: [...currentTags, canonicalName],
              updated_at: now,
            };
            try {
              const docRef = doc(db, 'leads', leadId);
              updateDoc(docRef, { tags: updatedLeads[idx].tags, updated_at: now }).catch(() => {});
            } catch (e) {}
          }
          successCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
    setLocalLeads(updatedLeads);
  } else {
    const clients = getLocalClients();
    const updatedClients = [...clients];
    const now = new Date().toISOString();

    for (const clientId of recordIds) {
      const idx = updatedClients.findIndex((c) => c.id === clientId);
      if (idx >= 0) {
        const client = updatedClients[idx];
        const isAuthorized = isAdmin || client.owner_id === userId;
        if (isAuthorized) {
          const currentTags = Array.isArray(client.tags) ? client.tags : [];
          if (!currentTags.includes(canonicalName)) {
            updatedClients[idx] = {
              ...client,
              tags: [...currentTags, canonicalName],
              updated_at: now,
            };
            try {
              const docRef = doc(db, 'clients', clientId);
              updateDoc(docRef, { tags: updatedClients[idx].tags, updated_at: now }).catch(() => {});
            } catch (e) {}
          }
          successCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
    setLocalClients(updatedClients);
  }

  // Audit log
  try {
    const userName = getEffectiveUserName();
    await createAuditLog({
      action: 'bulk_tag_added',
      entity_type: entityType === 'lead' ? 'Lead' : 'Client',
      entity_id: `bulk-${Date.now()}`,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: currentRole,
      description: `${userName} applied tag "${canonicalName}" in bulk to ${successCount} ${entityType}(s).`,
      metadata: {
        tag_name: canonicalName,
        entity_type: entityType,
        success_count: successCount,
        failed_count: failedCount,
        record_ids: recordIds,
      },
    });
  } catch (auditErr) {
    console.warn('bulkAddTag audit notice:', auditErr);
  }

  return { successCount, failedCount };
}

export async function bulkRemoveTag(
  entityType: 'lead' | 'client',
  recordIds: string[],
  tagName: string
): Promise<{ successCount: number; failedCount: number }> {
  const trimmed = tagName.trim();
  if (!trimmed || recordIds.length === 0) return { successCount: 0, failedCount: 0 };

  const userId = getEffectiveUserId();
  const currentRole = getEffectiveUserRole();
  const isAdmin = currentRole === 'ADMIN';

  let successCount = 0;
  let failedCount = 0;

  if (entityType === 'lead') {
    const leads = getLocalLeads();
    const updatedLeads = [...leads];
    const now = new Date().toISOString();

    for (const leadId of recordIds) {
      const idx = updatedLeads.findIndex((l) => l.id === leadId);
      if (idx >= 0) {
        const lead = updatedLeads[idx];
        const isAuthorized = isAdmin || lead.assigned_to === userId || lead.created_by === userId;
        if (isAuthorized) {
          const currentTags = Array.isArray(lead.tags) ? lead.tags : [];
          if (currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
            updatedLeads[idx] = {
              ...lead,
              tags: currentTags.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()),
              updated_at: now,
            };
            try {
              const docRef = doc(db, 'leads', leadId);
              updateDoc(docRef, { tags: updatedLeads[idx].tags, updated_at: now }).catch(() => {});
            } catch (e) {}
          }
          successCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
    setLocalLeads(updatedLeads);
  } else {
    const clients = getLocalClients();
    const updatedClients = [...clients];
    const now = new Date().toISOString();

    for (const clientId of recordIds) {
      const idx = updatedClients.findIndex((c) => c.id === clientId);
      if (idx >= 0) {
        const client = updatedClients[idx];
        const isAuthorized = isAdmin || client.owner_id === userId;
        if (isAuthorized) {
          const currentTags = Array.isArray(client.tags) ? client.tags : [];
          if (currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
            updatedClients[idx] = {
              ...client,
              tags: currentTags.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()),
              updated_at: now,
            };
            try {
              const docRef = doc(db, 'clients', clientId);
              updateDoc(docRef, { tags: updatedClients[idx].tags, updated_at: now }).catch(() => {});
            } catch (e) {}
          }
          successCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
    setLocalClients(updatedClients);
  }

  // Audit log
  try {
    const userName = getEffectiveUserName();
    await createAuditLog({
      action: 'bulk_tag_removed',
      entity_type: entityType === 'lead' ? 'Lead' : 'Client',
      entity_id: `bulk-rem-${Date.now()}`,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: currentRole,
      description: `${userName} removed tag "${trimmed}" in bulk from ${successCount} ${entityType}(s).`,
      metadata: {
        tag_name: trimmed,
        entity_type: entityType,
        success_count: successCount,
        failed_count: failedCount,
        record_ids: recordIds,
      },
    });
  } catch (auditErr) {
    console.warn('bulkRemoveTag audit notice:', auditErr);
  }

  return { successCount, failedCount };
}

// ----------------------------------------------------------------------
// Saved Segments DAL & Management
// ----------------------------------------------------------------------

export async function getAllSavedSegments(): Promise<SavedSegmentRecord[]> {
  let localSegments = getLocalSavedSegments();
  try {
    const segCol = collection(db, 'saved_segments');
    const q = query(segCol, orderBy('name', 'asc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const fsSegments: SavedSegmentRecord[] = [];
      snap.forEach((docSnap) => {
        fsSegments.push({ id: docSnap.id, ...docSnap.data() } as SavedSegmentRecord);
      });
      const map = new Map<string, SavedSegmentRecord>();
      fsSegments.forEach((s) => map.set(s.id, s));
      localSegments.forEach((s) => {
        if (!map.has(s.id)) map.set(s.id, s);
      });
      localSegments = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      setLocalSavedSegments(localSegments);
    }
  } catch (e) {
    console.warn('Firestore getAllSavedSegments notice:', e);
  }
  return localSegments;
}

export function subscribeToSavedSegments(
  onUpdate: (segments: SavedSegmentRecord[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  onUpdate(getLocalSavedSegments());

  const handleSegmentsChanged = () => {
    onUpdate(getLocalSavedSegments());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_saved_segments_changed', handleSegmentsChanged);
  }

  let firestoreUnsub: Unsubscribe = () => {};
  try {
    const segCol = collection(db, 'saved_segments');
    const q = query(segCol, orderBy('name', 'asc'));
    firestoreUnsub = onSnapshot(
      q,
      (snap) => {
        const fsSegments: SavedSegmentRecord[] = [];
        snap.forEach((docSnap) => {
          fsSegments.push({ id: docSnap.id, ...docSnap.data() } as SavedSegmentRecord);
        });
        if (fsSegments.length > 0) {
          const current = getLocalSavedSegments();
          const map = new Map<string, SavedSegmentRecord>();
          fsSegments.forEach((s) => map.set(s.id, s));
          current.forEach((s) => {
            if (!map.has(s.id)) map.set(s.id, s);
          });
          const merged = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
          setLocalSavedSegments(merged);
          onUpdate(merged);
        }
      },
      (err) => {
        console.warn('subscribeToSavedSegments snapshot notice:', err);
        onUpdate(getLocalSavedSegments());
        if (onError) onError(err);
      }
    );
  } catch (e) {
    console.warn('subscribeToSavedSegments init notice:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_saved_segments_changed', handleSegmentsChanged);
    }
  };
}

export async function createSavedSegment(input: CreateSavedSegmentInput): Promise<SavedSegmentRecord> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can save global CRM segments.');
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error('Segment name is required.');

  const now = new Date().toISOString();
  const userId = getEffectiveUserId();
  const userName = getEffectiveUserName();
  const segId = 'seg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const newSegment: SavedSegmentRecord = {
    id: segId,
    name: trimmedName,
    description: input.description?.trim() || '',
    entity_type: input.entity_type || 'Lead',
    filter_definition: input.filter_definition,
    is_active: input.is_active !== undefined ? input.is_active : true,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };

  const existing = getLocalSavedSegments();
  const updatedList = [...existing, newSegment].sort((a, b) => a.name.localeCompare(b.name));
  setLocalSavedSegments(updatedList);

  try {
    const docRef = doc(db, 'saved_segments', segId);
    await setDoc(docRef, newSegment);
  } catch (err) {
    console.warn('Firestore createSavedSegment notice:', err);
  }

  try {
    await createAuditLog({
      action: 'segment_created',
      entity_type: 'Segment',
      entity_id: segId,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${userName} created Saved Segment "${trimmedName}" (${newSegment.entity_type}).`,
      metadata: { segment_name: trimmedName, entity_type: newSegment.entity_type },
    });
  } catch (auditErr) {
    console.warn('createSavedSegment audit notice:', auditErr);
  }

  return newSegment;
}

export async function updateSavedSegment(segmentId: string, input: UpdateSavedSegmentInput): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can modify saved segments.');
  }

  const existing = getLocalSavedSegments();
  const target = existing.find((s) => s.id === segmentId);
  if (!target) throw new Error('Saved Segment not found.');

  const now = new Date().toISOString();
  const updated: SavedSegmentRecord = {
    ...target,
    ...input,
    name: input.name ? input.name.trim() : target.name,
    description: input.description !== undefined ? input.description.trim() : target.description,
    updated_at: now,
  };

  const updatedList = existing.map((s) => (s.id === segmentId ? updated : s));
  setLocalSavedSegments(updatedList);

  try {
    const docRef = doc(db, 'saved_segments', segmentId);
    await updateDoc(docRef, {
      ...input,
      name: updated.name,
      updated_at: now,
    });
  } catch (err) {
    console.warn('Firestore updateSavedSegment notice:', err);
  }

  try {
    const userId = getEffectiveUserId();
    const userName = getEffectiveUserName();
    await createAuditLog({
      action: 'segment_updated',
      entity_type: 'Segment',
      entity_id: segmentId,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${userName} updated Saved Segment "${updated.name}".`,
      metadata: { segment_id: segmentId, name: updated.name },
    });
  } catch (auditErr) {
    console.warn('updateSavedSegment audit notice:', auditErr);
  }
}

export async function deleteSavedSegment(segmentId: string): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can delete saved segments.');
  }

  const existing = getLocalSavedSegments();
  const target = existing.find((s) => s.id === segmentId);
  if (!target) throw new Error('Saved Segment not found.');

  const updatedList = existing.filter((s) => s.id !== segmentId);
  setLocalSavedSegments(updatedList);

  try {
    const docRef = doc(db, 'saved_segments', segmentId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore deleteSavedSegment notice:', err);
  }

  try {
    const userId = getEffectiveUserId();
    const userName = getEffectiveUserName();
    await createAuditLog({
      action: 'segment_deleted',
      entity_type: 'Segment',
      entity_id: segmentId,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${userName} deleted Saved Segment "${target.name}".`,
      metadata: { segment_id: segmentId, segment_name: target.name },
    });
  } catch (auditErr) {
    console.warn('deleteSavedSegment audit notice:', auditErr);
  }
}

// ======================================================================
// Phase S: Data Quality, Duplicate Detection & Safe Record Merging
// ======================================================================

export function getLocalNotDuplicates(): NotDuplicateRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOT_DUPLICATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function setLocalNotDuplicates(records: NotDuplicateRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_NOT_DUPLICATES_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('LocalStorage save failed for not_duplicates:', e);
  }
  notifyNotDuplicatesChanged();
}

export function notifyNotDuplicatesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_not_duplicates_changed'));
  }
}

export function subscribeToNotDuplicates(
  onUpdate: (records: NotDuplicateRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  onUpdate(getLocalNotDuplicates());

  const handleChanged = () => {
    onUpdate(getLocalNotDuplicates());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_not_duplicates_changed', handleChanged);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const ref = collection(db, 'not_duplicates');
    firestoreUnsub = onSnapshot(
      ref,
      (snap) => {
        const fsRecords: NotDuplicateRecord[] = [];
        snap.forEach((d) => {
          fsRecords.push({ id: d.id, ...d.data() } as NotDuplicateRecord);
        });

        const map = new Map<string, NotDuplicateRecord>();
        getLocalNotDuplicates().forEach((r) => map.set(r.id, r));
        fsRecords.forEach((r) => map.set(r.id, r));

        const merged = Array.from(map.values());
        setLocalNotDuplicates(merged);
        onUpdate(merged);
      },
      (err) => {
        console.warn('subscribeToNotDuplicates fallback notice:', err);
        onUpdate(getLocalNotDuplicates());
        if (onError) onError(err);
      }
    );
  } catch (e) {
    // fallback
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_not_duplicates_changed', handleChanged);
    }
  };
}

export async function markAsNotDuplicate(
  recordAId: string,
  recordBId: string,
  entityType: 'Lead' | 'Client'
): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can dismiss duplicate suggestions.');
  }

  const adminId = getEffectiveUserId();
  const adminName = getEffectiveUserName();
  const pairId = getPairKey(recordAId, recordBId);
  const now = new Date().toISOString();

  const record: NotDuplicateRecord = {
    id: pairId,
    record_a_id: recordAId < recordBId ? recordAId : recordBId,
    record_b_id: recordAId < recordBId ? recordBId : recordAId,
    entity_type: entityType,
    marked_by: adminId,
    marked_by_name: adminName,
    created_at: now,
  };

  const local = getLocalNotDuplicates();
  const exists = local.some((r) => r.id === pairId);
  if (!exists) {
    local.push(record);
    setLocalNotDuplicates(local);
  }

  try {
    const docRef = doc(db, 'not_duplicates', pairId);
    await setDoc(docRef, record, { merge: true });
  } catch (err) {
    console.warn('Firestore markAsNotDuplicate notice:', err);
  }

  try {
    await createAuditLog({
      action: 'duplicate_marked_not_duplicate',
      entity_type: 'Duplicate',
      entity_id: pairId,
      performed_by: adminId,
      performed_by_name: adminName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${adminName} marked ${entityType} records "${recordAId}" and "${recordBId}" as separate, distinct accounts.`,
      metadata: { pairId, recordAId, recordBId, entityType },
    });
  } catch (e) {
    // non-blocking
  }
}

export async function unmarkNotDuplicate(pairId: string): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can modify dismissed duplicate status.');
  }

  const local = getLocalNotDuplicates();
  const updated = local.filter((r) => r.id !== pairId);
  setLocalNotDuplicates(updated);

  try {
    const docRef = doc(db, 'not_duplicates', pairId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore unmarkNotDuplicate notice:', err);
  }
}

/**
 * Safe Merge Leads
 * Consolidates duplicate Lead records with complete historical integrity:
 * - Surviving lead inherits chosen winning fields
 * - Sub-items (Activities, Follow-ups, Attachments) are re-linked to surviving lead
 * - Notes & Tags can be combined or chosen
 * - Merged lead is preserved in 'merged' status referencing surviving lead
 * - Creates an immutable audit log and timeline activity
 */
export async function mergeLeads(params: MergeLeadsParams): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can merge duplicate leads.');
  }

  const adminId = getEffectiveUserId();
  const adminName = getEffectiveUserName();
  const now = new Date().toISOString();

  const allLeads = getLocalLeads();
  const surviving = allLeads.find((l) => l.id === params.survivingLeadId);
  const merged = allLeads.find((l) => l.id === params.mergedLeadId);

  if (!surviving) throw new Error('Surviving lead record not found.');
  if (!merged) throw new Error('Duplicate lead record to merge not found.');
  if (surviving.id === merged.id) throw new Error('Cannot merge a lead into itself.');

  // Reconcile Notes
  let finalNotes = params.winningFields.notes !== undefined ? params.winningFields.notes : (surviving.notes || '');
  if (params.notesMode === 'combine') {
    const survivingNotes = surviving.notes?.trim() || '';
    const mergedNotes = merged.notes?.trim() || '';
    if (survivingNotes && mergedNotes) {
      finalNotes = `${survivingNotes}\n\n--- Merged Notes from ${merged.company_name} (${new Date().toLocaleDateString()}) ---\n${mergedNotes}`;
    } else {
      finalNotes = survivingNotes || mergedNotes;
    }
  }

  // Reconcile Tags
  let finalTags = params.winningFields.tags || surviving.tags || [];
  if (params.tagsMode === 'combine') {
    finalTags = Array.from(new Set([...(surviving.tags || []), ...(merged.tags || [])]));
  }

  // Surviving Owner
  const survivingOwnerId = params.survivingOwnerId || surviving.assigned_to;

  // 1. Update surviving lead
  const survivingUpdatePayload: Partial<LeadRecord> = {
    ...params.winningFields,
    notes: finalNotes,
    tags: finalTags,
    assigned_to: survivingOwnerId,
    updated_at: now,
  };

  // 2. Mark merged lead as merged
  const mergedUpdatePayload: Partial<LeadRecord> = {
    record_status: 'merged',
    merged_into_id: surviving.id,
    merged_at: now,
    merged_by: adminId,
    merged_by_name: adminName,
    merge_notes: params.mergeNotes || `Merged into ${surviving.company_name} (${surviving.id})`,
    updated_at: now,
  };

  // Update local leads cache
  const updatedLeads = allLeads.map((l) => {
    if (l.id === surviving.id) return { ...l, ...survivingUpdatePayload };
    if (l.id === merged.id) return { ...l, ...mergedUpdatePayload };
    return l;
  });
  setLocalLeads(updatedLeads);

  // Reassign activities from merged lead to surviving lead
  const localActivities = getLocalActivities();
  let activitiesUpdatedCount = 0;
  const updatedActivities = localActivities.map((act) => {
    if (act.lead_id === merged.id) {
      activitiesUpdatedCount++;
      return {
        ...act,
        lead_id: surviving.id,
        metadata: {
          ...(act.metadata || {}),
          originally_from_lead_id: merged.id,
          originally_from_company: merged.company_name,
          merged_at: now,
        },
      };
    }
    return act;
  });
  if (activitiesUpdatedCount > 0) {
    setLocalActivities(updatedActivities);
    notifyActivitiesChanged(surviving.id);
  }

  // Reassign follow-ups from merged lead to surviving lead
  const localFollowups = getLocalFollowUps();
  let followupsUpdatedCount = 0;
  const updatedFollowups = localFollowups.map((fu) => {
    if (fu.lead_id === merged.id) {
      followupsUpdatedCount++;
      return {
        ...fu,
        lead_id: surviving.id,
      };
    }
    return fu;
  });
  if (followupsUpdatedCount > 0) {
    setLocalFollowUps(updatedFollowups);
    notifyFollowupsChanged(surviving.id);
  }

  // Reassign attachments from merged lead to surviving lead
  const localAttachments = getLocalAttachments();
  let attachmentsUpdatedCount = 0;
  const updatedAttachments = localAttachments.map((att) => {
    if (att.lead_id === merged.id) {
      attachmentsUpdatedCount++;
      return {
        ...att,
        lead_id: surviving.id,
      };
    }
    return att;
  });
  if (attachmentsUpdatedCount > 0) {
    setLocalAttachments(updatedAttachments);
    notifyAttachmentsChanged(surviving.id);
  }

  // Async Firestore updates
  try {
    const survivingRef = doc(db, 'leads', surviving.id);
    await updateDoc(survivingRef, survivingUpdatePayload);

    const mergedRef = doc(db, 'leads', merged.id);
    await updateDoc(mergedRef, mergedUpdatePayload);

    // Update activities in firestore root collection
    for (const act of updatedActivities) {
      if (act.metadata?.originally_from_lead_id === merged.id) {
        const actRef = doc(db, 'activities', act.id);
        await updateDoc(actRef, {
          lead_id: surviving.id,
          metadata: act.metadata,
        }).catch(() => {});
      }
    }

    // Update followups
    for (const fu of updatedFollowups) {
      if (fu.lead_id === surviving.id) {
        const fuRef = doc(db, 'followups', fu.id);
        await updateDoc(fuRef, { lead_id: surviving.id }).catch(() => {});
      }
    }

    // Update attachments
    for (const att of updatedAttachments) {
      if (att.lead_id === surviving.id) {
        const attRef = doc(db, 'attachments', att.id);
        await updateDoc(attRef, { lead_id: surviving.id }).catch(() => {});
      }
    }
  } catch (fsErr) {
    console.warn('Firestore mergeLeads notice:', fsErr);
  }

  // Create timeline system activity on surviving lead
  try {
    await createActivity({
      lead_id: surviving.id,
      activity_type: 'Other',
      description: `Duplicate Lead Merged: ${merged.company_name}`,
      notes: `Administrator ${adminName} merged duplicate Lead "${merged.company_name}" (${merged.id}) into this record. All historical interactions, follow-ups, and files were preserved. Assigned Owner: ${getUserDisplayName(survivingOwnerId)}.`,
      outcome: 'Duplicate Merged',
      performed_by: adminId,
      performed_by_name: adminName,
      activity_date: now,
      activity_at: now,
      is_system_activity: true,
      new_value: 'Merged Lead',
      metadata: {
        merged_lead_id: merged.id,
        merged_lead_company: merged.company_name,
        surviving_lead_id: surviving.id,
        activities_migrated: activitiesUpdatedCount,
        followups_migrated: followupsUpdatedCount,
        attachments_migrated: attachmentsUpdatedCount,
      },
    });
  } catch (actErr) {
    console.warn('mergeLeads activity log notice:', actErr);
  }

  // Create immutable Audit Log
  try {
    await createAuditLog({
      action: 'lead_merged',
      entity_type: 'Duplicate',
      entity_id: surviving.id,
      lead_id: surviving.id,
      lead_company_name: surviving.company_name,
      performed_by: adminId,
      performed_by_name: adminName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${adminName} merged duplicate Lead "${merged.company_name}" (${merged.id}) into Lead "${surviving.company_name}" (${surviving.id}).`,
      metadata: {
        surviving_lead_id: surviving.id,
        surviving_company_name: surviving.company_name,
        merged_lead_id: merged.id,
        merged_company_name: merged.company_name,
        previous_surviving_owner: surviving.assigned_to,
        previous_merged_owner: merged.assigned_to,
        final_assigned_owner: survivingOwnerId,
        notes_mode: params.notesMode,
        tags_mode: params.tagsMode,
        winning_fields: Object.keys(params.winningFields),
        merge_notes: params.mergeNotes,
      },
    });
  } catch (auditErr) {
    console.warn('mergeLeads audit notice:', auditErr);
  }

  // Also remove from not_duplicates if previously marked
  const pairId = getPairKey(surviving.id, merged.id);
  const ndList = getLocalNotDuplicates();
  if (ndList.some((r) => r.id === pairId)) {
    setLocalNotDuplicates(ndList.filter((r) => r.id !== pairId));
    try {
      await deleteDoc(doc(db, 'not_duplicates', pairId));
    } catch (e) {}
  }
}

/**
 * Safe Merge Clients
 * Consolidates duplicate Client records with complete auditability and ownership preservation.
 */
export async function mergeClients(params: MergeClientsParams): Promise<void> {
  const currentRole = getEffectiveUserRole();
  if (currentRole !== 'ADMIN') {
    throw new Error('Permission Denied: Only administrators can merge duplicate clients.');
  }

  const adminId = getEffectiveUserId();
  const adminName = getEffectiveUserName();
  const now = new Date().toISOString();

  const allClients = getLocalClients();
  const surviving = allClients.find((c) => c.id === params.survivingClientId);
  const merged = allClients.find((c) => c.id === params.mergedClientId);

  if (!surviving) throw new Error('Surviving client record not found.');
  if (!merged) throw new Error('Duplicate client record to merge not found.');
  if (surviving.id === merged.id) throw new Error('Cannot merge a client into itself.');

  // Reconcile Notes
  let finalNotes = params.winningFields.notes !== undefined ? params.winningFields.notes : (surviving.notes || '');
  if (params.notesMode === 'combine') {
    const survivingNotes = surviving.notes?.trim() || '';
    const mergedNotes = merged.notes?.trim() || '';
    if (survivingNotes && mergedNotes) {
      finalNotes = `${survivingNotes}\n\n--- Merged Notes from ${merged.company_name} (${new Date().toLocaleDateString()}) ---\n${mergedNotes}`;
    } else {
      finalNotes = survivingNotes || mergedNotes;
    }
  }

  // Reconcile Tags
  let finalTags = params.winningFields.tags || surviving.tags || [];
  if (params.tagsMode === 'combine') {
    finalTags = Array.from(new Set([...(surviving.tags || []), ...(merged.tags || [])]));
  }

  const survivingOwnerId = params.survivingOwnerId || surviving.owner_id;
  const survivingOwnerName = getUserDisplayName(survivingOwnerId);

  // 1. Surviving update
  const survivingUpdatePayload: Partial<ClientRecord> = {
    ...params.winningFields,
    notes: finalNotes,
    tags: finalTags,
    owner_id: survivingOwnerId,
    owner_name: survivingOwnerName,
    updated_at: now,
  };

  // 2. Merged update
  const mergedUpdatePayload: Partial<ClientRecord> = {
    record_status: 'merged',
    merged_into_id: surviving.id,
    merged_at: now,
    merged_by: adminId,
    merged_by_name: adminName,
    merge_notes: params.mergeNotes || `Merged into ${surviving.company_name} (${surviving.id})`,
    updated_at: now,
  };

  const updatedClients = allClients.map((c) => {
    if (c.id === surviving.id) return { ...c, ...survivingUpdatePayload };
    if (c.id === merged.id) return { ...c, ...mergedUpdatePayload };
    return c;
  });
  setLocalClients(updatedClients);

  // If any leads referenced merged client as source_client_id, reassign to surviving
  const allLeads = getLocalLeads();
  let leadsReassigned = 0;
  const updatedLeads = allLeads.map((l) => {
    if (l.source_client_id === merged.id) {
      leadsReassigned++;
      return { ...l, source_client_id: surviving.id };
    }
    return l;
  });
  if (leadsReassigned > 0) {
    setLocalLeads(updatedLeads);
  }

  // Update Firestore
  try {
    await updateDoc(doc(db, 'clients', surviving.id), survivingUpdatePayload);
    await updateDoc(doc(db, 'clients', merged.id), mergedUpdatePayload);

    for (const l of updatedLeads) {
      if (l.source_client_id === surviving.id) {
        await updateDoc(doc(db, 'leads', l.id), { source_client_id: surviving.id }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('Firestore mergeClients notice:', e);
  }

  // Audit Log
  try {
    await createAuditLog({
      action: 'client_merged',
      entity_type: 'Duplicate',
      entity_id: surviving.id,
      performed_by: adminId,
      performed_by_name: adminName,
      performed_by_role: 'ADMIN',
      description: `Administrator ${adminName} merged duplicate Client "${merged.company_name}" (${merged.id}) into Client "${surviving.company_name}" (${surviving.id}).`,
      metadata: {
        surviving_client_id: surviving.id,
        surviving_company_name: surviving.company_name,
        merged_client_id: merged.id,
        merged_company_name: merged.company_name,
        previous_surviving_owner: surviving.owner_id,
        previous_merged_owner: merged.owner_id,
        final_assigned_owner: survivingOwnerId,
        notes_mode: params.notesMode,
        tags_mode: params.tagsMode,
        winning_fields: Object.keys(params.winningFields),
        merge_notes: params.mergeNotes,
      },
    });
  } catch (e) {
    console.warn('mergeClients audit notice:', e);
  }

  // Remove pair from not duplicates if present
  const pairId = getPairKey(surviving.id, merged.id);
  const ndList = getLocalNotDuplicates();
  if (ndList.some((r) => r.id === pairId)) {
    setLocalNotDuplicates(ndList.filter((r) => r.id !== pairId));
    try {
      await deleteDoc(doc(db, 'not_duplicates', pairId));
    } catch (e) {}
  }
}

// ----------------------------------------------------------------------
// Phase V: Import Jobs Subscription
// ----------------------------------------------------------------------
export function subscribeToImportJobs(callback: (jobs: any[]) => void): () => void {
  try {
    const q = query(collection(db, 'import_jobs'), orderBy('started_at', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const jobs = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        }));
        callback(jobs);
      },
      (err) => {
        console.warn('subscribeToImportJobs fallback to local:', err);
        try {
          const cached = JSON.parse(localStorage.getItem('crm_local_import_jobs_v1') || '[]');
          callback(cached);
        } catch {
          callback([]);
        }
      }
    );
    return unsubscribe;
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem('crm_local_import_jobs_v1') || '[]');
      callback(cached);
    } catch {
      callback([]);
    }
    return () => {};
  }
}

// ----------------------------------------------------------------------
// Phase X: ZaynOps Multi-Company SaaS Architecture & Management
// ----------------------------------------------------------------------

export async function getCompanies(): Promise<CompanyRecord[]> {
  const companiesMap = new Map<string, CompanyRecord>();

  // 1. Initial default company
  companiesMap.set(INITIAL_DEFAULT_COMPANY.id, INITIAL_DEFAULT_COMPANY);

  // 2. Local companies
  const locals = getLocalCompanies();
  locals.forEach((c) => companiesMap.set(c.id, c));

  // 3. Firestore companies
  try {
    const colRef = collection(db, 'companies');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      snap.forEach((d) => {
        companiesMap.set(d.id, { id: d.id, ...d.data() } as CompanyRecord);
      });
    }
  } catch (err) {
    console.warn('Firestore getCompanies fallback to local cache:', err);
  }

  const result = Array.from(companiesMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  setLocalCompanies(result);
  return result;
}

export async function getCompanyById(companyId: string): Promise<CompanyRecord | null> {
  if (!companyId) return null;
  const locals = getLocalCompanies();
  const local = locals.find((c) => c.id === companyId);

  try {
    const docRef = doc(db, 'companies', companyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const company = { id: snap.id, ...snap.data() } as CompanyRecord;
      const updated = locals.some((c) => c.id === companyId)
        ? locals.map((c) => (c.id === companyId ? company : c))
        : [...locals, company];
      setLocalCompanies(updated);
      return company;
    }
  } catch (e) {
    console.warn('Firestore getCompanyById notice:', e);
  }

  return local || null;
}

export async function createCompany(
  input: CreateCompanyInput,
  initialAdmin?: { full_name: string; email: string; password?: string },
  actor?: UserProfile
): Promise<CompanyRecord> {
  const actorId = actor?.id || getEffectiveUserId();
  const actorName = actor?.full_name || getEffectiveUserName();
  const actorRole = actor?.role || getEffectiveUserRole();

  if (actorRole !== 'SUPER_ADMIN') {
    throw new Error('Unauthorized: Only a Super Administrator can create new companies.');
  }

  if (!input.name || !input.name.trim()) {
    throw new Error('Company name is required.');
  }

  const now = new Date().toISOString();
  const companyId = 'comp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const newCompany: CompanyRecord = {
    id: companyId,
    name: input.name.trim(),
    code: input.code?.trim() || input.name.trim().substring(0, 4).toUpperCase(),
    industry: input.industry?.trim() || '',
    contact_email: input.contact_email?.trim() || '',
    contact_phone: input.contact_phone?.trim() || '',
    address: input.address?.trim() || '',
    notes: input.notes?.trim() || '',
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
  };

  // Save to local cache
  const locals = getLocalCompanies();
  locals.unshift(newCompany);
  setLocalCompanies(locals);

  // Save to Firestore
  try {
    const docRef = doc(db, 'companies', companyId);
    const { id, ...data } = newCompany;
    await setDoc(docRef, data);
  } catch (err) {
    console.warn('Firestore createCompany fallback notice:', err);
  }

  // Create initial Company Admin if provided
  if (initialAdmin && initialAdmin.email) {
    try {
      await createCompanyUser(
        companyId,
        {
          full_name: initialAdmin.full_name || `${input.name} Admin`,
          email: initialAdmin.email,
          role: 'ADMIN',
          password: initialAdmin.password || 'Welcome123!',
        },
        actor
      );
    } catch (adminErr) {
      console.warn('Initial company admin creation notice:', adminErr);
    }
  }

  // Record Audit Log
  try {
    await createAuditLog({
      action: 'company_created',
      entity_type: 'Company',
      entity_id: companyId,
      performed_by: actorId,
      performed_by_name: actorName,
      performed_by_role: 'SUPER_ADMIN',
      description: `Super Administrator ${actorName} created Company "${newCompany.name}" (${newCompany.id}).`,
      metadata: {
        company_id: companyId,
        company_name: newCompany.name,
        contact_email: newCompany.contact_email,
        contact_phone: newCompany.contact_phone,
        industry: newCompany.industry,
      },
    });
  } catch (auditErr) {
    console.warn('createCompany audit log notice:', auditErr);
  }

  return newCompany;
}

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput,
  actor?: UserProfile
): Promise<CompanyRecord> {
  const actorId = actor?.id || getEffectiveUserId();
  const actorName = actor?.full_name || getEffectiveUserName();
  const actorRole = actor?.role || getEffectiveUserRole();

  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
    throw new Error('Unauthorized: Insufficient permissions to update company details.');
  }

  const locals = getLocalCompanies();
  const existing = locals.find((c) => c.id === companyId);
  if (!existing) {
    throw new Error('Company record not found.');
  }

  const now = new Date().toISOString();
  const updatedCompany: CompanyRecord = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // Update local cache
  const updatedLocals = locals.map((c) => (c.id === companyId ? updatedCompany : c));
  setLocalCompanies(updatedLocals);

  // Update Firestore
  try {
    const docRef = doc(db, 'companies', companyId);
    await updateDoc(docRef, {
      ...input,
      updated_at: now,
    });
  } catch (err) {
    console.warn('Firestore updateCompany notice:', err);
  }

  // Audit Log
  try {
    await createAuditLog({
      action: 'company_updated',
      entity_type: 'Company',
      entity_id: companyId,
      performed_by: actorId,
      performed_by_name: actorName,
      performed_by_role: actorRole as any,
      description: `Administrator ${actorName} updated company details for "${updatedCompany.name}".`,
      metadata: {
        company_id: companyId,
        company_name: updatedCompany.name,
        updated_fields: Object.keys(input),
      },
    });
  } catch (e) {}

  return updatedCompany;
}

export async function setCompanyStatus(
  companyId: string,
  status: CompanyStatus,
  actor?: UserProfile
): Promise<void> {
  const actorId = actor?.id || getEffectiveUserId();
  const actorName = actor?.full_name || getEffectiveUserName();
  const actorRole = actor?.role || getEffectiveUserRole();

  if (actorRole !== 'SUPER_ADMIN') {
    throw new Error('Unauthorized: Only a Super Administrator can activate or deactivate companies.');
  }

  const locals = getLocalCompanies();
  const existing = locals.find((c) => c.id === companyId);
  const now = new Date().toISOString();

  // Update local cache
  const updatedLocals = locals.map((c) =>
    c.id === companyId ? { ...c, status, updated_at: now } : c
  );
  setLocalCompanies(updatedLocals);

  // Update Firestore
  try {
    const docRef = doc(db, 'companies', companyId);
    await updateDoc(docRef, {
      status,
      updated_at: now,
    });
  } catch (err) {
    console.warn('Firestore setCompanyStatus notice:', err);
  }

  // Audit Log
  try {
    await createAuditLog({
      action: status === 'ACTIVE' ? 'company_activated' : 'company_deactivated',
      entity_type: 'Company',
      entity_id: companyId,
      performed_by: actorId,
      performed_by_name: actorName,
      performed_by_role: 'SUPER_ADMIN',
      description: `Super Administrator ${actorName} changed company status of "${existing?.name || companyId}" to ${status}.`,
      metadata: {
        company_id: companyId,
        company_name: existing?.name || companyId,
        previous_status: existing?.status,
        new_status: status,
      },
    });
  } catch (e) {}
}

export function subscribeToCompanies(
  callback: (companies: CompanyRecord[]) => void
): Unsubscribe {
  // Push local version immediately
  callback(getLocalCompanies());

  const handleCustomEvent = () => {
    callback(getLocalCompanies());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_companies_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const colRef = collection(db, 'companies');
    firestoreUnsub = onSnapshot(
      colRef,
      (snapshot) => {
        const companiesMap = new Map<string, CompanyRecord>();
        companiesMap.set(INITIAL_DEFAULT_COMPANY.id, INITIAL_DEFAULT_COMPANY);

        getLocalCompanies().forEach((c) => companiesMap.set(c.id, c));

        snapshot.forEach((docSnap) => {
          companiesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as CompanyRecord);
        });

        const merged = Array.from(companiesMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setLocalCompanies(merged);
        callback(merged);
      },
      (err) => {
        console.warn('subscribeToCompanies fallback to local cache:', err);
        callback(getLocalCompanies());
      }
    );
  } catch (err) {
    console.warn('Could not establish Firestore subscribeToCompanies:', err);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_companies_changed', handleCustomEvent);
    }
  };
}

export async function createCompanyUser(
  companyId: string,
  input: { full_name: string; email: string; phone?: string; role?: 'ADMIN' | 'SALESMAN'; password?: string; permissions?: SalesmanPermission[] },
  actor?: UserProfile
): Promise<UserProfile> {
  const actorId = actor?.id || getEffectiveUserId();
  const actorName = actor?.full_name || getEffectiveUserName();
  const actorRole = actor?.role || getEffectiveUserRole();

  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
    throw new Error('Unauthorized: Only Administrators can create team members.');
  }

  // For Company Admin, strictly enforce their own company and strictly SALESMAN role
  let targetCompanyId = companyId;
  let targetRole: UserRole = 'SALESMAN';

  if (actorRole === 'ADMIN') {
    const actorCompany = actor?.company_id || getEffectiveCompanyId();
    targetCompanyId = actorCompany || DEFAULT_COMPANY_ID;
    // Company Admin CANNOT create SUPER_ADMIN or another ADMIN
    targetRole = 'SALESMAN';
  } else if (actorRole === 'SUPER_ADMIN') {
    targetRole = input.role === 'ADMIN' ? 'ADMIN' : 'SALESMAN';
  }

  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.full_name.trim();

  // Try creating in Firebase Auth using helper that avoids signing out current session
  let authUid: string | null = null;
  try {
    authUid = await createAuthUserWithoutSignOut(
      cleanEmail,
      input.password || 'Welcome123!'
    );
  } catch (authErr: any) {
    console.warn('Firebase Auth user creation notice (using generated ID fallback):', authErr?.message || authErr);
  }

  const now = new Date().toISOString();
  const userId = authUid || 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const initialPermissions = targetRole === 'SALESMAN'
    ? (Array.isArray(input.permissions) ? input.permissions : DEFAULT_SALESMAN_PERMISSIONS)
    : undefined;

  const newUser: UserProfile = {
    id: userId,
    full_name: cleanName,
    email: cleanEmail,
    role: targetRole,
    company_id: targetCompanyId,
    phone: input.phone || '',
    is_active: true,
    created_at: now,
    updated_at: now,
    ...(initialPermissions ? { permissions: initialPermissions } : {}),
  };

  // Local storage save
  const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
  let localUsers: UserProfile[] = raw ? JSON.parse(raw) : [];
  localUsers = localUsers.filter((u) => u.email.toLowerCase() !== cleanEmail && u.id !== userId);
  localUsers.push(newUser);
  localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(localUsers));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_users_changed'));
  }

  // Firestore save
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, newUser, { merge: true });
  } catch (err) {
    console.warn('Firestore createCompanyUser notice:', err);
  }

  // Audit Log
  try {
    await createAuditLog({
      action: 'user_created',
      entity_type: 'User',
      entity_id: userId,
      company_id: targetCompanyId,
      performed_by: actorId,
      performed_by_name: actorName,
      performed_by_role: actorRole as any,
      target_user_id: userId,
      target_user_name: cleanName,
      description: `${actorRole === 'SUPER_ADMIN' ? 'Super Administrator' : 'Company Administrator'} ${actorName} created ${targetRole} account for ${cleanName} (${cleanEmail}).`,
      metadata: {
        company_id: targetCompanyId,
        user_id: userId,
        role: targetRole,
        email: cleanEmail,
        permissions_count: initialPermissions?.length,
      },
    });
  } catch (e) {}

  return newUser;
}

export async function updateCompanySalesman(
  companyId: string,
  userId: string,
  input: { full_name?: string; phone?: string; permissions?: SalesmanPermission[] },
  actor?: UserProfile
): Promise<UserProfile> {
  const actorId = actor?.id || getEffectiveUserId();
  const actorName = actor?.full_name || getEffectiveUserName();
  const actorRole = actor?.role || getEffectiveUserRole();
  const actorCompany = actor?.company_id || getEffectiveCompanyId();

  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
    throw new Error('Unauthorized: Only Administrators can edit team members.');
  }

  if (actorRole === 'ADMIN' && actorCompany !== companyId) {
    throw new Error('Unauthorized: Company Admins can only edit team members belonging to their own company.');
  }

  // Fetch current user
  const current = await getUserProfile(userId);
  if (!current) {
    throw new Error('User not found.');
  }

  if (actorRole === 'ADMIN' && current.company_id && current.company_id !== companyId) {
    throw new Error('Unauthorized: Cannot edit users belonging to another company.');
  }

  if (actorRole === 'ADMIN' && (current.role === 'SUPER_ADMIN' || (current.role === 'ADMIN' && current.id !== actorId))) {
    throw new Error('Unauthorized: Company Admins can only manage Salesmen.');
  }

  const now = new Date().toISOString();
  const updatedProfile: UserProfile = {
    ...current,
    full_name: input.full_name?.trim() || current.full_name,
    phone: input.phone !== undefined ? input.phone.trim() : current.phone,
    permissions: input.permissions !== undefined ? input.permissions : current.permissions,
    // Never allow changing company_id or role through this method
    company_id: current.company_id || companyId,
    role: current.role,
    updated_at: now,
  };

  // Update local storage
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      let users: UserProfile[] = raw ? JSON.parse(raw) : [];
      users = users.map((u) => (u.id === userId ? updatedProfile : u));
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));

      // Update active session if target is current logged in user
      const sessionRaw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (sessionRaw) {
        const sess = JSON.parse(sessionRaw);
        if (sess?.id === userId) {
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedProfile));
        }
      }

      window.dispatchEvent(new CustomEvent('crm_users_changed'));
    } catch (e) {}
  }

  // Update Firestore
  try {
    const userDocRef = doc(db, 'users', userId);
    const updatePayload: any = {
      full_name: updatedProfile.full_name,
      phone: updatedProfile.phone,
      updated_at: now,
    };
    if (input.permissions !== undefined) {
      updatePayload.permissions = input.permissions;
    }
    await updateDoc(userDocRef, updatePayload);
  } catch (err) {
    console.warn('Firestore updateCompanySalesman fallback:', err);
  }

  // Record audit log
  try {
    await createAuditLog({
      action: 'user_edited',
      entity_type: 'User',
      entity_id: userId,
      company_id: companyId,
      performed_by: actorId,
      performed_by_name: actorName,
      performed_by_role: actorRole as any,
      target_user_id: userId,
      target_user_name: updatedProfile.full_name,
      description: `Company Administrator ${actorName} updated profile details for ${updatedProfile.full_name}.`,
      metadata: {
        company_id: companyId,
        user_id: userId,
        updated_fields: input,
      },
    });
  } catch (e) {}

  return updatedProfile;
}

export async function updateCompanySalesmanPermissions(
  companyId: string,
  userId: string,
  newPermissions: SalesmanPermission[],
  actor?: UserProfile
): Promise<UserProfile> {
  const actorId = actor?.id || getEffectiveUserId();
  const actorName = actor?.full_name || getEffectiveUserName();
  const actorRole = actor?.role || getEffectiveUserRole();
  const actorCompany = actor?.company_id || getEffectiveCompanyId();

  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
    throw new Error('Unauthorized: Only Administrators can configure permissions.');
  }

  if (actorRole === 'ADMIN' && actorCompany !== companyId) {
    throw new Error('Unauthorized: Company Admins can only configure permissions for team members in their own company.');
  }

  const current = await getUserProfile(userId);
  if (!current) {
    throw new Error('User not found.');
  }

  if (actorRole === 'ADMIN' && current.company_id && current.company_id !== companyId) {
    throw new Error('Unauthorized: Cannot modify permissions of users belonging to another company.');
  }

  if (actorRole === 'ADMIN' && (current.role === 'SUPER_ADMIN' || current.role === 'ADMIN')) {
    throw new Error('Unauthorized: Company Admins can only configure permissions for Salesmen.');
  }

  const oldPermissions = current.permissions || DEFAULT_SALESMAN_PERMISSIONS;
  const now = new Date().toISOString();

  const updatedProfile: UserProfile = {
    ...current,
    permissions: newPermissions,
    updated_at: now,
  };

  // Update local storage
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      let users: UserProfile[] = raw ? JSON.parse(raw) : [];
      users = users.map((u) => (u.id === userId ? updatedProfile : u));
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));

      // Update active session if this is the active user
      const sessionRaw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (sessionRaw) {
        const sess = JSON.parse(sessionRaw);
        if (sess?.id === userId) {
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedProfile));
        }
      }

      window.dispatchEvent(new CustomEvent('crm_users_changed'));
    } catch (e) {}
  }

  // Update Firestore
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      permissions: newPermissions,
      updated_at: now,
    });
  } catch (err) {
    console.warn('Firestore updateCompanySalesmanPermissions fallback:', err);
  }

  // Record audit log
  try {
    await createAuditLog({
      action: 'permissions_updated' as any,
      entity_type: 'User',
      entity_id: userId,
      company_id: companyId,
      performed_by: actorId,
      performed_by_name: actorName,
      performed_by_role: actorRole as any,
      target_user_id: userId,
      target_user_name: updatedProfile.full_name,
      description: `Company Administrator ${actorName} updated permissions for Salesman ${updatedProfile.full_name}. Configured ${newPermissions.length} permissions.`,
      metadata: {
        company_id: companyId,
        user_id: userId,
        old_permissions: oldPermissions,
        new_permissions: newPermissions,
      },
    });
  } catch (e) {}

  return updatedProfile;
}

export async function toggleCompanySalesmanStatus(
  companyId: string,
  userId: string,
  isActive: boolean,
  actor?: UserProfile
): Promise<void> {
  const actorId = actor?.id || getEffectiveUserId();
  const actorName = actor?.full_name || getEffectiveUserName();
  const actorRole = actor?.role || getEffectiveUserRole();
  const actorCompany = actor?.company_id || getEffectiveCompanyId();

  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
    throw new Error('Unauthorized: Only Administrators can activate or deactivate team members.');
  }

  if (actorRole === 'ADMIN' && actorCompany !== companyId) {
    throw new Error('Unauthorized: Company Admins can only change status of team members in their own company.');
  }

  const current = await getUserProfile(userId);
  if (!current) {
    throw new Error('User not found.');
  }

  if (actorRole === 'ADMIN' && current.company_id && current.company_id !== companyId) {
    throw new Error('Unauthorized: Cannot modify users belonging to another company.');
  }

  if (current.id === actorId) {
    throw new Error('Action not permitted: You cannot deactivate your own administrative account.');
  }

  if (actorRole === 'ADMIN' && (current.role === 'SUPER_ADMIN' || current.role === 'ADMIN')) {
    throw new Error('Unauthorized: Company Admins can only activate or deactivate Salesmen.');
  }

  const now = new Date().toISOString();

  // Update local storage
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      let users: UserProfile[] = raw ? JSON.parse(raw) : [];
      const foundIdx = users.findIndex((u) => u.id === userId);
      if (foundIdx >= 0) {
        users[foundIdx] = { ...users[foundIdx], is_active: isActive, updated_at: now };
      } else {
        users.push({ ...current, is_active: isActive, updated_at: now });
      }
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
      window.dispatchEvent(new CustomEvent('crm_users_changed'));
    } catch (e) {}
  }

  // Update Firestore
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      is_active: isActive,
      updated_at: now,
    });
  } catch (err) {
    console.warn('Firestore toggleCompanySalesmanStatus fallback:', err);
  }

  // Record audit log
  try {
    await createAuditLog({
      action: isActive ? 'user_activated' : 'user_deactivated',
      entity_type: 'User',
      entity_id: userId,
      company_id: companyId,
      performed_by: actorId,
      performed_by_name: actorName,
      performed_by_role: actorRole as any,
      target_user_id: userId,
      target_user_name: current.full_name,
      description: `Company Administrator ${actorName} ${isActive ? 'activated' : 'deactivated'} access account for Salesman ${current.full_name}.`,
      metadata: {
        company_id: companyId,
        user_id: userId,
        previous_status: current.is_active ? 'ACTIVE' : 'INACTIVE',
        new_status: isActive ? 'ACTIVE' : 'INACTIVE',
      },
    });
  } catch (e) {}
}

export async function getCompanyUsers(companyId: string): Promise<UserProfile[]> {
  const allUsers = await getAllUsers();
  return allUsers.filter((u) => u.company_id === companyId);
}

export function subscribeToCompanyUsers(
  companyId: string,
  callback: (users: UserProfile[]) => void
): Unsubscribe {
  // Push initial local filter
  getAllUsers().then((users) => {
    callback(users.filter((u) => u.company_id === companyId));
  });

  const handleUsersChanged = () => {
    getAllUsers().then((users) => {
      callback(users.filter((u) => u.company_id === companyId));
    });
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_users_changed', handleUsersChanged);
    window.addEventListener('storage', handleUsersChanged);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('company_id', '==', companyId));
    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const users: UserProfile[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          users.push({
            id: d.id,
            ...data,
            role: data.role as UserRole,
            company_id: data.company_id,
            is_active: data.is_active !== false,
          } as UserProfile);
        });
        callback(users);
      },
      (err) => {
        console.warn('subscribeToCompanyUsers firestore fallback:', err);
        getAllUsers().then((users) => {
          callback(users.filter((u) => u.company_id === companyId));
        });
      }
    );
  } catch (e) {
    console.warn('Could not establish subscribeToCompanyUsers:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_users_changed', handleUsersChanged);
      window.removeEventListener('storage', handleUsersChanged);
    }
  };
}

/**
 * Migration routine: Ensures all existing records without company_id are backfilled
 * to the default company (Bahwan M&E LLC), preventing any data loss or orphaning!
 */
export async function ensureMultiTenantMigration(): Promise<void> {
  // 1. Ensure Default Company exists in local storage
  const companies = getLocalCompanies();
  if (!companies.some((c) => c.id === DEFAULT_COMPANY_ID)) {
    companies.unshift(INITIAL_DEFAULT_COMPANY);
    setLocalCompanies(companies);
  }

  // Ensure Default Company exists in Firestore
  try {
    const compDoc = doc(db, 'companies', DEFAULT_COMPANY_ID);
    const snap = await getDoc(compDoc);
    if (!snap.exists()) {
      const { id, ...data } = INITIAL_DEFAULT_COMPANY;
      await setDoc(compDoc, data, { merge: true });
    }
  } catch (e) {
    console.warn('Migration default company notice:', e);
  }

  // 2. Backfill local leads without company_id
  const localLeads = getLocalLeads();
  let leadsUpdated = false;
  const migratedLeads = localLeads.map((lead) => {
    if (!lead.company_id) {
      leadsUpdated = true;
      return { ...lead, company_id: DEFAULT_COMPANY_ID };
    }
    return lead;
  });
  if (leadsUpdated) {
    setLocalLeads(migratedLeads);
    notifyLeadsChanged();
  }

  // 3. Backfill local clients without company_id
  const localClients = getLocalClients();
  let clientsUpdated = false;
  const migratedClients = localClients.map((client) => {
    if (!client.company_id) {
      clientsUpdated = true;
      return { ...client, company_id: DEFAULT_COMPANY_ID };
    }
    return client;
  });
  if (clientsUpdated) {
    setLocalClients(migratedClients);
  }

  // 4. Backfill local users without company_id (except Super Admin)
  try {
    const rawUsers = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (rawUsers) {
      const users: UserProfile[] = JSON.parse(rawUsers);
      let usersChanged = false;
      const updatedUsers = users.map((u) => {
        if (u.email?.toLowerCase() === 'itsyourmujahid@gmail.com') {
          return { ...u, role: 'SUPER_ADMIN' as UserRole };
        }
        if (!u.company_id) {
          usersChanged = true;
          return { ...u, company_id: DEFAULT_COMPANY_ID };
        }
        return u;
      });
      if (usersChanged) {
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updatedUsers));
      }
    }
  } catch (e) {}

  // 5. Ensure Super Admin profile in Firestore
  try {
    const superAdminDoc = doc(db, 'users', 'uid-mujahid');
    await setDoc(
      superAdminDoc,
      {
        full_name: 'Mujahid Islam',
        email: 'itsyourmujahid@gmail.com',
        role: 'SUPER_ADMIN',
        is_active: true,
      },
      { merge: true }
    );
  } catch (e) {}

  // 6. Automatically verify and repair company admin roles
  try {
    await repairCompanyAdminAccounts();
  } catch (e) {
    console.warn('repairCompanyAdminAccounts migration error:', e);
  }
}

// ======================================================================
// Phase V: Company Sales Targets & Performance Management
// ======================================================================

const INITIAL_SAMPLE_TARGETS: TargetRecord[] = [
  {
    id: 'target-seed-1',
    company_id: DEFAULT_COMPANY_ID,
    salesman_id: 'uid-joseph',
    salesman_name: 'Joseph Varghese',
    target_type: 'LEADS_MANAGED',
    target_value: 50,
    period_type: 'MONTHLY',
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    created_by: 'uid-admin-1',
    created_by_name: 'Ahmed Al-Sayed',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    status: 'ACTIVE',
    notes: 'Monthly managed leads target for commercial pipeline',
  },
  {
    id: 'target-seed-2',
    company_id: DEFAULT_COMPANY_ID,
    salesman_id: 'uid-joseph',
    salesman_name: 'Joseph Varghese',
    target_type: 'LEADS_WON',
    target_value: 10,
    period_type: 'MONTHLY',
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    created_by: 'uid-admin-1',
    created_by_name: 'Ahmed Al-Sayed',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    status: 'ACTIVE',
    notes: 'Monthly closed deals conversion target',
  },
  {
    id: 'target-seed-3',
    company_id: DEFAULT_COMPANY_ID,
    salesman_id: 'uid-joseph',
    salesman_name: 'Joseph Varghese',
    target_type: 'FOLLOWUPS_COMPLETED',
    target_value: 80,
    period_type: 'MONTHLY',
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    created_by: 'uid-admin-1',
    created_by_name: 'Ahmed Al-Sayed',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    status: 'ACTIVE',
    notes: 'Commercial customer follow-up cadence target',
  },
];

export function getLocalTargets(): TargetRecord[] {
  if (typeof window === 'undefined') return INITIAL_SAMPLE_TARGETS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TARGETS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_TARGETS_KEY, JSON.stringify(INITIAL_SAMPLE_TARGETS));
      return INITIAL_SAMPLE_TARGETS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SAMPLE_TARGETS;
  }
}

export function saveLocalTargets(targets: TargetRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_TARGETS_KEY, JSON.stringify(targets));
    window.dispatchEvent(new CustomEvent('crm_targets_changed', { detail: targets }));
  } catch (e) {
    console.error('saveLocalTargets error:', e);
  }
}

export function getSessionUserProfile(): UserProfile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Creates a new commercial target for a salesman within the company boundary.
 * Strictly validates permissions, data integrity, and prevents accidental duplicates.
 */
export async function createTarget(
  input: CreateTargetInput,
  adminUser?: UserProfile
): Promise<TargetRecord> {
  const currentAdmin: UserProfile = adminUser || getSessionUserProfile() || {
    id: getEffectiveUserId(),
    full_name: getEffectiveUserName(),
    email: '',
    role: getEffectiveUserRole(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company_id: getEffectiveCompanyId() || DEFAULT_COMPANY_ID,
  };
  if (!currentAdmin) {
    throw new Error('Unauthorized: Authentication required.');
  }
  const role = (currentAdmin.role || '').toUpperCase();
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    throw new Error('Access Denied: Only Company Administrators can configure targets.');
  }

  const companyId = currentAdmin.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;

  // Validation
  const validTypes: TargetType[] = [
    'LEADS_MANAGED',
    'LEADS_WON',
    'CLIENTS_ADDED',
    'FOLLOWUPS_COMPLETED',
    'ACTIVITIES_COMPLETED',
  ];
  if (!validTypes.includes(input.target_type)) {
    throw new Error(`Invalid target type: "${input.target_type}".`);
  }

  if (typeof input.target_value !== 'number' || isNaN(input.target_value) || input.target_value <= 0) {
    throw new Error('Target value must be a positive number greater than 0.');
  }

  if (!input.start_date || !input.end_date) {
    throw new Error('Start date and end date are required.');
  }
  if (input.end_date < input.start_date) {
    throw new Error('End date cannot be earlier than start date.');
  }

  // Validate salesman exists and belongs to this company
  const users = await getCompanyUsers(companyId);
  const salesman = users.find((u) => u.id === input.salesman_id);
  if (!salesman) {
    throw new Error('Sales representative not found in this company.');
  }
  if (salesman.role !== 'SALESMAN') {
    throw new Error('Targets can only be configured for Sales Representatives.');
  }

  const now = new Date().toISOString();
  const targetId = 'target-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  // Check if an active target already exists for this salesman + target_type + period
  // If so, archive the existing one to preserve history
  const currentTargets = getLocalTargets();
  const updatedTargets = currentTargets.map((t) => {
    if (
      t.company_id === companyId &&
      t.salesman_id === input.salesman_id &&
      t.target_type === input.target_type &&
      t.period_type === input.period_type &&
      t.status === 'ACTIVE'
    ) {
      return {
        ...t,
        status: 'ARCHIVED' as TargetStatus,
        updated_at: now,
      };
    }
    return t;
  });

  const newTarget: TargetRecord = {
    id: targetId,
    company_id: companyId,
    salesman_id: input.salesman_id,
    salesman_name: salesman.full_name || input.salesman_name || 'Sales Representative',
    target_type: input.target_type,
    target_value: Math.round(input.target_value),
    period_type: input.period_type,
    start_date: input.start_date,
    end_date: input.end_date,
    created_by: currentAdmin.id,
    created_by_name: currentAdmin.full_name || 'Company Administrator',
    created_at: now,
    updated_at: now,
    status: 'ACTIVE',
    notes: input.notes?.trim() || '',
    history: [],
  };

  updatedTargets.push(newTarget);
  saveLocalTargets(updatedTargets);

  // Sync to Firestore
  try {
    const docRef = doc(db, 'targets', targetId);
    await setDoc(docRef, newTarget);
  } catch (err) {
    console.warn('createTarget Firestore sync fallback (using local cache):', err);
  }

  // Record Audit Log (Requirement 19)
  try {
    const targetTypeLabel = input.target_type.replace(/_/g, ' ').toLowerCase();
    await recordSecurityAuditLog({
      action: 'target_created',
      entity_type: 'Security',
      entity_id: targetId,
      description: `Admin ${currentAdmin.full_name} set ${salesman.full_name}'s ${input.period_type.toLowerCase()} ${targetTypeLabel} target to ${input.target_value}.`,
      metadata: {
        company_id: companyId,
        actor_id: currentAdmin.id,
        actor_name: currentAdmin.full_name,
        salesman_id: salesman.id,
        salesman_name: salesman.full_name,
        target_id: targetId,
        target_type: input.target_type,
        new_value: input.target_value,
        period_type: input.period_type,
        start_date: input.start_date,
        end_date: input.end_date,
        timestamp: now,
        action_type: 'CREATE',
      },
    });
  } catch (e) {
    console.warn('createTarget audit log error:', e);
  }

  // Internal Notification to Salesman (Requirement 20)
  try {
    await createNotification({
      recipient_id: salesman.id,
      title: 'New Commercial Target Assigned',
      message: `Your ${input.period_type.toLowerCase()} target for ${input.target_type.replace(/_/g, ' ').toLowerCase()} has been set to ${input.target_value} by ${currentAdmin.full_name}.`,
      type: 'general',
      event_key: `target_${targetId}_created`,
    });
  } catch (e) {
    console.warn('createTarget notification error:', e);
  }

  return newTarget;
}

/**
 * Updates an existing target, preserving previous version in the history array.
 */
export async function updateTarget(
  targetId: string,
  input: UpdateTargetInput,
  adminUser?: UserProfile
): Promise<TargetRecord> {
  const currentAdmin: UserProfile = adminUser || getSessionUserProfile() || {
    id: getEffectiveUserId(),
    full_name: getEffectiveUserName(),
    email: '',
    role: getEffectiveUserRole(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company_id: getEffectiveCompanyId() || DEFAULT_COMPANY_ID,
  };
  if (!currentAdmin) {
    throw new Error('Unauthorized: Authentication required.');
  }
  const role = (currentAdmin.role || '').toUpperCase();
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    throw new Error('Access Denied: Only Company Administrators can update targets.');
  }

  const companyId = currentAdmin.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const allTargets = getLocalTargets();
  const existingIndex = allTargets.findIndex((t) => t.id === targetId);
  if (existingIndex === -1) {
    throw new Error('Target record not found.');
  }
  const existing = allTargets[existingIndex];

  if (existing.company_id !== companyId && role !== 'SUPER_ADMIN') {
    throw new Error('Tenant Isolation: Cannot modify targets belonging to another company.');
  }

  const now = new Date().toISOString();
  const oldValue = existing.target_value;
  const newValue = typeof input.target_value === 'number' ? Math.round(input.target_value) : existing.target_value;

  if (newValue <= 0) {
    throw new Error('Target value must be greater than 0.');
  }

  const history = [...(existing.history || [])];
  if (oldValue !== newValue) {
    history.push({
      previous_value: oldValue,
      updated_at: now,
      updated_by: currentAdmin.id,
      updated_by_name: currentAdmin.full_name || 'Administrator',
      reason: input.reason || input.notes,
    });
  }

  const updated: TargetRecord = {
    ...existing,
    target_value: newValue,
    period_type: input.period_type || existing.period_type,
    start_date: input.start_date || existing.start_date,
    end_date: input.end_date || existing.end_date,
    status: input.status || existing.status,
    notes: input.notes !== undefined ? input.notes.trim() : existing.notes,
    history,
    updated_at: now,
  };

  allTargets[existingIndex] = updated;
  saveLocalTargets(allTargets);

  // Firestore update
  try {
    const docRef = doc(db, 'targets', targetId);
    await updateDoc(docRef, { ...updated });
  } catch (err) {
    console.warn('updateTarget Firestore update fallback:', err);
  }

  // Audit Log (Requirement 19)
  try {
    const targetTypeLabel = existing.target_type.replace(/_/g, ' ').toLowerCase();
    await recordSecurityAuditLog({
      action: 'target_updated',
      entity_type: 'Security',
      entity_id: targetId,
      description: `Admin ${currentAdmin.full_name} updated ${existing.salesman_name}'s ${existing.period_type.toLowerCase()} ${targetTypeLabel} target from ${oldValue} to ${newValue}.`,
      metadata: {
        company_id: companyId,
        actor_id: currentAdmin.id,
        actor_name: currentAdmin.full_name,
        salesman_id: existing.salesman_id,
        salesman_name: existing.salesman_name,
        target_id: targetId,
        old_value: oldValue,
        new_value: newValue,
        target_type: existing.target_type,
        timestamp: now,
        action_type: 'UPDATE',
      },
    });
  } catch (e) {
    console.warn('updateTarget audit log error:', e);
  }

  // Notification if value changed
  if (oldValue !== newValue) {
    try {
      await createNotification({
        recipient_id: existing.salesman_id,
        title: 'Commercial Target Updated',
        message: `Your ${existing.period_type.toLowerCase()} target for ${existing.target_type.replace(/_/g, ' ').toLowerCase()} has been revised from ${oldValue} to ${newValue} by ${currentAdmin.full_name}.`,
        type: 'general',
        event_key: `target_${targetId}_updated_${Date.now()}`,
      });
    } catch (e) {
      console.warn('updateTarget notification error:', e);
    }
  }

  return updated;
}

/**
 * Deletes a target record (Company Admin only).
 */
export async function deleteTarget(
  targetId: string,
  adminUser?: UserProfile
): Promise<void> {
  const currentAdmin: UserProfile = adminUser || getSessionUserProfile() || {
    id: getEffectiveUserId(),
    full_name: getEffectiveUserName(),
    email: '',
    role: getEffectiveUserRole(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company_id: getEffectiveCompanyId() || DEFAULT_COMPANY_ID,
  };
  if (!currentAdmin) throw new Error('Unauthorized');
  const role = (currentAdmin.role || '').toUpperCase();
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    throw new Error('Access Denied: Only Company Administrators can delete targets.');
  }

  const companyId = currentAdmin.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
  const allTargets = getLocalTargets();
  const targetToDelete = allTargets.find((t) => t.id === targetId);
  if (!targetToDelete) return;

  if (targetToDelete.company_id !== companyId && role !== 'SUPER_ADMIN') {
    throw new Error('Tenant Isolation: Cannot delete target from another company.');
  }

  const filtered = allTargets.filter((t) => t.id !== targetId);
  saveLocalTargets(filtered);

  try {
    await deleteDoc(doc(db, 'targets', targetId));
  } catch (e) {
    console.warn('deleteTarget Firestore delete error:', e);
  }

  try {
    await recordSecurityAuditLog({
      action: 'target_deleted',
      entity_type: 'Security',
      entity_id: targetId,
      description: `Admin ${currentAdmin.full_name} deleted target ${targetToDelete.target_type} for ${targetToDelete.salesman_name}.`,
      metadata: {
        company_id: companyId,
        actor_id: currentAdmin.id,
        salesman_id: targetToDelete.salesman_id,
        target_type: targetToDelete.target_type,
        target_value: targetToDelete.target_value,
      },
    });
  } catch (e) {}
}

/**
 * Subscribes to targets for the specified company with role-based visibility.
 * Admin sees all company targets; Salesman sees only their own targets.
 */
export function subscribeToTargets(
  companyId: string,
  onUpdate: (targets: TargetRecord[]) => void,
  salesmanId?: string,
  userRole?: UserRole
): Unsubscribe {
  const currentRole = userRole || getEffectiveUserRole();
  const isSalesman = currentRole === 'SALESMAN';

  const filterAndEmit = (rawList: TargetRecord[]) => {
    let filtered = rawList;
    // Multi-tenant company isolation
    filtered = filtered.filter((t) => t.company_id === companyId);
    // Role boundary: Salesman only sees their own targets
    if (isSalesman || (salesmanId && !isUserAdminOrSuper(currentRole))) {
      const targetUid = salesmanId || getEffectiveUserId();
      filtered = filtered.filter((t) => t.salesman_id === targetUid);
    } else if (salesmanId) {
      // Admin filtering for a specific salesman
      filtered = filtered.filter((t) => t.salesman_id === salesmanId);
    }
    onUpdate(filtered);
  };

  // Immediate emission from local state
  filterAndEmit(getLocalTargets());

  const handleCustomEvent = () => {
    filterAndEmit(getLocalTargets());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_targets_changed', handleCustomEvent);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  try {
    const targetsRef = collection(db, 'targets');
    let q;
    if (isSalesman) {
      const uid = salesmanId || getEffectiveUserId();
      q = query(targetsRef, where('company_id', '==', companyId), where('salesman_id', '==', uid));
    } else {
      q = query(targetsRef, where('company_id', '==', companyId));
    }

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: TargetRecord[] = [];
          snapshot.forEach((d) => {
            list.push({ ...d.data(), id: d.id } as TargetRecord);
          });
          // Merge with local targets
          const currentLocal = getLocalTargets();
          const merged = [...currentLocal];
          list.forEach((docItem) => {
            const idx = merged.findIndex((m) => m.id === docItem.id);
            if (idx >= 0) merged[idx] = docItem;
            else merged.push(docItem);
          });
          saveLocalTargets(merged);
          filterAndEmit(merged);
        }
      },
      (err) => {
        console.warn('subscribeToTargets Firestore listener fallback to local cache:', err);
      }
    );
  } catch (err) {
    console.warn('subscribeToTargets catch fallback:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_targets_changed', handleCustomEvent);
    }
    firestoreUnsub();
  };
}

/**
 * Returns targets configured for a specific salesman
 */
export async function getTargetsForSalesman(
  companyId: string,
  salesmanId: string
): Promise<TargetRecord[]> {
  const all = getLocalTargets();
  return all.filter((t) => t.company_id === companyId && t.salesman_id === salesmanId);
}







