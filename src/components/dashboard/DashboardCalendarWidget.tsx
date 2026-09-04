import React, { useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Compass,
} from 'lucide-react';
import { FollowUpRecord, UserProfile } from '../../types/database';
import { NavigationView } from '../../types/crm';
import {
  formatAppointmentTime,
  formatTimeRange,
  getActionBadgeConfig,
  getEventDurationMinutes,
  isSameDay,
  checkScheduleConflict,
} from '../../lib/calendarUtils';
import { isFollowUpDueToday, isFollowUpOverdue } from '../../utils/dashboardUtils';

interface DashboardCalendarWidgetProps {
  followups: FollowUpRecord[];
  allUsers?: UserProfile[];
  onSelectView: (view: NavigationView, options?: any) => void;
  onSelectLead?: (leadId: string) => void;
  onOpenComplete?: (followup: FollowUpRecord) => void;
  onOpenReschedule?: (followup: FollowUpRecord) => void;
  onOpenSchedule?: () => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

export const DashboardCalendarWidget: React.FC<DashboardCalendarWidgetProps> = ({
  followups,
  allUsers = [],
  onSelectView,
  onSelectLead,
  onOpenComplete,
  onOpenReschedule,
  onOpenSchedule,
  currentUserId,
  isAdmin = false,
}) => {
  const today = new Date();

  // Filter today's active appointments
  const todayEvents = useMemo(() => {
    return followups
      .filter((f) => {
        if (f.status === 'cancelled' || f.status === 'rescheduled') return false;
        if (!isAdmin && currentUserId && f.assigned_to !== currentUserId) return false;
        return isFollowUpDueToday(f) || isSameDay(f.scheduled_at, today);
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [followups, isAdmin, currentUserId, today]);

  // Upcoming meetings & site visits in next 7 days
  const upcomingMeetingsAndVisits = useMemo(() => {
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);

    return followups
      .filter((f) => {
        if (f.status !== 'pending') return false;
        if (!isAdmin && currentUserId && f.assigned_to !== currentUserId) return false;
        const d = new Date(f.scheduled_at);
        const actionLower = (f.action || '').toLowerCase();
        const isMeetingOrVisit = actionLower.includes('meeting') || actionLower.includes('visit');
        return isMeetingOrVisit && d > today && d <= next7Days;
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 3);
  }, [followups, isAdmin, currentUserId, today]);

  // Conflict check for today's active items
  const conflictCount = useMemo(() => {
    let conflicts = 0;
    for (let i = 0; i < todayEvents.length; i++) {
      for (let j = i + 1; j < todayEvents.length; j++) {
        const e1 = todayEvents[i];
        const e2 = todayEvents[j];
        if (e1.assigned_to === e2.assigned_to && e1.status === 'pending' && e2.status === 'pending') {
          const s1 = new Date(e1.scheduled_at).getTime();
          const e1End = e1.end_time ? new Date(e1.end_time).getTime() : s1 + 30 * 60000;
          const s2 = new Date(e2.scheduled_at).getTime();
          const e2End = e2.end_time ? new Date(e2.end_time).getTime() : s2 + 30 * 60000;
          if (s1 < e2End && e1End > s2) {
            conflicts++;
          }
        }
      }
    }
    return conflicts;
  }, [todayEvents]);

  return (
    <div
      id="dashboard-calendar-widget"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4"
    >
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Today's Sales Schedule &amp; Appointments</span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                {todayEvents.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Meetings, client visits, and time-sensitive follow-ups
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSchedule && (
            <button
              type="button"
              onClick={onOpenSchedule}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-600" />
              <span>Schedule</span>
            </button>
          )}

          <button
            id="widget-open-sales-calendar-btn"
            type="button"
            onClick={() => onSelectView('calendar')}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
          >
            <span>Full Calendar</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Conflict Alert Banner if any */}
      {conflictCount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 border border-amber-200 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="font-semibold">
              {conflictCount} overlapping appointment conflict{conflictCount > 1 ? 's' : ''} detected today!
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectView('calendar')}
            className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950"
          >
            Resolve in Calendar
          </button>
        </div>
      )}

      {/* Today's Schedule List */}
      <div className="space-y-2">
        {todayEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1">
            <Clock className="h-6 w-6 text-slate-400 mx-auto" />
            <div className="font-semibold text-slate-700">No appointments scheduled for today</div>
            <p className="text-[11px]">
              Click "Schedule" or open the Full Calendar to plan your day.
            </p>
          </div>
        ) : (
          todayEvents.map((event) => {
            const badge = getActionBadgeConfig(event.action);
            const isOverdue = isFollowUpOverdue(event);
            const duration = getEventDurationMinutes(event);
            const timeRange = formatTimeRange(event.scheduled_at, event.end_time, duration);

            return (
              <div
                key={event.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 transition hover:shadow-2xs ${
                  event.status === 'completed'
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : isOverdue
                    ? 'bg-rose-50/40 border-rose-200'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${badge.dotColor}`} />
                      <span>{event.action}</span>
                    </span>

                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>{timeRange}</span>
                    </span>

                    {isOverdue && (
                      <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-800">
                        Overdue
                      </span>
                    )}

                    {event.status === 'completed' && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                        Completed
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-bold text-slate-900 truncate">
                    {event.title || event.company_name}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">{event.company_name}</span>
                    {event.location && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    )}
                    {isAdmin && event.assigned_to_name && (
                      <span className="text-indigo-700 font-medium">
                        • {event.assigned_to_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {event.status === 'pending' && onOpenComplete && (
                    <button
                      type="button"
                      onClick={() => onOpenComplete(event)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
                    >
                      Complete
                    </button>
                  )}
                  {event.status === 'pending' && onOpenReschedule && (
                    <button
                      type="button"
                      onClick={() => onOpenReschedule(event)}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                    >
                      Reschedule
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upcoming Meetings & Visits Preview (Next 7 days) */}
      {upcomingMeetingsAndVisits.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Upcoming Meetings &amp; Field Visits (Next 7 Days)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {upcomingMeetingsAndVisits.map((item) => {
              const d = new Date(item.scheduled_at);
              const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
              const timeStr = formatAppointmentTime(item.scheduled_at);
              const badge = getActionBadgeConfig(item.action);

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectView('calendar')}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 hover:bg-white hover:border-indigo-300 transition cursor-pointer shadow-2xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-md">
                      {dateStr} • {timeStr}
                    </span>
                    <span className={`h-1.5 w-1.5 rounded-full ${badge.dotColor}`} />
                  </div>
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {item.company_name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {item.action}: {item.title || item.location || 'Scheduled'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
