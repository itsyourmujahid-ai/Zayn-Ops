import React from 'react';
import {
  Layers,
  Flame,
  Trophy,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  FollowUpRecord,
  LeadRecord,
  LeadActivityRecord,
  UserProfile,
} from '../../types/database';
import { NavigationView } from '../../types/crm';
import {
  isFollowUpDueToday,
  isFollowUpOverdue,
  isFollowUpUpcoming,
} from '../../utils/dashboardUtils';
import { QuickActionsBar } from './QuickActionsBar';
import { SalesmanTodayTasks } from './SalesmanTodayTasks';
import { SalesmanPriorityLeads } from './SalesmanPriorityLeads';
import { LeadPipelineOverview } from './LeadPipelineOverview';
import { RecentActivityFeed } from './RecentActivityFeed';
import { DashboardCalendarWidget } from './DashboardCalendarWidget';

interface SalesmanDashboardProps {
  userProfile: UserProfile;
  leads: LeadRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  allUsers: UserProfile[];
  onOpenAddLead: () => void;
  onOpenScheduleFollowUp: () => void;
  onSelectLead: (leadId: string) => void;
  onOpenCompleteFollowUp: (followup: FollowUpRecord) => void;
  onOpenRescheduleFollowUp: (followup: FollowUpRecord) => void;
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const SalesmanDashboard: React.FC<SalesmanDashboardProps> = ({
  userProfile,
  leads,
  followups,
  activities,
  allUsers,
  onOpenAddLead,
  onOpenScheduleFollowUp,
  onSelectLead,
  onOpenCompleteFollowUp,
  onOpenRescheduleFollowUp,
  onSelectView,
}) => {
  // My Leads Metrics
  const myTotalLeads = leads.length;
  const myNewLeads = leads.filter((l) => l.status === 'New').length;
  const myActiveLeads = leads.filter(
    (l) => l.status !== 'Won' && l.status !== 'Lost'
  ).length;
  const myHotLeads = leads.filter((l) => l.priority === 'Hot').length;
  const myWonLeads = leads.filter((l) => l.status === 'Won').length;
  const myLostLeads = leads.filter((l) => l.status === 'Lost').length;

  // Follow-ups metrics for this salesman
  const pendingFollowups = followups.filter((f) => f.status === 'pending');
  const overdueCount = pendingFollowups.filter((f) => isFollowUpOverdue(f)).length;
  const todayCount = pendingFollowups.filter((f) => isFollowUpDueToday(f)).length;
  const upcomingCount = pendingFollowups.filter((f) => isFollowUpUpcoming(f)).length;

  const firstName = userProfile.full_name?.split(' ')[0] || 'Sales Rep';

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[var(--border-color)] bg-[var(--bg-card)] p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Personal Sales Workspace
            </span>
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)] border border-[var(--color-primary-border)]">
              {userProfile.role}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1 text-[var(--text-main)]">
            Welcome back, {firstName}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            You have <strong className="text-[var(--text-main)] font-semibold">{todayCount}</strong> follow-up
            {todayCount !== 1 ? 's' : ''} scheduled today
            {overdueCount > 0 ? (
              <span className="text-[#F87171] font-bold ml-1">
                and {overdueCount} overdue item{overdueCount !== 1 ? 's' : ''} requiring attention
              </span>
            ) : null}
            .
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={onOpenAddLead}
            className="zaynos-btn-primary text-xs font-bold shadow-xs cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Add Lead</span>
          </button>
          <button
            type="button"
            onClick={onOpenScheduleFollowUp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-bold text-white border border-white/10 transition cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5 text-indigo-300" />
            <span>Schedule Task</span>
          </button>
        </div>
      </div>

      {/* 1. KEY KPI STAT CARDS (MY LEADS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* My Total Leads */}
        <button
          type="button"
          onClick={() => onSelectView('leads')}
          className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-indigo-300 transition cursor-pointer text-left group"
        >
          <span className="text-[11px] font-semibold text-slate-500 group-hover:text-indigo-600">
            My Total Leads
          </span>
          <div className="mt-1 text-2xl font-black text-slate-900">{myTotalLeads}</div>
          <span className="text-[10px] text-slate-400 mt-1">Assigned to you</span>
        </button>

        {/* My New Leads */}
        <button
          type="button"
          onClick={() => onSelectView('leads', { leadFilter: { stage: 'New' } })}
          className="flex flex-col items-start p-3.5 rounded-xl border border-blue-100 bg-blue-50/50 shadow-xs hover:border-blue-300 transition cursor-pointer text-left group"
        >
          <span className="text-[11px] font-semibold text-blue-700">New Leads</span>
          <div className="mt-1 text-2xl font-black text-blue-900">{myNewLeads}</div>
          <span className="text-[10px] text-blue-500 mt-1">Needs outreach</span>
        </button>

        {/* My Active Leads */}
        <button
          type="button"
          onClick={() => onSelectView('leads')}
          className="flex flex-col items-start p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 shadow-xs hover:border-indigo-300 transition cursor-pointer text-left group"
        >
          <span className="text-[11px] font-semibold text-indigo-700">Active Deals</span>
          <div className="mt-1 text-2xl font-black text-indigo-900">{myActiveLeads}</div>
          <span className="text-[10px] text-indigo-500 mt-1">In progress</span>
        </button>

        {/* My Hot Leads */}
        <button
          type="button"
          onClick={() => onSelectView('leads', { leadFilter: { priority: 'Hot' } })}
          className="flex flex-col items-start p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 shadow-xs hover:border-amber-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-amber-800">Hot Leads</span>
            <Flame className="h-3 w-3 text-amber-600 fill-amber-500" />
          </div>
          <div className="mt-1 text-2xl font-black text-amber-900">{myHotLeads}</div>
          <span className="text-[10px] text-amber-600 mt-1">Highest priority</span>
        </button>

        {/* My Won Deals */}
        <button
          type="button"
          onClick={() => onSelectView('leads', { leadFilter: { stage: 'Won' } })}
          className="flex flex-col items-start p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 shadow-xs hover:border-emerald-300 transition cursor-pointer text-left group"
        >
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-emerald-800">Won</span>
            <Trophy className="h-3 w-3 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-900">{myWonLeads}</div>
          <span className="text-[10px] text-emerald-600 mt-1">Closed deals</span>
        </button>

        {/* Overdue Alert Stat */}
        <button
          type="button"
          onClick={() => onSelectView('followups', { followupTab: 'overdue' })}
          className={`flex flex-col items-start p-3.5 rounded-xl border shadow-xs transition cursor-pointer text-left group ${
            overdueCount > 0
              ? 'border-rose-300 bg-rose-50/80 hover:bg-rose-100'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-1">
            <span
              className={`text-[11px] font-bold ${
                overdueCount > 0 ? 'text-rose-800' : 'text-slate-500'
              }`}
            >
              Overdue Tasks
            </span>
            {overdueCount > 0 && (
              <AlertCircle className="h-3 w-3 text-rose-600 animate-pulse" />
            )}
          </div>
          <div
            className={`mt-1 text-2xl font-black ${
              overdueCount > 0 ? 'text-rose-700' : 'text-slate-800'
            }`}
          >
            {overdueCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {overdueCount > 0 ? 'Action required' : 'All clear'}
          </span>
        </button>
      </div>

      {/* 2. TODAY'S WORK & ACTIONS (PRIMARY FOCUS FOR SALESMAN) */}
      <SalesmanTodayTasks
        followups={followups}
        leads={leads}
        onSelectLead={onSelectLead}
        onOpenComplete={onOpenCompleteFollowUp}
        onOpenReschedule={onOpenRescheduleFollowUp}
        onOpenScheduleFollowUp={onOpenScheduleFollowUp}
        onViewAllFollowups={() => onSelectView('followups')}
      />

      {/* 2.1 SALES CALENDAR & APPOINTMENTS (PHASE U) */}
      <DashboardCalendarWidget
        followups={followups}
        allUsers={allUsers}
        onSelectView={onSelectView}
        onSelectLead={onSelectLead}
        onOpenComplete={onOpenCompleteFollowUp}
        onOpenReschedule={onOpenRescheduleFollowUp}
        onOpenSchedule={onOpenScheduleFollowUp}
        currentUserId={userProfile.id}
        isAdmin={false}
      />

      {/* 3. PRIORITY LEADS & PERSONAL RECENT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Priority Leads (7 Cols) */}
        <div className="lg:col-span-7">
          <SalesmanPriorityLeads
            leads={leads}
            followups={followups}
            onSelectLead={onSelectLead}
            onViewAllLeads={() => onSelectView('leads')}
          />
        </div>

        {/* My Recent Activity Timeline (5 Cols) */}
        <div className="lg:col-span-5">
          <RecentActivityFeed
            activities={activities}
            leads={leads}
            users={allUsers}
            onSelectLead={onSelectLead}
            title="My Activity History"
            maxItems={8}
          />
        </div>
      </div>

      {/* 4. MY PIPELINE BREAKDOWN */}
      <LeadPipelineOverview
        leads={leads}
        title="My Pipeline Summary"
        subtitle="Stage distribution for your assigned accounts"
        onSelectStage={(stage) => onSelectView('leads', { leadFilter: { stage } })}
      />
    </div>
  );
};
