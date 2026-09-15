import {
  ClientRecord,
  FollowUpRecord,
  LeadActivityRecord,
  LeadRecord,
  TargetPeriodType,
  TargetProgressResult,
  TargetRecord,
  TargetType,
} from '../types/database';

/**
 * Formats a TargetType into a clean, human-readable label
 */
export function formatTargetTypeName(type: TargetType): string {
  switch (type) {
    case 'LEADS_MANAGED':
      return 'Leads Managed';
    case 'LEADS_WON':
      return 'Leads Won';
    case 'CLIENTS_ADDED':
      return 'Clients Added';
    case 'FOLLOWUPS_COMPLETED':
      return 'Follow-ups Completed';
    case 'ACTIVITIES_COMPLETED':
      return 'Activities Completed';
    default:
      return type;
  }
}

/**
 * Returns a brief description of what counts toward the target
 */
export function getTargetTypeDescription(type: TargetType): string {
  switch (type) {
    case 'LEADS_MANAGED':
      return 'Active leads currently owned & assigned to the salesman';
    case 'LEADS_WON':
      return 'Leads successfully converted to Closed Won status';
    case 'CLIENTS_ADDED':
      return 'New business client accounts created or owned';
    case 'FOLLOWUPS_COMPLETED':
      return 'Completed follow-up tasks and meetings';
    case 'ACTIVITIES_COMPLETED':
      return 'Logged calls, meetings, emails, and CRM interactions';
    default:
      return '';
  }
}

/**
 * Formats period type and date bounds
 */
export function formatPeriodName(
  periodType: TargetPeriodType,
  startDate?: string,
  endDate?: string
): string {
  if (periodType === 'MONTHLY' && startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }
  if (periodType === 'QUARTERLY' && startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `Q${q} ${d.getFullYear()}`;
    }
  }
  if (periodType === 'YEARLY' && startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) {
      return `Year ${d.getFullYear()}`;
    }
  }
  if (startDate && endDate) {
    return `${startDate} to ${endDate}`;
  }
  return periodType;
}

/**
 * Computes default start and end dates based on the period type
 */
export function calculatePeriodDates(
  periodType: TargetPeriodType,
  refDate: Date = new Date()
): { startDate: string; endDate: string } {
  const year = refDate.getFullYear();
  const month = refDate.getMonth(); // 0-indexed

  if (periodType === 'MONTHLY') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // last day of month
    return {
      startDate: formatDateToYMD(start),
      endDate: formatDateToYMD(end),
    };
  }

  if (periodType === 'QUARTERLY') {
    const quarter = Math.floor(month / 3);
    const start = new Date(year, quarter * 3, 1);
    const end = new Date(year, (quarter + 1) * 3, 0);
    return {
      startDate: formatDateToYMD(start),
      endDate: formatDateToYMD(end),
    };
  }

  if (periodType === 'YEARLY') {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return {
      startDate: formatDateToYMD(start),
      endDate: formatDateToYMD(end),
    };
  }

  // Default for CUSTOM: current month
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startDate: formatDateToYMD(start),
    endDate: formatDateToYMD(end),
  };
}

function formatDateToYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Checks if a date string falls within [startDate, endDate] (inclusive).
 * If no target dates are provided, returns true.
 */
function isDateWithinRange(
  dateStr: string | undefined,
  startDateStr: string | undefined,
  endDateStr: string | undefined
): boolean {
  if (!startDateStr || !endDateStr || !dateStr) return true;
  try {
    const date = new Date(dateStr).getTime();
    const start = new Date(`${startDateStr}T00:00:00`).getTime();
    const end = new Date(`${endDateStr}T23:59:59`).getTime();
    if (isNaN(date) || isNaN(start) || isNaN(end)) return true;
    return date >= start && date <= end;
  } catch {
    return true;
  }
}

/**
 * Calculates current progress and status for a given target based on real CRM data.
 */
export function calculateTargetProgress(
  target: TargetRecord,
  leads: LeadRecord[] = [],
  clients: ClientRecord[] = [],
  followups: FollowUpRecord[] = [],
  activities: LeadActivityRecord[] = []
): TargetProgressResult {
  const salesmanId = target.salesman_id;
  const targetVal = target.target_value > 0 ? target.target_value : 1;
  let current = 0;

  switch (target.target_type) {
    case 'LEADS_MANAGED': {
      // Current active owner of the lead (do not double count transferred leads)
      // Exclude archived leads
      const managedLeads = leads.filter((l) => {
        const isAssigned =
          l.assigned_to === salesmanId ||
          l.assigned_to === `uid-${target.salesman_name?.toLowerCase()}` ||
          l.assigned_to === (target as any).salesman_email;
        const isNotArchived = (l as any).status !== 'Archived';
        return isAssigned && isNotArchived;
      });
      current = managedLeads.length;
      break;
    }

    case 'LEADS_WON': {
      // Won leads assigned to or closed by the salesman within the period
      const wonLeads = leads.filter((l) => {
        const isAssigned =
          l.assigned_to === salesmanId ||
          l.assigned_to === `uid-${target.salesman_name?.toLowerCase()}` ||
          (l as any).closed_by === salesmanId;
        const isWon =
          (l.status && l.status.toLowerCase() === 'won') ||
          ((l as any).stage && String((l as any).stage).toLowerCase() === 'won');
        if (!isAssigned || !isWon) return false;

        // If target has date range, verify when lead was won/updated
        const relevantDate = l.closing_date || l.updated_at || l.created_at;
        return isDateWithinRange(relevantDate, target.start_date, target.end_date);
      });
      current = wonLeads.length;
      break;
    }

    case 'CLIENTS_ADDED': {
      // Clients owned or created by salesman within the period
      const ownedClients = clients.filter((c) => {
        const isOwner =
          c.owner_id === salesmanId ||
          (c as any).created_by === salesmanId ||
          (c as any).salesman_id === salesmanId;
        if (!isOwner) return false;

        const relevantDate = c.created_at;
        return isDateWithinRange(relevantDate, target.start_date, target.end_date);
      });
      current = ownedClients.length;
      break;
    }

    case 'FOLLOWUPS_COMPLETED': {
      // Completed followups within the period
      const completedFollowups = followups.filter((f) => {
        const isAssigned =
          f.assigned_to === salesmanId ||
          f.created_by === salesmanId ||
          f.assigned_to === `uid-${target.salesman_name?.toLowerCase()}`;
        const isCompleted = f.status === 'completed';
        if (!isAssigned || !isCompleted) return false;

        const relevantDate = f.completed_at || f.updated_at || f.scheduled_at;
        return isDateWithinRange(relevantDate, target.start_date, target.end_date);
      });
      current = completedFollowups.length;
      break;
    }

    case 'ACTIVITIES_COMPLETED': {
      // Completed CRM activities within the period
      const salesmanActivities = activities.filter((a) => {
        const isAuthor =
          a.created_by === salesmanId ||
          (a as any).salesman_id === salesmanId ||
          (a as any).performed_by === salesmanId;
        if (!isAuthor) return false;

        const relevantDate = a.created_at || (a as any).timestamp;
        return isDateWithinRange(relevantDate, target.start_date, target.end_date);
      });
      current = salesmanActivities.length;
      break;
    }

    default:
      current = 0;
  }

  const percentage = Math.round((current / targetVal) * 100);
  const remaining = Math.max(0, targetVal - current);

  let status: 'Not Started' | 'In Progress' | 'Achieved' | 'Overachieved';
  let statusColor: string;

  if (current === 0) {
    status = 'Not Started';
    statusColor = 'text-slate-400 bg-slate-100 border-slate-200';
  } else if (current < targetVal) {
    status = 'In Progress';
    statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
  } else if (current === targetVal) {
    status = 'Achieved';
    statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else {
    status = 'Overachieved';
    statusColor = 'text-purple-700 bg-purple-50 border-purple-200';
  }

  return {
    current,
    target: targetVal,
    percentage,
    remaining,
    status,
    statusColor,
  };
}
