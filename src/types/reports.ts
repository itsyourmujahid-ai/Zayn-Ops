export type DateRangePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate: Date;
  endDate: Date;
  customStart?: string; // YYYY-MM-DD
  customEnd?: string;   // YYYY-MM-DD
}

export interface ReportsFilterState {
  dateRangePreset: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  selectedSalesman: string; // 'all' or userId (Admin only)
  selectedLeadType: string; // 'all' or type
  selectedSource: string;   // 'all' or source
  selectedPriority: string; // 'all' or 'Hot' | 'Warm' | 'Cold'
  selectedLocation: string; // 'all' or location
}

export interface MetricSummary {
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  lostLeads: number;
  hotLeads: number;
  conversionRate: number; // percentage (e.g. 33.3)
  conversionRateDisplay: string;
  totalActivities: number;
  completedFollowups: number;
  overdueFollowups: number;
  pendingFollowups: number;
  totalPipelineValue: number;
  wonPipelineValue: number;
  activePipelineValue: number;
  lostPipelineValue: number;
  averageLeadValue: number;
  followupCompletionRate: number; // percentage
  followupCompletionRateDisplay: string;
}

export interface StageMetric {
  stage: string;
  label: string;
  count: number;
  percentage: number;
  totalValue: number;
  color: string;
  bg: string;
  textColor: string;
}

export interface SalesmanPerformanceMetric {
  salesmanId: string;
  salesmanName: string;
  email: string;
  avatarUrl?: string;
  isActive: boolean;
  totalLeads: number;
  activeLeads: number;
  hotLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  conversionRateDisplay: string;
  totalActivities: number;
  completedFollowups: number;
  overdueFollowups: number;
  pendingFollowups: number;
  pipelineValue: number;
  wonValue: number;
}

export interface DimensionBreakdown {
  name: string;
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  conversionRateDisplay: string;
  estimatedValue: number;
  percentageOfTotal: number;
}

export interface ActivityBreakdown {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TimeSeriesPoint {
  dateKey: string;
  displayDate: string;
  leadsCreated: number;
  leadsWon: number;
  leadsLost: number;
  activities: number;
  followupsCompleted: number;
}

export interface RecentWinRecord {
  leadId: string;
  companyName: string;
  contactPerson?: string;
  salesmanId: string;
  salesmanName: string;
  estimatedValue: number;
  wonDate: string;
  wonDateDisplay: string;
  leadType?: string;
  source?: string;
}

export interface AttentionRiskItem {
  id: string;
  leadId?: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  category: 'overdue_followup' | 'hot_without_followup' | 'unassigned' | 'stalled_stage';
  dateStr?: string;
  salesmanName?: string;
}
