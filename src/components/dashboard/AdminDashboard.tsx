import React from 'react';
import {
  Users,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Trophy,
  XCircle,
  HelpCircle,
  TrendingUp,
  ArrowUpRight,
  Layers,
  Sparkles,
  Calendar,
  CalendarClock,
} from 'lucide-react';
import {
  FollowUpRecord,
  LeadRecord,
  LeadActivityRecord,
  UserProfile,
  LeadStatus,
} from '../../types/database';
import { NavigationView } from '../../types/crm';
import {
  isFollowUpDueToday,
  isFollowUpOverdue,
  isFollowUpUpcoming,
} from '../../utils/dashboardUtils';
import { QuickActionsBar } from './QuickActionsBar';
import { UrgentAttentionSection } from './UrgentAttentionSection';
import { SalesTeamOverview } from './SalesTeamOverview';
import { LeadPipelineOverview } from './LeadPipelineOverview';
import { RecentActivityFeed } from './RecentActivityFeed';
import { DashboardCalendarWidget } from './DashboardCalendarWidget';

interface AdminDashboardProps {
  leads: LeadRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  salesmen: UserProfile[];
  allUsers: UserProfile[];
  onOpenAddLead: () => void;
  onOpenScheduleFollowUp: () => void;
  onSelectLead: (leadId: string) => void;
  onOpenCompleteFollowUp: (followup: FollowUpRecord) => void;
  onOpenRescheduleFollowUp: (followup: FollowUpRecord) => void;
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  leads,
  followups,
  activities,
  salesmen,
  allUsers,
  onOpenAddLead,
  onOpenScheduleFollowUp,
  onSelectLead,
  onOpenCompleteFollowUp,
  onOpenRescheduleFollowUp,
  onSelectView,
}) => {
  // Lead Overview Metrics
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === 'New').length;
  const activeLeads = leads.filter(
    (l) => l.status !== 'Won' && l.status !== 'Lost'
  ).length;
  const hotLeads = leads.filter((l) => l.priority === 'Hot').length;
  const wonLeads = leads.filter((l) => l.status === 'Won').length;
  const lostLeads = leads.filter((l) => l.status === 'Lost').length;
  const unassignedLeads = leads.filter(
    (l) =>
      !l.assigned_to ||
      l.assigned_to === 'unassigned' ||
      l.assigned_to === '' ||
      l.assigned_to === 'none'
  ).length;

  // Follow-up Overview Metrics
  const pendingFollowups = followups.filter((f) => f.status === 'pending');
  const overdueFollowups = pendingFollowups.filter((f) => isFollowUpOverdue(f)).length;
  const todayFollowups = pendingFollowups.filter((f) => isFollowUpDueToday(f)).length;
  const upcomingFollowups = pendingFollowups.filter((f) => isFollowUpUpcoming(f)).length;
  const completedFollowups = followups.filter((f) => f.status === 'completed').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner: Quick Actions & Overdue Alert */}
      <QuickActionsBar
        role="ADMIN"
        onOpenAddLead={onOpenAddLead}
        onOpenScheduleFollowUp={onOpenScheduleFollowUp}
        onSelectView={onSelectView}
      />

      {/* 1. KEY KPI STAT CARDS (LEADS & FOLLOW-UPS) */}
      <div className="space-y-4">
        {/* Section Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              CRM Overview &amp; Health
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Real-time aggregate data
          </span>
        </div>

        {/* Lead Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Total Leads */}
          <button
            type="button"
            onClick={() => onSelectView('leads')}
            className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-indigo-300 hover:shadow-sm transition cursor-pointer text-left group"
          >
            <span className="text-[11px] font-semibold text-slate-500 group-hover:text-indigo-600">
              Total Leads
            </span>
            <div className="mt-1 text-2xl font-black text-slate-900">{totalLeads}</div>
            <span className="text-[10px] text-slate-400 mt-1">All registered</span>
          </button>

          {/* New Leads */}
          <button
            type="button"
            onClick={() => onSelectView('leads', { leadFilter: { stage: 'New' } })}
            className="flex flex-col items-start p-3.5 rounded-xl border border-blue-100 bg-blue-50/50 shadow-xs hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer text-left group"
          >
            <span className="text-[11px] font-semibold text-blue-700">New Leads</span>
            <div className="mt-1 text-2xl font-black text-blue-900">{newLeads}</div>
            <span className="text-[10px] text-blue-500 mt-1">Uncontacted</span>
          </button>

          {/* Active Leads */}
          <button
            type="button"
            onClick={() => onSelectView('leads')}
            className="flex flex-col items-start p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 shadow-xs hover:border-indigo-300 hover:bg-indigo-50 transition cursor-pointer text-left group"
          >
            <span className="text-[11px] font-semibold text-indigo-700">Active Pipeline</span>
            <div className="mt-1 text-2xl font-black text-indigo-900">{activeLeads}</div>
            <span className="text-[10px] text-indigo-500 mt-1">In progress</span>
          </button>

          {/* Hot Leads */}
          <button
            type="button"
            onClick={() => onSelectView('leads', { leadFilter: { priority: 'Hot' } })}
            className="flex flex-col items-start p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 shadow-xs hover:border-amber-300 hover:bg-amber-100/60 transition cursor-pointer text-left group"
          >
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-amber-800">Hot Leads</span>
              <Flame className="h-3 w-3 text-amber-600 fill-amber-500" />
            </div>
            <div className="mt-1 text-2xl font-black text-amber-900">{hotLeads}</div>
            <span className="text-[10px] text-amber-600 mt-1">Top conversion</span>
          </button>

          {/* Won Leads */}
          <button
            type="button"
            onClick={() => onSelectView('leads', { leadFilter: { stage: 'Won' } })}
            className="flex flex-col items-start p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 shadow-xs hover:border-emerald-300 hover:bg-emerald-50 transition cursor-pointer text-left group"
          >
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-emerald-800">Won</span>
              <Trophy className="h-3 w-3 text-emerald-600" />
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-900">{wonLeads}</div>
            <span className="text-[10px] text-emerald-600 mt-1">Closed deals</span>
          </button>

          {/* Lost Leads */}
          <button
            type="button"
            onClick={() => onSelectView('leads', { leadFilter: { stage: 'Lost' } })}
            className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 shadow-xs hover:border-slate-300 transition cursor-pointer text-left group"
          >
            <span className="text-[11px] font-semibold text-slate-600">Lost</span>
            <div className="mt-1 text-2xl font-black text-slate-700">{lostLeads}</div>
            <span className="text-[10px] text-slate-400 mt-1">Closed lost</span>
          </button>

          {/* Unassigned Leads */}
          <button
            type="button"
            onClick={() => onSelectView('leads', { leadFilter: { salesman: 'unassigned' } })}
            className={`flex flex-col items-start p-3.5 rounded-xl border shadow-xs transition cursor-pointer text-left group ${
              unassignedLeads > 0
                ? 'border-purple-200 bg-purple-50 hover:bg-purple-100'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span
              className={`text-[11px] font-bold ${
                unassignedLeads > 0 ? 'text-purple-800' : 'text-slate-500'
              }`}
            >
              Unassigned
            </span>
            <div
              className={`mt-1 text-2xl font-black ${
                unassignedLeads > 0 ? 'text-purple-900' : 'text-slate-900'
              }`}
            >
              {unassignedLeads}
            </div>
            <span className="text-[10px] text-purple-600 mt-1">Needs salesman</span>
          </button>
        </div>

        {/* Follow-up KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Overdue Follow-ups */}
          <button
            type="button"
            onClick={() => onSelectView('followups', { followupTab: 'overdue' })}
            className={`flex items-center justify-between p-3.5 rounded-xl border shadow-xs transition cursor-pointer text-left ${
              overdueFollowups > 0
                ? 'border-rose-300 bg-rose-50 hover:bg-rose-100'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <AlertCircle
                  className={`h-4 w-4 ${
                    overdueFollowups > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'
                  }`}
                />
                <span
                  className={`text-xs font-bold ${
                    overdueFollowups > 0 ? 'text-rose-900' : 'text-slate-700'
                  }`}
                >
                  Overdue Tasks
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Missed schedule</p>
            </div>
            <div
              className={`text-2xl font-black ${
                overdueFollowups > 0 ? 'text-rose-700' : 'text-slate-700'
              }`}
            >
              {overdueFollowups}
            </div>
          </button>

          {/* Due Today */}
          <button
            type="button"
            onClick={() => onSelectView('followups', { followupTab: 'today' })}
            className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 shadow-xs hover:border-amber-300 hover:bg-amber-100/60 transition cursor-pointer text-left"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-900">Due Today</span>
              </div>
              <p className="text-[10px] text-amber-700 mt-0.5">Scheduled for today</p>
            </div>
            <div className="text-2xl font-black text-amber-900">{todayFollowups}</div>
          </button>

          {/* Upcoming */}
          <button
            type="button"
            onClick={() => onSelectView('followups', { followupTab: 'upcoming' })}
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition cursor-pointer text-left"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">Upcoming</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Future commitments</p>
            </div>
            <div className="text-2xl font-black text-indigo-900">{upcomingFollowups}</div>
          </button>

          {/* Completed */}
          <button
            type="button"
            onClick={() => onSelectView('followups', { followupTab: 'completed' })}
            className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/40 shadow-xs hover:border-emerald-200 hover:bg-emerald-50 transition cursor-pointer text-left"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-900">Completed</span>
              </div>
              <p className="text-[10px] text-emerald-600 mt-0.5">Resolved follow-ups</p>
            </div>
            <div className="text-2xl font-black text-emerald-800">{completedFollowups}</div>
          </button>
        </div>
      </div>

      {/* 2. SALES CALENDAR & APPOINTMENTS (PHASE U) */}
      <DashboardCalendarWidget
        followups={followups}
        allUsers={allUsers}
        onSelectView={onSelectView}
        onSelectLead={onSelectLead}
        onOpenComplete={onOpenCompleteFollowUp}
        onOpenReschedule={onOpenRescheduleFollowUp}
        onOpenSchedule={onOpenScheduleFollowUp}
        isAdmin={true}
      />

      {/* 3. URGENT ATTENTION SECTION (OVERDUE + HOT) */}
      <UrgentAttentionSection
        followups={followups}
        leads={leads}
        users={allUsers}
        onSelectLead={onSelectLead}
        onOpenComplete={onOpenCompleteFollowUp}
        onOpenReschedule={onOpenRescheduleFollowUp}
        onViewAllOverdue={() => onSelectView('followups', { followupTab: 'overdue' })}
      />

      {/* 3. PIPELINE STAGE SUMMARY */}
      <LeadPipelineOverview
        leads={leads}
        onSelectStage={(stage) => onSelectView('leads', { leadFilter: { stage } })}
      />

      {/* 4. SALES TEAM OVERVIEW & RECENT ACTIVITY DUAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales Team Performance (7 Cols) */}
        <div className="lg:col-span-7">
          <SalesTeamOverview
            salesmen={salesmen}
            leads={leads}
            followups={followups}
            onSelectSalesman={(salesmanId) =>
              onSelectView('leads', { leadFilter: { salesman: salesmanId } })
            }
          />
        </div>

        {/* Recent Activity Feed (5 Cols) */}
        <div className="lg:col-span-5">
          <RecentActivityFeed
            activities={activities}
            leads={leads}
            users={allUsers}
            onSelectLead={onSelectLead}
            title="CRM Activity Feed"
            maxItems={8}
          />
        </div>
      </div>
    </div>
  );
};
