import {
  LeadRecord,
  FollowUpRecord,
  LeadActivityRecord,
  UserProfile,
  LeadStatus,
} from '../types/database';
import {
  DateRangePreset,
  MetricSummary,
  StageMetric,
  SalesmanPerformanceMetric,
  DimensionBreakdown,
  ActivityBreakdown,
  TimeSeriesPoint,
  RecentWinRecord,
  AttentionRiskItem,
} from '../types/reports';
import { isFollowUpOverdue, isFollowUpDueToday } from './dashboardUtils';
import { getUserDisplayName } from '../lib/dal';

/**
 * Calculates start and end Date objects for a given preset or custom interval
 */
export function getDateRangeBoundaries(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): { startDate: Date; endDate: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  // Set end of today by default
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today': {
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
    case 'this_week': {
      // Start of current week (Monday)
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1; // 0 is Sunday
      start.setDate(now.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
    case 'this_month': {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
    case 'last_month': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: firstOfLastMonth, endDate: lastOfLastMonth };
    }
    case 'this_quarter': {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstMonthOfQuarter = currentQuarter * 3;
      start.setFullYear(now.getFullYear(), firstMonthOfQuarter, 1);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
    case 'this_year': {
      start.setFullYear(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
    case 'custom': {
      if (customStart) {
        const s = new Date(customStart);
        if (!isNaN(s.getTime())) {
          s.setHours(0, 0, 0, 0);
          start.setTime(s.getTime());
        }
      } else {
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
      }

      if (customEnd) {
        const e = new Date(customEnd);
        if (!isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999);
          end.setTime(e.getTime());
        }
      }
      return { startDate: start, endDate: end };
    }
    default: {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
  }
}

/**
 * Checks if a date falls strictly within the interval [startDate, endDate]
 */
export function isWithinDateRange(
  dateInput: string | Date | undefined | null,
  range: { startDate: Date; endDate: Date }
): boolean {
  if (!dateInput) return false;
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const time = d.getTime();
  if (isNaN(time)) return false;

  return time >= range.startDate.getTime() && time <= range.endDate.getTime();
}

/**
 * Formats a monetary number into standard SAR / OMR representation
 */
export function formatCurrency(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return 'SAR 0';
  }
  return `SAR ${Number(val).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Calculates standard conversion rate: Won / (Won + Lost) * 100
 */
export function calculateConversionRate(won: number, lost: number): { rate: number; display: string } {
  const totalClosed = won + lost;
  if (totalClosed === 0) {
    return { rate: 0, display: won > 0 ? '100%' : '0%' };
  }
  const rate = (won / totalClosed) * 100;
  return {
    rate: Number(rate.toFixed(1)),
    display: `${rate.toFixed(1)}%`,
  };
}

/**
 * Follow-up completion rate: Completed / (Completed + Cancelled) * 100
 */
export function calculateFollowupCompletionRate(
  completed: number,
  cancelled: number
): { rate: number; display: string } {
  const totalResolved = completed + cancelled;
  if (totalResolved === 0) {
    return { rate: 0, display: completed > 0 ? '100%' : '0%' };
  }
  const rate = (completed / totalResolved) * 100;
  return {
    rate: Number(rate.toFixed(1)),
    display: `${rate.toFixed(1)}%`,
  };
}

/**
 * Calculates high-level summary KPIs for the period and current pipeline
 */
export function calculateMetricSummary(
  allLeads: LeadRecord[],
  filteredLeadsForPeriod: LeadRecord[],
  activitiesInPeriod: LeadActivityRecord[],
  followups: FollowUpRecord[],
  followupsInPeriod: FollowUpRecord[]
): MetricSummary {
  // Current Pipeline totals
  const totalLeads = allLeads.length;
  const activeLeads = allLeads.filter((l) =>
    ['new', 'contacted', 'interested', 'meeting', 'quotation', 'negotiation'].includes(
      l.status.toLowerCase()
    )
  ).length;
  const wonLeads = allLeads.filter((l) => l.status.toLowerCase() === 'won').length;
  const lostLeads = allLeads.filter((l) => l.status.toLowerCase() === 'lost').length;
  const hotLeads = allLeads.filter((l) => l.priority === 'Hot').length;

  const conv = calculateConversionRate(wonLeads, lostLeads);

  // Pipeline Values
  let totalPipelineValue = 0;
  let wonPipelineValue = 0;
  let activePipelineValue = 0;
  let lostPipelineValue = 0;
  let validValueCount = 0;

  allLeads.forEach((l) => {
    const val = typeof l.estimated_value === 'number' ? l.estimated_value : 0;
    if (val > 0) {
      totalPipelineValue += val;
      validValueCount++;
      const statusLower = l.status.toLowerCase();
      if (statusLower === 'won') {
        wonPipelineValue += val;
      } else if (statusLower === 'lost') {
        lostPipelineValue += val;
      } else {
        activePipelineValue += val;
      }
    }
  });

  const averageLeadValue = validValueCount > 0 ? Math.round(totalPipelineValue / validValueCount) : 0;

  // Activities & Follow-ups in Period
  const totalActivities = activitiesInPeriod.length;

  // Follow-up status counts
  const completedFollowups = followupsInPeriod.filter((f) => f.status === 'completed').length;
  const cancelledFollowups = followupsInPeriod.filter((f) => f.status === 'cancelled').length;
  const overdueFollowups = followups.filter((f) => isFollowUpOverdue(f)).length;
  const pendingFollowups = followups.filter((f) => f.status === 'pending').length;

  const fuRate = calculateFollowupCompletionRate(completedFollowups, cancelledFollowups);

  return {
    totalLeads,
    activeLeads,
    wonLeads,
    lostLeads,
    hotLeads,
    conversionRate: conv.rate,
    conversionRateDisplay: conv.display,
    totalActivities,
    completedFollowups,
    overdueFollowups,
    pendingFollowups,
    totalPipelineValue,
    wonPipelineValue,
    activePipelineValue,
    lostPipelineValue,
    averageLeadValue,
    followupCompletionRate: fuRate.rate,
    followupCompletionRateDisplay: fuRate.display,
  };
}

/**
 * 8 Canonical Pipeline Stages with Colors & Breakdown
 */
export const CANONICAL_STAGES: {
  id: LeadStatus;
  label: string;
  color: string;
  bg: string;
  textColor: string;
}[] = [
  { id: 'New', label: 'New Lead', color: '#6366f1', bg: 'bg-indigo-50', textColor: 'text-indigo-700' },
  { id: 'Contacted', label: 'Contacted', color: '#0ea5e9', bg: 'bg-sky-50', textColor: 'text-sky-700' },
  { id: 'Interested', label: 'Interested', color: '#06b6d4', bg: 'bg-cyan-50', textColor: 'text-cyan-700' },
  { id: 'Meeting', label: 'Meeting', color: '#8b5cf6', bg: 'bg-purple-50', textColor: 'text-purple-700' },
  { id: 'Quotation', label: 'Quotation', color: '#f59e0b', bg: 'bg-amber-50', textColor: 'text-amber-700' },
  { id: 'Negotiation', label: 'Negotiation', color: '#f97316', bg: 'bg-orange-50', textColor: 'text-orange-700' },
  { id: 'Won', label: 'Won Deal', color: '#10b981', bg: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { id: 'Lost', label: 'Lost Lead', color: '#64748b', bg: 'bg-slate-100', textColor: 'text-slate-700' },
];

/**
 * Computes pipeline stage distribution with values and percentage
 */
export function aggregatePipelineDistribution(leads: LeadRecord[]): StageMetric[] {
  const totalCount = leads.length;

  return CANONICAL_STAGES.map((stg) => {
    const stageLeads = leads.filter((l) => l.status.toLowerCase() === stg.id.toLowerCase());
    const count = stageLeads.length;
    const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    const totalValue = stageLeads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0);

    return {
      stage: stg.id,
      label: stg.label,
      count,
      percentage,
      totalValue,
      color: stg.color,
      bg: stg.bg,
      textColor: stg.textColor,
    };
  });
}

/**
 * Aggregates Team Performance per dynamic active salesman
 */
export function aggregateSalesTeamPerformance(
  activeSalesmen: UserProfile[],
  leads: LeadRecord[],
  activities: LeadActivityRecord[],
  followups: FollowUpRecord[]
): SalesmanPerformanceMetric[] {
  return activeSalesmen.map((salesman) => {
    const sId = salesman.id;
    const sLeads = leads.filter((l) => l.assigned_to === sId);
    const totalLeads = sLeads.length;

    const activeLeads = sLeads.filter((l) =>
      ['new', 'contacted', 'interested', 'meeting', 'quotation', 'negotiation'].includes(
        l.status.toLowerCase()
      )
    ).length;

    const hotLeads = sLeads.filter((l) => l.priority === 'Hot').length;
    const wonLeads = sLeads.filter((l) => l.status.toLowerCase() === 'won').length;
    const lostLeads = sLeads.filter((l) => l.status.toLowerCase() === 'lost').length;

    const conv = calculateConversionRate(wonLeads, lostLeads);

    const sActivities = activities.filter(
      (a) => a.performed_by === sId || a.created_by === sId
    );
    const totalActivities = sActivities.length;

    const sFollowups = followups.filter((f) => f.assigned_to === sId);
    const completedFollowups = sFollowups.filter((f) => f.status === 'completed').length;
    const overdueFollowups = sFollowups.filter((f) => isFollowUpOverdue(f)).length;
    const pendingFollowups = sFollowups.filter((f) => f.status === 'pending').length;

    const pipelineValue = sLeads.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);
    const wonValue = sLeads
      .filter((l) => l.status.toLowerCase() === 'won')
      .reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

    return {
      salesmanId: sId,
      salesmanName: salesman.full_name || salesman.email.split('@')[0],
      email: salesman.email,
      avatarUrl: salesman.avatar_url,
      isActive: salesman.is_active,
      totalLeads,
      activeLeads,
      hotLeads,
      wonLeads,
      lostLeads,
      conversionRate: conv.rate,
      conversionRateDisplay: conv.display,
      totalActivities,
      completedFollowups,
      overdueFollowups,
      pendingFollowups,
      pipelineValue,
      wonValue,
    };
  });
}

/**
 * Aggregates performance by dynamic dimension (e.g. Lead Source or Lead Type)
 */
export function aggregateDimensionBreakdown(
  leads: LeadRecord[],
  field: 'source' | 'lead_type'
): DimensionBreakdown[] {
  const totalAllLeads = leads.length;
  const map = new Map<
    string,
    { total: number; active: number; won: number; lost: number; value: number }
  >();

  leads.forEach((lead) => {
    const rawVal = lead[field];
    const key = (rawVal && rawVal.trim() !== '' ? rawVal.trim() : 'Direct / Unspecified');

    const entry = map.get(key) || { total: 0, active: 0, won: 0, lost: 0, value: 0 };
    entry.total += 1;

    const status = lead.status.toLowerCase();
    if (status === 'won') entry.won += 1;
    else if (status === 'lost') entry.lost += 1;
    else entry.active += 1;

    entry.value += Number(lead.estimated_value) || 0;
    map.set(key, entry);
  });

  const result: DimensionBreakdown[] = [];
  map.forEach((entry, name) => {
    const conv = calculateConversionRate(entry.won, entry.lost);
    const pct = totalAllLeads > 0 ? (entry.total / totalAllLeads) * 100 : 0;

    result.push({
      name,
      totalLeads: entry.total,
      activeLeads: entry.active,
      wonLeads: entry.won,
      lostLeads: entry.lost,
      conversionRate: conv.rate,
      conversionRateDisplay: conv.display,
      estimatedValue: entry.value,
      percentageOfTotal: Number(pct.toFixed(1)),
    });
  });

  // Sort by totalLeads desc
  return result.sort((a, b) => b.totalLeads - a.totalLeads);
}

/**
 * Activity Type Breakdown
 */
export function aggregateActivityBreakdown(activities: LeadActivityRecord[]): ActivityBreakdown[] {
  const total = activities.length;
  const countMap: Record<string, number> = {};

  const COLOR_PALETTE: Record<string, string> = {
    Call: '#3b82f6',
    WhatsApp: '#10b981',
    Email: '#8b5cf6',
    Meeting: '#f59e0b',
    Quotation: '#ec4899',
    'Site Visit': '#06b6d4',
    Note: '#64748b',
    'Follow-up': '#6366f1',
    'Status Change': '#14b8a6',
    'Priority Change': '#f97316',
    Assignment: '#a855f7',
    'Lead Created': '#3b82f6',
    Other: '#94a3b8',
  };

  activities.forEach((act) => {
    const type = act.activity_type || 'Other';
    countMap[type] = (countMap[type] || 0) + 1;
  });

  return Object.keys(countMap)
    .map((type) => ({
      type,
      count: countMap[type],
      percentage: total > 0 ? Math.round((countMap[type] / total) * 100) : 0,
      color: COLOR_PALETTE[type] || '#64748b',
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Aggregates Time-series Trend Data across the selected Date Range
 */
export function aggregateTimeSeriesTrends(
  leads: LeadRecord[],
  activities: LeadActivityRecord[],
  followups: FollowUpRecord[],
  range: { startDate: Date; endDate: Date }
): TimeSeriesPoint[] {
  const startMs = range.startDate.getTime();
  const endMs = range.endDate.getTime();
  const diffDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));

  const pointsMap = new Map<string, TimeSeriesPoint>();

  // Determine grouping interval:
  // <= 14 days: Daily
  // 15 - 90 days: Weekly or every 3-5 days
  // > 90 days: Monthly
  if (diffDays <= 14) {
    // Generate each day
    const cursor = new Date(range.startDate);
    while (cursor.getTime() <= range.endDate.getTime()) {
      const key = cursor.toISOString().split('T')[0];
      const display = cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      pointsMap.set(key, {
        dateKey: key,
        displayDate: display,
        leadsCreated: 0,
        leadsWon: 0,
        leadsLost: 0,
        activities: 0,
        followupsCompleted: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (diffDays <= 90) {
    // Generate ~10-12 interval bins
    const stepDays = Math.ceil(diffDays / 10);
    const cursor = new Date(range.startDate);
    while (cursor.getTime() <= range.endDate.getTime()) {
      const key = cursor.toISOString().split('T')[0];
      const display = cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      pointsMap.set(key, {
        dateKey: key,
        displayDate: display,
        leadsCreated: 0,
        leadsWon: 0,
        leadsLost: 0,
        activities: 0,
        followupsCompleted: 0,
      });
      cursor.setDate(cursor.getDate() + stepDays);
    }
  } else {
    // Monthly grouping
    const cursor = new Date(range.startDate);
    cursor.setDate(1);
    while (cursor.getTime() <= range.endDate.getTime()) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const display = cursor.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      pointsMap.set(key, {
        dateKey: key,
        displayDate: display,
        leadsCreated: 0,
        leadsWon: 0,
        leadsLost: 0,
        activities: 0,
        followupsCompleted: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // Find nearest key for a timestamp
  const findBinKey = (dStr?: string) => {
    if (!dStr) return null;
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return null;

    if (diffDays > 90) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const dayKey = d.toISOString().split('T')[0];
    if (pointsMap.has(dayKey)) return dayKey;

    // Nearest bin
    const keys = Array.from(pointsMap.keys()).sort();
    for (let i = keys.length - 1; i >= 0; i--) {
      if (keys[i] <= dayKey) return keys[i];
    }
    return keys[0] || null;
  };

  // Populate Leads created & Won
  leads.forEach((l) => {
    if (isWithinDateRange(l.created_at, range)) {
      const k = findBinKey(l.created_at);
      if (k && pointsMap.has(k)) {
        const pt = pointsMap.get(k)!;
        pt.leadsCreated += 1;
      }
    }

    if (l.status.toLowerCase() === 'won' && isWithinDateRange(l.updated_at || l.closing_date, range)) {
      const k = findBinKey(l.updated_at || l.closing_date);
      if (k && pointsMap.has(k)) {
        const pt = pointsMap.get(k)!;
        pt.leadsWon += 1;
      }
    }

    if (l.status.toLowerCase() === 'lost' && isWithinDateRange(l.updated_at, range)) {
      const k = findBinKey(l.updated_at);
      if (k && pointsMap.has(k)) {
        const pt = pointsMap.get(k)!;
        pt.leadsLost += 1;
      }
    }
  });

  // Populate Activities
  activities.forEach((act) => {
    const actTime = act.activity_at || act.activity_date || act.created_at;
    if (isWithinDateRange(actTime, range)) {
      const k = findBinKey(actTime);
      if (k && pointsMap.has(k)) {
        const pt = pointsMap.get(k)!;
        pt.activities += 1;
      }
    }
  });

  // Populate Follow-up completions
  followups.forEach((f) => {
    if (f.status === 'completed' && isWithinDateRange(f.completed_at || f.updated_at, range)) {
      const k = findBinKey(f.completed_at || f.updated_at);
      if (k && pointsMap.has(k)) {
        const pt = pointsMap.get(k)!;
        pt.followupsCompleted += 1;
      }
    }
  });

  return Array.from(pointsMap.values());
}

/**
 * Extracts Recently Won Leads with metadata
 */
export function findRecentWins(
  leads: LeadRecord[],
  users: UserProfile[],
  limitCount: number = 10
): RecentWinRecord[] {
  const wonLeads = leads.filter((l) => l.status.toLowerCase() === 'won');

  const sorted = [...wonLeads].sort((a, b) => {
    const dateA = new Date(a.closing_date || a.updated_at || a.created_at).getTime();
    const dateB = new Date(b.closing_date || b.updated_at || b.created_at).getTime();
    return dateB - dateA;
  });

  return sorted.slice(0, limitCount).map((lead) => {
    const dateStr = lead.closing_date || lead.updated_at || lead.created_at;
    const wonDate = new Date(dateStr);
    const wonDateDisplay = !isNaN(wonDate.getTime())
      ? wonDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Recently';

    return {
      leadId: lead.id,
      companyName: lead.company_name,
      contactPerson: lead.contact_person,
      salesmanId: lead.assigned_to,
      salesmanName: getUserDisplayName(lead.assigned_to, users),
      estimatedValue: Number(lead.final_value || lead.estimated_value || 0),
      wonDate: dateStr,
      wonDateDisplay,
      leadType: lead.lead_type,
      source: lead.source,
    };
  });
}

/**
 * Attention / Risk Analysis
 * Identifies high overdue follow-ups, hot leads with no upcoming follow-ups, and unassigned leads
 */
export function calculateAttentionRisks(
  leads: LeadRecord[],
  followups: FollowUpRecord[],
  users: UserProfile[],
  isAdmin: boolean
): AttentionRiskItem[] {
  const risks: AttentionRiskItem[] = [];

  // 1. Overdue Follow-ups
  const overdueList = followups.filter((f) => isFollowUpOverdue(f));
  overdueList.slice(0, 5).forEach((fu) => {
    risks.push({
      id: `overdue_${fu.id}`,
      leadId: fu.lead_id,
      title: `Overdue Follow-up: ${fu.company_name || 'Lead'}`,
      description: `Task "${fu.action}" was due on ${new Date(fu.scheduled_at).toLocaleDateString()}. Needs immediate outreach.`,
      severity: 'high',
      category: 'overdue_followup',
      dateStr: fu.scheduled_at,
      salesmanName: getUserDisplayName(fu.assigned_to, users),
    });
  });

  // 2. Hot Leads without Pending Follow-up
  const pendingByLead = new Set(
    followups.filter((f) => f.status === 'pending').map((f) => f.lead_id)
  );

  const hotLeadsWithoutFollowup = leads.filter(
    (l) =>
      l.priority === 'Hot' &&
      !['won', 'lost'].includes(l.status.toLowerCase()) &&
      !pendingByLead.has(l.id)
  );

  hotLeadsWithoutFollowup.slice(0, 5).forEach((lead) => {
    risks.push({
      id: `hot_no_fu_${lead.id}`,
      leadId: lead.id,
      title: `Hot Lead with No Follow-up: ${lead.company_name}`,
      description: `Urgent priority account currently has 0 upcoming scheduled tasks. High risk of lead going cold.`,
      severity: 'high',
      category: 'hot_without_followup',
      salesmanName: getUserDisplayName(lead.assigned_to, users),
    });
  });

  // 3. Unassigned Leads (Admin view only)
  if (isAdmin) {
    const unassignedLeads = leads.filter(
      (l) => !l.assigned_to || l.assigned_to === 'unassigned' || l.assigned_to.trim() === ''
    );

    unassignedLeads.slice(0, 5).forEach((lead) => {
      risks.push({
        id: `unassigned_${lead.id}`,
        leadId: lead.id,
        title: `Unassigned Account: ${lead.company_name}`,
        description: `Lead created on ${new Date(lead.created_at).toLocaleDateString()} has not been assigned to a sales representative.`,
        severity: 'medium',
        category: 'unassigned',
      });
    });
  }

  return risks;
}
