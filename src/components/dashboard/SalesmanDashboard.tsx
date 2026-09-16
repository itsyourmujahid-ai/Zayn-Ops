import React from 'react';
import {
  Trophy,
  Calendar,
  Plus,
} from 'lucide-react';
import {
  FollowUpRecord,
  LeadRecord,
  LeadActivityRecord,
  UserProfile,
  ClientRecord,
  TargetRecord,
} from '../../types/database';
import { NavigationView } from '../../types/crm';
import {
  isFollowUpDueToday,
  isFollowUpOverdue,
} from '../../utils/dashboardUtils';
import { SalesmanTodayTasks } from './SalesmanTodayTasks';
import { SalesmanPriorityLeads } from './SalesmanPriorityLeads';
import { LeadPipelineOverview } from './LeadPipelineOverview';
import { RecentActivityFeed } from './RecentActivityFeed';
import { DashboardCalendarWidget } from './DashboardCalendarWidget';
import { SalesmanPerformanceCard } from './SalesmanPerformanceCard';
import { useAuth } from '../../context/AuthContext';

interface SalesmanDashboardProps {
  userProfile: UserProfile;
  leads: LeadRecord[];
  clients?: ClientRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  targets?: TargetRecord[];
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
  clients = [],
  followups,
  activities,
  targets = [],
  allUsers,
  onOpenAddLead,
  onOpenScheduleFollowUp,
  onSelectLead,
  onOpenCompleteFollowUp,
  onOpenRescheduleFollowUp,
  onSelectView,
}) => {
  const { hasPermission, isAdmin } = useAuth();
  const canCreateLead = isAdmin || hasPermission('LEADS_CREATE');
  const canCreateFollowUp = isAdmin || hasPermission('FOLLOWUPS_CREATE');

  // Strictly Isolated: Only this salesman's records
  const myTotalLeads = leads.length;
  const myWonLeads = leads.filter((l) => l.status === 'Won').length;

  // Clients owned by this salesman
  const myClientsCount = clients.filter(
    (c) =>
      c.owner_id === userProfile.id ||
      (c as any).created_by === userProfile.id ||
      (c as any).salesman_id === userProfile.id
  ).length;

  // Follow-ups metrics for this salesman
  const pendingFollowups = followups.filter((f) => f.status === 'pending');
  const overdueCount = pendingFollowups.filter((f) => isFollowUpOverdue(f)).length;
  const todayCount = pendingFollowups.filter((f) => isFollowUpDueToday(f)).length;

  const firstName = userProfile.full_name?.split(' ')[0] || 'Sales Rep';

  return (
    <div className="space-y-5 pb-12">
      {/* Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80 bg-white p-4 rounded-xl shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0CB675]" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Representative Workspace
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-0.5">
            Welcome back, {firstName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            <strong className="text-slate-800 font-semibold">{todayCount}</strong> task
            {todayCount !== 1 ? 's' : ''} scheduled today
            {overdueCount > 0 ? (
              <span className="text-rose-600 font-medium ml-1">
                &bull; {overdueCount} overdue item{overdueCount !== 1 ? 's' : ''} requiring attention
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {canCreateLead && (
            <button
              id="salesman-quick-add-lead-btn"
              type="button"
              onClick={onOpenAddLead}
              className="zaynops-btn-primary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>New Lead</span>
            </button>
          )}
          {canCreateFollowUp && (
            <button
              id="salesman-quick-schedule-task-btn"
              type="button"
              onClick={onOpenScheduleFollowUp}
              className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
              <span>Schedule Action</span>
            </button>
          )}
        </div>
      </div>

      {/* MY SALES PERFORMANCE SUMMARY */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#0CB675]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Performance Summary</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Assigned Accounts
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Leads */}
          <button
            type="button"
            onClick={() => onSelectView('leads')}
            className="p-3 rounded-lg bg-slate-50/60 border border-slate-200/70 hover:border-slate-300 transition text-left cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">My Leads</span>
            <div className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{myTotalLeads}</div>
            <span className="text-[10px] text-slate-400">In my pipeline</span>
          </button>

          {/* Won */}
          <button
            type="button"
            onClick={() => onSelectView('leads', { leadFilter: { stage: 'Won' } })}
            className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-200/70 hover:border-emerald-300 transition text-left cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Won Deals</span>
            <div className="text-2xl font-bold tracking-tight text-emerald-700 mt-1">{myWonLeads}</div>
            <span className="text-[10px] text-emerald-600">Successfully closed</span>
          </button>

          {/* Clients */}
          <button
            type="button"
            onClick={() => onSelectView('clients')}
            className="p-3 rounded-lg bg-slate-50/60 border border-slate-200/70 hover:border-slate-300 transition text-left cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Clients</span>
            <div className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{myClientsCount}</div>
            <span className="text-[10px] text-slate-400">Customer accounts</span>
          </button>

          {/* Pending Follow-ups */}
          <button
            type="button"
            onClick={() => onSelectView('followups', { followupTab: 'pending' })}
            className="p-3 rounded-lg bg-slate-50/60 border border-slate-200/70 hover:border-slate-300 transition text-left cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Tasks</span>
            <div className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{pendingFollowups.length}</div>
            <span className="text-[10px] text-slate-400">
              {overdueCount > 0 ? `${overdueCount} overdue` : 'Scheduled actions'}
            </span>
          </button>
        </div>
      </div>

      {/* 1.1 TARGETS & PERFORMANCE METRICS */}
      <SalesmanPerformanceCard
        userProfile={userProfile}
        leads={leads}
        clients={clients}
        followups={followups}
        activities={activities}
        targets={targets}
      />

      {/* 2. TODAY'S WORK & ACTIONS */}
      <SalesmanTodayTasks
        followups={followups}
        leads={leads}
        onSelectLead={onSelectLead}
        onOpenComplete={onOpenCompleteFollowUp}
        onOpenReschedule={onOpenRescheduleFollowUp}
        onOpenScheduleFollowUp={onOpenScheduleFollowUp}
        onViewAllFollowups={() => onSelectView('followups')}
      />

      {/* 2.1 SALES CALENDAR & APPOINTMENTS */}
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <SalesmanPriorityLeads
            leads={leads}
            followups={followups}
            onSelectLead={onSelectLead}
            onViewAllLeads={() => onSelectView('leads')}
          />
        </div>

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
