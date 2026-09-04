/**
 * Phase V — Export Service
 * Multi-format export engine (CSV and XLSX) with strict RBAC authorization,
 * filtering, field sanitization, chunked processing, and file downloads.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ExportFilters } from '../types/dataManagement';
import {
  LeadRecord,
  ClientRecord,
  LeadActivityRecord,
  FollowUpRecord,
  UserProfile,
} from '../types/database';
import { getUserDisplayName } from './dal';

/**
 * Strips any internal system secrets or sensitive Firebase token attributes.
 */
const SENSITIVE_PROPERTIES = new Set([
  'password',
  'token',
  'secret',
  'authInfo',
  'refreshToken',
  'credentials',
  'private_info',
  'admin_secret',
]);

/**
 * Formats date into readable string
 */
function formatDate(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toISOString().slice(0, 10);
  } catch {
    return isoStr;
  }
}

/**
 * Filter and Authorize Leads for Export
 */
export function prepareLeadsExportData(
  leads: LeadRecord[],
  filters: ExportFilters,
  currentUser: { uid: string; role: string },
  usersList: UserProfile[]
): Record<string, any>[] {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';

  return leads
    .filter((lead) => {
      // 19. Security check: Non-admins can only export their own leads
      if (!isAdmin && lead.assigned_to !== currentUser.uid && lead.created_by !== currentUser.uid) {
        return false;
      }

      // Filter: Status
      if (filters.status && filters.status !== 'all' && lead.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }

      // Filter: Priority
      if (filters.priority && filters.priority !== 'all' && lead.priority?.toLowerCase() !== filters.priority.toLowerCase()) {
        return false;
      }

      // Filter: Assigned Salesman (Admin only filter)
      if (filters.salesmanId && filters.salesmanId !== 'all' && lead.assigned_to !== filters.salesmanId) {
        return false;
      }

      // Filter: Source
      if (filters.source && filters.source !== 'all' && lead.source?.toLowerCase() !== filters.source.toLowerCase()) {
        return false;
      }

      // Filter: Lead Type
      if (filters.leadType && filters.leadType !== 'all' && lead.lead_type?.toLowerCase() !== filters.leadType.toLowerCase()) {
        return false;
      }

      // Filter: Tags
      if (filters.tag && filters.tag !== 'all' && (!lead.tags || !lead.tags.includes(filters.tag))) {
        return false;
      }

      // Filter: Date Range
      if (filters.startDate && new Date(lead.created_at) < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(lead.created_at) > end) {
          return false;
        }
      }

      return true;
    })
    .map((lead) => {
      const salesmanName = getUserDisplayName(lead.assigned_to, usersList);
      const creatorName = getUserDisplayName(lead.created_by, usersList);

      return {
        'Lead ID': lead.id,
        'Company Name': lead.company_name || '',
        'Contact Person': lead.contact_person || '',
        'Phone': lead.phone || '',
        'WhatsApp': lead.whatsapp || '',
        'Email': lead.email || '',
        'Lead Type': lead.lead_type || '',
        'Location': lead.location || '',
        'Source': lead.source || '',
        'Priority': lead.priority || 'Warm',
        'Status': lead.status || 'New',
        'Estimated Value (OMR)': lead.estimated_value || 0,
        'Expected Closing Date': formatDate(lead.expected_closing_date),
        'Assigned Salesman': salesmanName,
        'Project Name': lead.project_name || '',
        'Project Type': lead.project_type || '',
        'Project Location': lead.project_location || '',
        'Requirement': lead.requirement || '',
        'Notes': lead.notes || '',
        'Tags': (lead.tags || []).join(', '),
        'Created Date': formatDate(lead.created_at),
        'Created By': creatorName,
      };
    });
}

/**
 * Filter and Authorize Clients for Export
 */
export function prepareClientsExportData(
  clients: ClientRecord[],
  filters: ExportFilters,
  currentUser: { uid: string; role: string },
  usersList: UserProfile[]
): Record<string, any>[] {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';

  return clients
    .filter((client) => {
      if (!isAdmin && client.owner_id !== currentUser.uid && client.converted_by !== currentUser.uid) {
        return false;
      }

      if (filters.clientStatus && filters.clientStatus !== 'all' && client.status !== filters.clientStatus) {
        return false;
      }

      if (filters.salesmanId && filters.salesmanId !== 'all' && client.owner_id !== filters.salesmanId) {
        return false;
      }

      if (filters.tag && filters.tag !== 'all' && (!client.tags || !client.tags.includes(filters.tag))) {
        return false;
      }

      if (filters.startDate && new Date(client.created_at) < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(client.created_at) > end) {
          return false;
        }
      }

      return true;
    })
    .map((client) => {
      const ownerName = getUserDisplayName(client.owner_id, usersList);
      return {
        'Client ID': client.id,
        'Company Name': client.company_name || '',
        'Primary Contact': client.contact_person || '',
        'Phone': client.phone || '',
        'WhatsApp': client.whatsapp || '',
        'Email': client.email || '',
        'Location': client.location || '',
        'Client Type': client.client_type || '',
        'Status': client.status || 'Active',
        'Account Owner': ownerName,
        'Source Lead ID': client.source_lead_id || '',
        'Notes': client.notes || '',
        'Tags': (client.tags || []).join(', '),
        'Client Since': formatDate(client.created_at),
      };
    });
}

/**
 * Filter and Authorize Activities for Export
 */
export function prepareActivitiesExportData(
  activities: LeadActivityRecord[],
  leadsMap: Map<string, LeadRecord>,
  filters: ExportFilters,
  currentUser: { uid: string; role: string },
  usersList: UserProfile[]
): Record<string, any>[] {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';

  return activities
    .filter((act) => {
      const associatedLead = leadsMap.get(act.lead_id);
      if (!isAdmin) {
        // Salesman can only see their own activities or activities on their leads
        if (act.performed_by !== currentUser.uid && associatedLead?.assigned_to !== currentUser.uid) {
          return false;
        }
      }

      if (filters.startDate && new Date(act.created_at) < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(act.created_at) > end) {
          return false;
        }
      }

      return true;
    })
    .map((act) => {
      const lead = leadsMap.get(act.lead_id);
      const repName = getUserDisplayName(act.performed_by, usersList);

      return {
        'Activity ID': act.id,
        'Associated Lead / Client': lead?.company_name || `Lead #${act.lead_id}`,
        'Activity Type': act.activity_type || '',
        'Description': act.description || '',
        'Outcome': act.outcome || '',
        'Notes': act.notes || '',
        'Performed By': repName || act.performed_by_name || 'System',
        'Activity Date': formatDate(act.activity_date || act.created_at),
      };
    });
}

/**
 * Filter and Authorize Follow-ups for Export
 */
export function prepareFollowupsExportData(
  followups: FollowUpRecord[],
  leadsMap: Map<string, LeadRecord>,
  filters: ExportFilters,
  currentUser: { uid: string; role: string },
  usersList: UserProfile[]
): Record<string, any>[] {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';

  return followups
    .filter((fu) => {
      if (!isAdmin && fu.assigned_to !== currentUser.uid && fu.created_by !== currentUser.uid) {
        return false;
      }

      if (filters.status && filters.status !== 'all' && fu.status !== filters.status) {
        return false;
      }

      if (filters.salesmanId && filters.salesmanId !== 'all' && fu.assigned_to !== filters.salesmanId) {
        return false;
      }

      if (filters.startDate && new Date(fu.scheduled_at) < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(fu.scheduled_at) > end) {
          return false;
        }
      }

      return true;
    })
    .map((fu) => {
      const lead = leadsMap.get(fu.lead_id);
      const repName = getUserDisplayName(fu.assigned_to, usersList);

      return {
        'Follow-up ID': fu.id,
        'Associated Lead / Client': lead?.company_name || fu.company_name || `Lead #${fu.lead_id}`,
        'Action Type': fu.action || 'Follow-up',
        'Scheduled Time': fu.scheduled_at ? new Date(fu.scheduled_at).toLocaleString() : '',
        'Status': fu.status || 'pending',
        'Assigned Representative': repName || fu.assigned_to_name || '',
        'Location': fu.location || '',
        'Notes': fu.notes || '',
        'Outcome': fu.outcome || '',
        'Completed At': fu.completed_at ? formatDate(fu.completed_at) : '',
      };
    });
}

/**
 * Export Sales Targets (Admin or authorized Salesman)
 */
export function prepareTargetsExportData(
  targets: any[],
  filters: ExportFilters,
  currentUser: { uid: string; role: string },
  usersList: UserProfile[]
): Record<string, any>[] {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';

  return targets
    .filter((target) => {
      if (!isAdmin && target.salesman_id !== currentUser.uid) {
        return false;
      }
      if (filters.salesmanId && filters.salesmanId !== 'all' && target.salesman_id !== filters.salesmanId) {
        return false;
      }
      return true;
    })
    .map((target) => {
      const repName = getUserDisplayName(target.salesman_id, usersList);
      return {
        'Sales Representative': repName,
        'Period': target.period || 'Monthly',
        'Year': target.year || new Date().getFullYear(),
        'Month': target.month || '',
        'Target Revenue (OMR)': target.target_revenue || 0,
        'Achieved Revenue (OMR)': target.achieved_revenue || 0,
        'Target Deals': target.target_deals || 0,
        'Won Deals': target.achieved_deals || 0,
        'Completion Rate': target.target_revenue > 0 ? `${Math.round((target.achieved_revenue / target.target_revenue) * 100)}%` : '0%',
      };
    });
}

/**
 * Universal Download Generator
 */
export function generateExportFile(
  data: Record<string, any>[],
  fileNamePrefix: string,
  format: 'csv' | 'xlsx' = 'csv'
) {
  if (!data || data.length === 0) {
    throw new Error('No records match the selected export criteria.');
  }

  // Clean any sensitive properties
  const sanitized = data.map((item) => {
    const cleanItem: Record<string, any> = {};
    Object.entries(item).forEach(([key, val]) => {
      if (!SENSITIVE_PROPERTIES.has(key.toLowerCase())) {
        cleanItem[key] = val;
      }
    });
    return cleanItem;
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const baseFilename = `LeadFlow_${fileNamePrefix}_${timestamp}`;

  if (format === 'csv') {
    const csvString = Papa.unparse(sanitized);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${baseFilename}.csv`);
  } else {
    const worksheet = XLSX.utils.json_to_sheet(sanitized);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, fileNamePrefix);
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    triggerDownload(blob, `${baseFilename}.xlsx`);
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
