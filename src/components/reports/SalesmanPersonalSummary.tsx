import React from 'react';
import {
  UserCheck,
  Target,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Flame,
  Award,
  Zap,
} from 'lucide-react';
import { MetricSummary } from '../../types/reports';
import { formatCurrency } from '../../utils/reportUtils';

interface SalesmanPersonalSummaryProps {
  metrics: MetricSummary;
  userName: string;
}

export const SalesmanPersonalSummary: React.FC<SalesmanPersonalSummaryProps> = ({
  metrics,
  userName,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
            <UserCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Personal Sales Scorecard &amp; Discipline Overview
            </h3>
            <p className="text-xs text-slate-500">
              Welcome back, <strong className="text-slate-800">{userName}</strong>. Here is your operational focus and task health.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Win Rate */}
        <div className="p-3.5 rounded-lg border border-teal-200 bg-teal-50/50 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-teal-800">My Win Rate</div>
            <div className="text-xl font-bold text-teal-950 mt-0.5">{metrics.conversionRateDisplay}</div>
            <div className="text-[10px] text-teal-700 mt-0.5">{metrics.wonLeads} deals won</div>
          </div>
          <Award className="h-7 w-7 text-teal-600 opacity-80" />
        </div>

        {/* Task Completion Rate */}
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-800">Follow-up Discipline</div>
            <div className="text-xl font-bold text-emerald-950 mt-0.5">{metrics.followupCompletionRateDisplay}</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">{metrics.completedFollowups} tasks completed</div>
          </div>
          <CheckCircle2 className="h-7 w-7 text-emerald-600 opacity-80" />
        </div>

        {/* Hot Leads */}
        <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-rose-800">Hot Priority Accounts</div>
            <div className="text-xl font-bold text-rose-950 mt-0.5">{metrics.hotLeads}</div>
            <div className="text-[10px] text-rose-700 mt-0.5">High probability closing</div>
          </div>
          <Flame className="h-7 w-7 text-rose-600 opacity-80" />
        </div>

        {/* Overdue Alert */}
        <div
          className={`p-3.5 rounded-lg border flex items-center justify-between ${
            metrics.overdueFollowups > 0
              ? 'border-rose-300 bg-rose-50/80 text-rose-900'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          <div>
            <div className="text-[11px] font-semibold">Overdue Tasks</div>
            <div className="text-xl font-bold mt-0.5">{metrics.overdueFollowups}</div>
            <div className="text-[10px] opacity-80 mt-0.5">
              {metrics.overdueFollowups > 0 ? 'Action required immediately' : 'Zero overdue backlog'}
            </div>
          </div>
          <AlertOctagon
            className={`h-7 w-7 ${
              metrics.overdueFollowups > 0 ? 'text-rose-600' : 'text-slate-400'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
