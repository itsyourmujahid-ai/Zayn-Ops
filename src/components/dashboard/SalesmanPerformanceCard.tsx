import React from 'react';
import {
  Target,
  Trophy,
  TrendingUp,
  CheckCircle2,
  CalendarClock,
  Activity,
  AlertCircle,
  Award,
} from 'lucide-react';
import { UserProfile, LeadRecord, FollowUpRecord, LeadActivityRecord } from '../../types/database';

interface SalesmanPerformanceCardProps {
  userProfile: UserProfile;
  leads: LeadRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
}

export const SalesmanPerformanceCard: React.FC<SalesmanPerformanceCardProps> = ({
  userProfile,
  leads,
  followups,
  activities,
}) => {
  // Target Configurations (No fake targets; strictly from database)
  const targetRevenue = (userProfile as any)?.target_revenue
    ? Number((userProfile as any).target_revenue)
    : null;
  const targetLeads = (userProfile as any)?.target_leads
    ? Number((userProfile as any).target_leads)
    : null;

  const hasConfiguredTarget = targetRevenue !== null || targetLeads !== null;

  // Closed Won Leads & Values
  const wonLeads = leads.filter((l) => l.status === 'Won');
  const closedWonCount = wonLeads.length;
  const closedWonValue = wonLeads.reduce(
    (sum, l) => sum + (Number(l.deal_value || (l as any).value) || 0),
    0
  );

  // Conversion Rate (Won / (Won + Lost) or Won / Total if no Lost)
  const lostCount = leads.filter((l) => l.status === 'Lost').length;
  const closedTotal = closedWonCount + lostCount;
  const conversionRate =
    closedTotal > 0
      ? Math.round((closedWonCount / closedTotal) * 100)
      : leads.length > 0
      ? Math.round((closedWonCount / leads.length) * 100)
      : 0;

  // Completed Actions
  const followupsCompleted = followups.filter((f) => f.status === 'completed').length;
  const myActivitiesCompleted = activities.filter(
    (a) => a.created_by === userProfile.id || (a as any).salesman_id === userProfile.id
  ).length;

  // Target Achievement calculations
  let pendingRevenue: number | null = null;
  let revenueProgressPct: number = 0;
  if (targetRevenue !== null) {
    pendingRevenue = Math.max(0, targetRevenue - closedWonValue);
    revenueProgressPct = targetRevenue > 0 ? Math.min(100, Math.round((closedWonValue / targetRevenue) * 100)) : 0;
  }

  let pendingLeads: number | null = null;
  let leadsProgressPct: number = 0;
  if (targetLeads !== null) {
    pendingLeads = Math.max(0, targetLeads - closedWonCount);
    leadsProgressPct = targetLeads > 0 ? Math.min(100, Math.round((closedWonCount / targetLeads) * 100)) : 0;
  }

  return (
    <div
      id="salesman-performance-card"
      className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              backgroundColor: 'var(--color-primary-subtle)',
              color: 'var(--color-primary)',
            }}
          >
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">Targets &amp; Performance</h3>
            <p className="text-xs text-[var(--text-muted)]">Real-time tracking of quotas and commercial milestones</p>
          </div>
        </div>

        <div>
          {hasConfiguredTarget ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              <span>Target Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 border border-slate-200">
              <AlertCircle className="h-3 w-3" />
              <span>Target Not Configured</span>
            </span>
          )}
        </div>
      </div>

      {/* Target Progress Bar (Only if configured) */}
      {hasConfiguredTarget ? (
        <div className="rounded-xl bg-[var(--bg-elevated)] p-4 border border-[var(--border-color)] space-y-3">
          {targetRevenue !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-main)]">
                <span>Revenue Target ({targetRevenue.toLocaleString()} OMR)</span>
                <span className="text-[var(--color-primary)] font-bold">{revenueProgressPct}% Achieved</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${revenueProgressPct}%`,
                    backgroundColor: 'var(--color-primary)',
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                <span>Achieved: {closedWonValue.toLocaleString()} OMR</span>
                <span>Pending: {pendingRevenue?.toLocaleString()} OMR</span>
              </div>
            </div>
          )}

          {targetLeads !== null && (
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-main)]">
                <span>Deals Won Target ({targetLeads} Deals)</span>
                <span className="text-emerald-600 font-bold">{leadsProgressPct}% Achieved</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${leadsProgressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                <span>Won: {closedWonCount}</span>
                <span>Pending: {pendingLeads}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
          <div className="text-xs font-semibold text-slate-700">Target Not Configured</div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            No formal sales quota has been set for your account. You can still track your operational achievements below.
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Closed Won Leads */}
        <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/40">
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800">
            <Trophy className="h-3 w-3 text-emerald-600" />
            <span>Closed Won</span>
          </div>
          <div className="mt-1 text-xl font-black text-emerald-950">{closedWonCount}</div>
          <span className="text-[10px] text-emerald-700 font-medium">
            {closedWonValue.toLocaleString()} OMR Total
          </span>
        </div>

        {/* Conversion Rate */}
        <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/40">
          <div className="flex items-center gap-1 text-[11px] font-bold text-blue-800">
            <TrendingUp className="h-3 w-3 text-blue-600" />
            <span>Conversion Rate</span>
          </div>
          <div className="mt-1 text-xl font-black text-blue-950">{conversionRate}%</div>
          <span className="text-[10px] text-blue-700 font-medium">Won to total</span>
        </div>

        {/* Follow-ups Completed */}
        <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40">
          <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-800">
            <CalendarClock className="h-3 w-3 text-indigo-600" />
            <span>Completed Follow-ups</span>
          </div>
          <div className="mt-1 text-xl font-black text-indigo-950">{followupsCompleted}</div>
          <span className="text-[10px] text-indigo-700 font-medium">Actions executed</span>
        </div>

        {/* Activities Logged */}
        <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/40">
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
            <Activity className="h-3 w-3 text-amber-600" />
            <span>Activities Logged</span>
          </div>
          <div className="mt-1 text-xl font-black text-amber-950">{myActivitiesCompleted}</div>
          <span className="text-[10px] text-amber-700 font-medium">Calls, notes &amp; meetings</span>
        </div>
      </div>
    </div>
  );
};
