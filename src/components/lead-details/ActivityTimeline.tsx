import React from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  FileText,
  StickyNote,
  MapPin,
  Clock,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  Calendar,
  User,
  ArrowRight,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { LeadActivityRecord, ActivityType } from '../../types/database';

interface ActivityTimelineProps {
  activities: LeadActivityRecord[];
  loading?: boolean;
  onLogFirstActivity?: () => void;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  loading = false,
  onLogFirstActivity,
}) => {
  if (loading && activities.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2"></div>
        <p className="text-xs font-semibold text-slate-500">Loading timeline history...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3">
          <Clock className="h-6 w-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-900">No Activity History Yet</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Start recording calls, messages, meetings, and notes to build an accurate client history.
        </p>
        {onLogFirstActivity && (
          <button
            type="button"
            onClick={onLogFirstActivity}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Log First Activity</span>
          </button>
        )}
      </div>
    );
  }

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Recently';

      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) {
        return `Today at ${timeStr}`;
      }
      if (isYesterday) {
        return `Yesterday at ${timeStr}`;
      }
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${timeStr}`;
    } catch {
      return 'Recently';
    }
  };

  const getActivityConfig = (type: ActivityType | string) => {
    switch (type) {
      case 'Call':
        return {
          icon: <Phone className="h-4 w-4" />,
          color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
          badgeColor: 'bg-indigo-100 text-indigo-800',
          lineColor: 'border-indigo-200',
        };
      case 'WhatsApp':
        return {
          icon: <MessageSquare className="h-4 w-4" />,
          color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
          badgeColor: 'bg-emerald-100 text-emerald-800',
          lineColor: 'border-emerald-200',
        };
      case 'Email':
        return {
          icon: <Mail className="h-4 w-4" />,
          color: 'bg-blue-50 text-blue-600 border-blue-200',
          badgeColor: 'bg-blue-100 text-blue-800',
          lineColor: 'border-blue-200',
        };
      case 'Meeting':
        return {
          icon: <Users className="h-4 w-4" />,
          color: 'bg-purple-50 text-purple-600 border-purple-200',
          badgeColor: 'bg-purple-100 text-purple-800',
          lineColor: 'border-purple-200',
        };
      case 'Quotation':
        return {
          icon: <FileText className="h-4 w-4" />,
          color: 'bg-amber-50 text-amber-600 border-amber-200',
          badgeColor: 'bg-amber-100 text-amber-800',
          lineColor: 'border-amber-200',
        };
      case 'Site Visit':
        return {
          icon: <MapPin className="h-4 w-4" />,
          color: 'bg-rose-50 text-rose-600 border-rose-200',
          badgeColor: 'bg-rose-100 text-rose-800',
          lineColor: 'border-rose-200',
        };
      case 'Note':
        return {
          icon: <StickyNote className="h-4 w-4" />,
          color: 'bg-slate-100 text-slate-700 border-slate-300',
          badgeColor: 'bg-slate-100 text-slate-800',
          lineColor: 'border-slate-200',
        };
      case 'Lead Created':
        return {
          icon: <Sparkles className="h-4 w-4" />,
          color: 'bg-sky-50 text-sky-600 border-sky-200',
          badgeColor: 'bg-sky-100 text-sky-800',
          lineColor: 'border-sky-200',
        };
      case 'Status Change':
        return {
          icon: <TrendingUp className="h-4 w-4" />,
          color: 'bg-teal-50 text-teal-600 border-teal-200',
          badgeColor: 'bg-teal-100 text-teal-800',
          lineColor: 'border-teal-200',
        };
      case 'Priority Change':
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          color: 'bg-orange-50 text-orange-600 border-orange-200',
          badgeColor: 'bg-orange-100 text-orange-800',
          lineColor: 'border-orange-200',
        };
      case 'Assignment':
        return {
          icon: <UserCheck className="h-4 w-4" />,
          color: 'bg-violet-50 text-violet-600 border-violet-200',
          badgeColor: 'bg-violet-100 text-violet-800',
          lineColor: 'border-violet-200',
        };
      case 'Attachment Uploaded':
        return {
          icon: <Paperclip className="h-4 w-4" />,
          color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
          badgeColor: 'bg-cyan-100 text-cyan-800',
          lineColor: 'border-cyan-200',
        };
      case 'Attachment Deleted':
        return {
          icon: <Trash2 className="h-4 w-4" />,
          color: 'bg-rose-50 text-rose-600 border-rose-200',
          badgeColor: 'bg-rose-100 text-rose-800',
          lineColor: 'border-rose-200',
        };
      default:
        return {
          icon: <HelpCircle className="h-4 w-4" />,
          color: 'bg-slate-100 text-slate-600 border-slate-200',
          badgeColor: 'bg-slate-100 text-slate-700',
          lineColor: 'border-slate-200',
        };
    }
  };

  return (
    <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
      {activities.map((act) => {
        const config = getActivityConfig(act.activity_type);
        const timestamp = act.activity_at || act.activity_date || act.created_at;

        return (
          <div key={act.id} className="relative group">
            {/* Timeline Icon Node */}
            <div
              className={`absolute -left-6 sm:-left-8 top-1 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border shadow-xs transition-transform group-hover:scale-110 ${config.color}`}
            >
              {config.icon}
            </div>

            {/* Timeline Card */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
              {/* Header row: Badge + Outcome + Timestamp */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${config.badgeColor}`}
                  >
                    {act.activity_type}
                  </span>

                  {act.outcome && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {act.outcome}
                    </span>
                  )}

                  {act.is_system_activity && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-slate-100 text-slate-500">
                      System
                    </span>
                  )}
                </div>

                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  {formatTimestamp(timestamp)}
                </span>
              </div>

              {/* Value Transition (For Status / Priority / Assignment changes) */}
              {act.previous_value && act.new_value && (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-700 border border-slate-200">
                  <span className="line-through text-slate-400 font-medium">{act.previous_value}</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className="font-bold text-slate-900">{act.new_value}</span>
                </div>
              )}

              {/* Notes / Description */}
              {(act.notes || act.description) && (
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-line">
                  {act.notes || act.description}
                </p>
              )}

              {/* Footer: Performed by */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="h-3 w-3 text-slate-400" />
                  <span>By:</span>
                  <strong className="text-slate-800 font-semibold">
                    {act.performed_by_name || 'CRM System'}
                  </strong>
                </span>

                {act.scheduled_followup_id && (
                  <span className="flex items-center gap-1 text-indigo-600 font-semibold text-[11px]">
                    <Calendar className="h-3 w-3" />
                    <span>Follow-up Scheduled</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
