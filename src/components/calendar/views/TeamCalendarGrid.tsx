import React from 'react';
import { Users, Clock, MapPin, AlertTriangle, CheckCircle2, ShieldCheck, Plus } from 'lucide-react';
import { FollowUpRecord, UserProfile } from '../../../types/database';
import {
  WORK_HOURS,
  isSameDay,
  getActionBadgeConfig,
  formatAppointmentTime,
  getEventDurationMinutes,
  safeDate,
  checkScheduleConflict,
} from '../../../lib/calendarUtils';
import { isFollowUpOverdue } from '../../../utils/dashboardUtils';

interface TeamCalendarGridProps {
  currentDate: Date;
  events: FollowUpRecord[];
  salesmen: UserProfile[];
  onSelectEvent: (event: FollowUpRecord) => void;
  onSelectSlot: (date: Date, timeStr: string, salesmanId?: string) => void;
}

export const TeamCalendarGrid: React.FC<TeamCalendarGridProps> = ({
  currentDate,
  events,
  salesmen,
  onSelectEvent,
  onSelectSlot,
}) => {
  const activeSalesmen = salesmen.filter(
    (s) => s.role === 'SALESMAN' || s.role === 'ADMIN'
  );

  const formatHourLabel = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-x-auto">
      <div className="min-w-[850px]">
        {/* Header: Salesmen Columns */}
        <div
          className="grid border-b border-slate-200 bg-slate-50/90 sticky top-0 z-10"
          style={{
            gridTemplateColumns: `80px repeat(${Math.max(1, activeSalesmen.length)}, 1fr)`,
          }}
        >
          <div className="p-3 border-r border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center">
            Time
          </div>
          {activeSalesmen.map((rep) => {
            const repEventsToday = events.filter(
              (e) => e.assigned_to === rep.id && isSameDay(e.scheduled_at, currentDate)
            );

            return (
              <div
                key={rep.id}
                className="p-3 text-center border-r border-slate-200 last:border-r-0"
              >
                <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-slate-900 truncate">
                  <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {rep.full_name?.charAt(0) || 'U'}
                  </div>
                  <span className="truncate">{rep.full_name}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1 text-[10px] text-slate-500">
                  <span className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-md">
                    {repEventsToday.length} booking{repEventsToday.length !== 1 ? 's' : ''}
                  </span>
                  <span>{rep.role}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hourly Rows */}
        <div className="divide-y divide-slate-100">
          {WORK_HOURS.map((hour) => {
            const timeFormatted = `${String(hour).padStart(2, '0')}:00`;

            return (
              <div
                key={hour}
                className="grid min-h-[68px]"
                style={{
                  gridTemplateColumns: `80px repeat(${Math.max(1, activeSalesmen.length)}, 1fr)`,
                }}
              >
                {/* Time Column */}
                <div className="p-2 border-r border-slate-200 text-right text-[11px] font-semibold text-slate-400 select-none bg-slate-50/40">
                  {formatHourLabel(hour)}
                </div>

                {/* Salesmen Columns */}
                {activeSalesmen.map((rep) => {
                  const matchingEvents = events.filter((e) => {
                    if (e.assigned_to !== rep.id) return false;
                    if (!isSameDay(e.scheduled_at, currentDate)) return false;
                    const d = safeDate(e.scheduled_at);
                    return d && d.getHours() === hour;
                  });

                  // Has conflict check (more than 1 active event at same hour)
                  const hasMultiple = matchingEvents.filter(
                    (e) => e.status !== 'cancelled' && e.status !== 'rescheduled'
                  ).length > 1;

                  return (
                    <div
                      key={rep.id + '-' + hour}
                      onClick={() => onSelectSlot(currentDate, timeFormatted, rep.id)}
                      className={`relative border-r border-slate-200 last:border-r-0 p-1 group transition cursor-pointer hover:bg-indigo-50/20 ${
                        hasMultiple ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Plus icon on hover for empty slot */}
                      {matchingEvents.length === 0 && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full text-slate-300 group-hover:text-indigo-500 transition">
                          <Plus className="h-3.5 w-3.5" />
                        </div>
                      )}

                      {/* Conflict Indicator */}
                      {hasMultiple && (
                        <div className="flex items-center gap-1 mb-1 px-1 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                          <span>Overlap Conflict</span>
                        </div>
                      )}

                      {/* Events Cards */}
                      <div className="space-y-1">
                        {matchingEvents.map((event) => {
                          const badge = getActionBadgeConfig(event.action);
                          const isOverdue = isFollowUpOverdue(event);
                          const duration = getEventDurationMinutes(event);
                          const timeStr = formatAppointmentTime(event.scheduled_at);

                          return (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent(event);
                              }}
                              className={`rounded-xl p-2 text-xs border shadow-2xs transition hover:shadow-xs hover:brightness-95 cursor-pointer ${
                                event.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 line-through opacity-80'
                                  : event.status === 'cancelled'
                                  ? 'bg-slate-100 text-slate-500 border-slate-200 line-through opacity-60'
                                  : isOverdue
                                  ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold'
                                  : `${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="font-bold text-[11px] truncate flex items-center gap-1">
                                  <span className={`h-1.5 w-1.5 rounded-full ${badge.dotColor}`} />
                                  {timeStr}
                                </span>
                                <span className="text-[10px] opacity-75">{duration}m</span>
                              </div>

                              <div className="font-bold truncate text-[11px] text-slate-900">
                                {event.title || event.company_name}
                              </div>

                              {event.location && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate mt-0.5">
                                  <MapPin className="h-3 w-3 shrink-0 text-rose-500" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
