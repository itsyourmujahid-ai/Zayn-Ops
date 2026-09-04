import React from 'react';
import {
  Clock,
  MapPin,
  Building2,
  Users,
  Plus,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  Mail,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { FollowUpRecord } from '../../../types/database';
import {
  WORK_HOURS,
  isSameDay,
  getActionBadgeConfig,
  formatAppointmentTime,
  formatTimeRange,
  getEventDurationMinutes,
  safeDate,
} from '../../../lib/calendarUtils';
import { isFollowUpOverdue } from '../../../utils/dashboardUtils';

interface DayViewProps {
  currentDate: Date;
  events: FollowUpRecord[];
  onSelectEvent: (event: FollowUpRecord) => void;
  onSelectSlot: (date: Date, timeStr: string) => void;
  onOpenComplete?: (event: FollowUpRecord) => void;
  onOpenReschedule?: (event: FollowUpRecord) => void;
}

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  onSelectEvent,
  onSelectSlot,
  onOpenComplete,
  onOpenReschedule,
}) => {
  const dayEvents = events.filter((e) => isSameDay(e.scheduled_at, currentDate));

  const completedCount = dayEvents.filter((e) => e.status === 'completed').length;
  const overdueCount = dayEvents.filter((e) => isFollowUpOverdue(e)).length;
  const visitsCount = dayEvents.filter((e) => (e.action || '').toLowerCase().includes('visit')).length;

  const formatHourLabel = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <div className="space-y-4">
      {/* Day Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="text-[11px] font-bold uppercase text-slate-500">Total Bookings</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{dayEvents.length}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
          <div className="text-[11px] font-bold uppercase text-emerald-700">Completed</div>
          <div className="text-xl font-extrabold text-emerald-800 mt-0.5">{completedCount}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
          <div className="text-[11px] font-bold uppercase text-amber-700">Site Visits</div>
          <div className="text-xl font-extrabold text-amber-800 mt-0.5">{visitsCount}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
          <div className="text-[11px] font-bold uppercase text-rose-700">Overdue</div>
          <div className="text-xl font-extrabold text-rose-800 mt-0.5">{overdueCount}</div>
        </div>
      </div>

      {/* Hourly Schedule View */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden divide-y divide-slate-100">
        {WORK_HOURS.map((hour) => {
          const timeFormatted = `${String(hour).padStart(2, '0')}:00`;
          const hourEvents = dayEvents.filter((e) => {
            const d = safeDate(e.scheduled_at);
            return d && d.getHours() === hour;
          });

          return (
            <div
              key={hour}
              className="grid grid-cols-[100px_1fr] min-h-[72px] group hover:bg-slate-50/40 transition"
            >
              {/* Hour Column */}
              <div className="p-3 border-r border-slate-200 bg-slate-50/50 text-right text-xs font-semibold text-slate-500 select-none">
                {formatHourLabel(hour)}
              </div>

              {/* Slot Area */}
              <div
                className="p-2.5 relative flex flex-col justify-center"
                onClick={() => {
                  if (hourEvents.length === 0) {
                    onSelectSlot(currentDate, timeFormatted);
                  }
                }}
              >
                {hourEvents.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onSelectSlot(currentDate, timeFormatted)}
                    className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 text-xs text-indigo-600 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 w-fit transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Schedule at {formatHourLabel(hour)}</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {hourEvents.map((event) => {
                      const badge = getActionBadgeConfig(event.action);
                      const isOverdue = isFollowUpOverdue(event);
                      const duration = getEventDurationMinutes(event);
                      const timeRange = formatTimeRange(event.scheduled_at, event.end_time, duration);

                      return (
                        <div
                          key={event.id}
                          onClick={() => onSelectEvent(event)}
                          className={`rounded-xl p-3.5 border shadow-xs transition hover:shadow-md cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            event.status === 'completed'
                              ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200'
                              : event.status === 'cancelled'
                              ? 'bg-slate-100 text-slate-600 border-slate-200 line-through'
                              : isOverdue
                              ? 'bg-rose-50 text-rose-900 border-rose-300 font-medium'
                              : 'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border ${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${badge.dotColor}`} />
                                <span>{event.action}</span>
                              </span>
                              <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                <span>{timeRange}</span>
                              </span>
                              {isOverdue && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>Overdue</span>
                                </span>
                              )}
                            </div>

                            <div className="text-sm font-bold text-slate-900">
                              {event.title || event.company_name}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                              <span className="font-semibold text-slate-800">
                                {event.company_name}
                              </span>
                              {event.contact_person && (
                                <span>• Contact: {event.contact_person}</span>
                              )}
                              {event.location && (
                                <span className="flex items-center gap-1 text-slate-600 font-medium">
                                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                                  <span>{event.location}</span>
                                </span>
                              )}
                              {event.assigned_to_name && (
                                <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-md font-semibold">
                                  Rep: {event.assigned_to_name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          {event.status === 'pending' && (
                            <div
                              className="flex items-center gap-2 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {onOpenComplete && (
                                <button
                                  type="button"
                                  onClick={() => onOpenComplete(event)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Complete</span>
                                </button>
                              )}
                              {onOpenReschedule && (
                                <button
                                  type="button"
                                  onClick={() => onOpenReschedule(event)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Reschedule</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
