import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  FileText,
  MapPin,
  AlertOctagon,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { ActivityBreakdown, MetricSummary } from '../../types/reports';
import { FollowUpRecord } from '../../types/database';

interface ActivityAndFollowupAnalyticsProps {
  activityBreakdown: ActivityBreakdown[];
  totalActivities: number;
  followupsInPeriod: FollowUpRecord[];
  allFollowups: FollowUpRecord[];
  metrics: MetricSummary;
}

const TYPE_ICONS: Record<string, any> = {
  Call: Phone,
  WhatsApp: MessageSquare,
  Email: Mail,
  Meeting: Calendar,
  Quotation: FileText,
  'Site Visit': MapPin,
  Note: FileText,
  'Follow-up': Clock,
};

export const ActivityAndFollowupAnalytics: React.FC<ActivityAndFollowupAnalyticsProps> = ({
  activityBreakdown,
  totalActivities,
  followupsInPeriod,
  allFollowups,
  metrics,
}) => {
  // Follow-up status aggregations
  const completedCount = followupsInPeriod.filter((f) => f.status === 'completed').length;
  const rescheduledCount = followupsInPeriod.filter((f) => f.status === 'rescheduled').length;
  const cancelledCount = followupsInPeriod.filter((f) => f.status === 'cancelled').length;
  const pendingCount = allFollowups.filter((f) => f.status === 'pending').length;
  const overdueCount = metrics.overdueFollowups;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Activity Volume & Types */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900">Communication &amp; Activity Mix</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Engagement actions logged across phone calls, WhatsApp, emails, and meetings
            </p>
          </div>
          <div className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md">
            {totalActivities} Total Actions
          </div>
        </div>

        {activityBreakdown.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-8">
            No activities logged during this period.
          </div>
        ) : (
          <div className="space-y-3">
            {activityBreakdown.map((item) => {
              const IconComp = TYPE_ICONS[item.type] || Activity;
              return (
                <div key={item.type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <span
                        className="p-1 rounded text-white"
                        style={{ backgroundColor: item.color }}
                      >
                        <IconComp className="h-3 w-3" />
                      </span>
                      <span>{item.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.count}</span>
                      <span className="text-[11px] font-medium text-slate-500">({item.percentage}%)</span>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Follow-up Discipline & Execution */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Follow-up Execution &amp; Discipline</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Task completion adherence, rescheduling frequency, and backlog health
              </p>
            </div>
            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              {metrics.followupCompletionRateDisplay} Resolution Rate
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {/* Completed */}
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-900">Completed</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold text-emerald-950 mt-1">{completedCount}</div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Tasks resolved in period</div>
            </div>

            {/* Overdue */}
            <div
              className={`p-3 rounded-lg border ${
                overdueCount > 0
                  ? 'border-rose-200 bg-rose-50/70 text-rose-950'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold">Overdue Now</span>
                <AlertOctagon
                  className={`h-4 w-4 ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}
                />
              </div>
              <div className="text-xl font-extrabold mt-1">{overdueCount}</div>
              <div className="text-[10px] opacity-80 font-medium mt-0.5">Past scheduled deadline</div>
            </div>

            {/* Pending Scheduled */}
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-900">Pending</span>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xl font-extrabold text-blue-950 mt-1">{pendingCount}</div>
              <div className="text-[10px] text-blue-700 font-medium mt-0.5">Scheduled in calendar</div>
            </div>

            {/* Rescheduled */}
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900">Rescheduled</span>
                <RotateCcw className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-xl font-extrabold text-amber-950 mt-1">{rescheduledCount}</div>
              <div className="text-[10px] text-amber-700 font-medium mt-0.5">Date postponed</div>
            </div>

            {/* Cancelled */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">Cancelled</span>
                <XCircle className="h-4 w-4 text-slate-500" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">{cancelledCount}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">Dismissed or not needed</div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <strong>Discipline Benchmark:</strong> High-performing sales organizations maintain over 85% on-time follow-up execution with zero overdue accounts.
        </div>
      </div>
    </div>
  );
};
