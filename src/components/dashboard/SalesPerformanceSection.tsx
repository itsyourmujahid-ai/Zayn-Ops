import React from 'react';
import {
  Users,
  Briefcase,
  Trophy,
  XCircle,
  Building2,
  Clock,
  AlertCircle,
  Activity,
  Percent,
  Target,
  Plus,
  UserPlus,
  FileSpreadsheet,
  MessageSquare,
  CalendarRange,
} from 'lucide-react';
import { LeadRecord, ClientRecord, FollowUpRecord, LeadActivityRecord, TargetRecord, UserProfile } from '../../types/database';
import { DateRangePreset } from '../../types/reports';
import { NavigationView } from '../../types/crm';
import { calculateTargetProgress } from '../../utils/targetUtils';

interface SalesPerformanceSectionProps {
  leads: LeadRecord[];
  filteredLeads: LeadRecord[];
  clients: ClientRecord[];
  filteredClients: ClientRecord[];
  followups: FollowUpRecord[];
  filteredFollowups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  filteredActivities: LeadActivityRecord[];
  targets: TargetRecord[];
  activeSalesmen: UserProfile[];
  datePreset: DateRangePreset;
  onSelectDatePreset: (preset: DateRangePreset) => void;
  customStartDate: string;
  customEndDate: string;
  onChangeCustomDates: (start: string, end: string) => void;
  dateRangeDisplay: string;
  onOpenAddLead: () => void;
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const SalesPerformanceSection: React.FC<SalesPerformanceSectionProps> = ({
  leads,
  filteredLeads,
  clients,
  filteredClients,
  followups,
  filteredFollowups,
  activities,
  filteredActivities,
  targets,
  activeSalesmen,
  datePreset,
  onSelectDatePreset,
  customStartDate,
  customEndDate,
  onChangeCustomDates,
  dateRangeDisplay,
  onOpenAddLead,
  onSelectView,
}) => {
  // 1. Leads Metrics
  const totalLeadsCount = leads.length;
  const periodLeadsCount = filteredLeads.length;

  const activeLeadsCount = filteredLeads.filter(
    (l) => l.status !== 'Won' && l.status !== 'Lost'
  ).length;

  const wonLeadsCount = filteredLeads.filter((l) => l.status === 'Won').length;
  const lostLeadsCount = filteredLeads.filter((l) => l.status === 'Lost').length;

  // 2. Clients Metrics
  const totalClientsCount = clients.length;
  const periodClientsCount = filteredClients.length;

  // 3. Follow-ups Metrics
  const pendingFollowupsCount = followups.filter((f) => f.status === 'pending').length;
  const overdueFollowupsCount = followups.filter((f) => {
    if (f.status !== 'pending') return false;
    const dueTime = new Date(`${f.scheduled_date}T${f.scheduled_time || '23:59:00'}`).getTime();
    return !isNaN(dueTime) && dueTime < Date.now();
  }).length;

  // 4. Activities Metrics
  const totalActivitiesCount = filteredActivities.length;

  // 5. Lead Conversion Rate Calculation
  const closedTotal = wonLeadsCount + lostLeadsCount;
  const conversionRateClosed =
    closedTotal > 0 ? Math.round((wonLeadsCount / closedTotal) * 100) : 0;
  const conversionRateOverall =
    periodLeadsCount > 0 ? Math.round((wonLeadsCount / periodLeadsCount) * 100) : 0;

  // 6. Salesman Target Performance
  const activeTargets = targets.filter((t) => t.status === 'ACTIVE');
  let aggregateTargetPct = 0;
  if (activeTargets.length > 0) {
    const totalProgressPcts = activeTargets.reduce((sum, target) => {
      const progress = calculateTargetProgress(target, leads, clients, followups, activities);
      return sum + Math.min(150, progress.percentage);
    }, 0);
    aggregateTargetPct = Math.round(totalProgressPcts / activeTargets.length);
  }

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_quarter', label: 'Quarter' },
    { id: 'this_year', label: 'Year' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div id="sales-performance-section" className="space-y-4">
      {/* Header & Date Range Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Sales Performance
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              &bull; {dateRangeDisplay}
            </span>
          </div>
        </div>

        {/* Date Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200/80 text-xs">
          {presets.map((preset) => (
            <button
              key={preset.id}
              id={`date-preset-${preset.id}`}
              type="button"
              onClick={() => onSelectDatePreset(preset.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                datePreset === preset.id
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker Bar (when Custom Range selected) */}
      {datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <CalendarRange className="h-3.5 w-3.5 text-[#0CB675]" strokeWidth={1.75} />
            <span>Custom Period:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500">From:</label>
            <input
              id="custom-date-start-input"
              type="date"
              value={customStartDate}
              onChange={(e) => onChangeCustomDates(e.target.value, customEndDate)}
              className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-800 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500">To:</label>
            <input
              id="custom-date-end-input"
              type="date"
              value={customEndDate}
              onChange={(e) => onChangeCustomDates(customStartDate, e.target.value)}
              className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-800 text-xs"
            />
          </div>
        </div>
      )}

      {/* 10 Executive High-Signal KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Total Leads */}
        <button
          type="button"
          id="kpi-total-leads-btn"
          onClick={() => onSelectView('leads')}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Leads
            </span>
            <Users className="h-4 w-4 text-slate-400 group-hover:text-slate-600" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{periodLeadsCount}</div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>{totalLeadsCount} all-time</span>
            <span className="text-[#0CB675] font-medium group-hover:underline">View &rarr;</span>
          </div>
        </button>

        {/* 2. Active Leads */}
        <button
          type="button"
          id="kpi-active-leads-btn"
          onClick={() => onSelectView('leads')}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Active Leads
            </span>
            <Briefcase className="h-4 w-4 text-slate-400 group-hover:text-slate-600" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{activeLeadsCount}</div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>In pipeline</span>
            <span className="text-[#0CB675] font-medium group-hover:underline">Manage &rarr;</span>
          </div>
        </button>

        {/* 3. Won Leads */}
        <button
          type="button"
          id="kpi-won-leads-btn"
          onClick={() => onSelectView('leads', { leadFilter: { stage: 'Won' } })}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-emerald-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Won Deals
            </span>
            <Trophy className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{wonLeadsCount}</div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>Closed won</span>
            <span className="text-[#0CB675] font-medium group-hover:underline">View &rarr;</span>
          </div>
        </button>

        {/* 4. Lost Leads */}
        <button
          type="button"
          id="kpi-lost-leads-btn"
          onClick={() => onSelectView('leads', { leadFilter: { stage: 'Lost' } })}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Lost Leads
            </span>
            <XCircle className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-700">{lostLeadsCount}</div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>Closed lost</span>
            <span className="text-slate-600 font-medium group-hover:underline">Review &rarr;</span>
          </div>
        </button>

        {/* 5. Total Clients */}
        <button
          type="button"
          id="kpi-total-clients-btn"
          onClick={() => onSelectView('clients')}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Clients
            </span>
            <Building2 className="h-4 w-4 text-slate-400 group-hover:text-slate-600" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{totalClientsCount}</div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>+{periodClientsCount} new</span>
            <span className="text-[#0CB675] font-medium group-hover:underline">Accounts &rarr;</span>
          </div>
        </button>

        {/* 6. Pending Follow-ups */}
        <button
          type="button"
          id="kpi-pending-followups-btn"
          onClick={() => onSelectView('followups', { followupTab: 'pending' })}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Follow-ups Due
            </span>
            <Clock className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{pendingFollowupsCount}</div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>Pending</span>
            <span className="text-[#0CB675] font-medium group-hover:underline">Schedule &rarr;</span>
          </div>
        </button>

        {/* 7. Overdue Follow-ups */}
        <button
          type="button"
          id="kpi-overdue-followups-btn"
          onClick={() => onSelectView('followups', { followupTab: 'overdue' })}
          className={`flex flex-col items-start p-3.5 rounded-xl border shadow-2xs transition cursor-pointer text-left group ${
            overdueFollowupsCount > 0
              ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                overdueFollowupsCount > 0 ? 'text-rose-700' : 'text-slate-500'
              }`}
            >
              Overdue
            </span>
            <AlertCircle
              className={`h-4 w-4 ${
                overdueFollowupsCount > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}
              strokeWidth={1.75}
            />
          </div>
          <div
            className={`mt-2 text-2xl font-bold tracking-tight ${
              overdueFollowupsCount > 0 ? 'text-rose-700' : 'text-slate-700'
            }`}
          >
            {overdueFollowupsCount}
          </div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>{overdueFollowupsCount > 0 ? 'Requires action' : 'Zero overdue'}</span>
            <span className="text-rose-600 font-medium group-hover:underline">Resolve &rarr;</span>
          </div>
        </button>

        {/* 8. Total Activities */}
        <button
          type="button"
          id="kpi-total-activities-btn"
          onClick={() => onSelectView('communication-hub')}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Activities
            </span>
            <Activity className="h-4 w-4 text-slate-400 group-hover:text-slate-600" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{totalActivitiesCount}</div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>Interactions logged</span>
            <span className="text-[#0CB675] font-medium group-hover:underline">Hub &rarr;</span>
          </div>
        </button>

        {/* 9. Lead Conversion Rate */}
        <div className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs text-left">
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Conversion
            </span>
            <Percent className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {closedTotal > 0 ? `${conversionRateClosed}%` : `${conversionRateOverall}%`}
          </div>
          <div className="mt-1 w-full text-[11px] text-slate-400">
            <span>{wonLeadsCount} won of {closedTotal} closed</span>
          </div>
        </div>

        {/* 10. Salesman Target Performance */}
        <button
          type="button"
          id="kpi-target-perf-btn"
          onClick={() => onSelectView('team')}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Team Quota
            </span>
            <Target className="h-4 w-4 text-slate-400 group-hover:text-slate-600" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {activeTargets.length > 0 ? `${aggregateTargetPct}%` : '—'}
          </div>
          <div className="mt-1 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>{activeTargets.length} active quotas</span>
            <span className="text-[#0CB675] font-medium group-hover:underline">Team &rarr;</span>
          </div>
        </button>
      </div>

      {/* Admin Quick Action Shortcuts */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <span className="text-xs font-semibold text-slate-500">
          Admin Quick Actions:
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="admin-qa-add-lead-btn"
            type="button"
            onClick={onOpenAddLead}
            className="zaynops-btn-primary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>Add Lead</span>
          </button>

          <button
            id="admin-qa-add-client-btn"
            type="button"
            onClick={() => onSelectView('clients')}
            className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <Building2 className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Add Client</span>
          </button>

          <button
            id="admin-qa-add-salesman-btn"
            type="button"
            onClick={() => onSelectView('team')}
            className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Add Salesman</span>
          </button>

          <button
            id="admin-qa-set-target-btn"
            type="button"
            onClick={() => onSelectView('team')}
            className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <Target className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Set Target</span>
          </button>

          <button
            id="admin-qa-import-data-btn"
            type="button"
            onClick={() => onSelectView('data-management')}
            className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Import Data</span>
          </button>

          <button
            id="admin-qa-view-followups-btn"
            type="button"
            onClick={() => onSelectView('followups')}
            className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <Clock className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Follow-ups</span>
          </button>

          <button
            id="admin-qa-view-comm-hub-btn"
            type="button"
            onClick={() => onSelectView('communication-hub')}
            className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Communication Hub</span>
          </button>
        </div>
      </div>
    </div>
  );
};
