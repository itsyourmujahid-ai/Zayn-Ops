import React from 'react';
import {
  Clock,
  MapPin,
  Building2,
  Users,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { FollowUpRecord } from '../../../types/database';
import {
  getWeekViewDays,
  isSameDay,
  WORK_HOURS,
  getActionBadgeConfig,
  formatAppointmentTime,
  getEventDurationMinutes,
  safeDate,
} from '../../../lib/calendarUtils';
import { isFollowUpOverdue } from '../../../utils/dashboardUtils';

interface WeekViewProps {
  currentDate: Date;
  events: FollowUpRecord[];
  onSelectEvent: (event: FollowUpRecord) => void;
  onSelectSlot: (date: Date, timeStr: string) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  onSelectEvent,
  onSelectSlot,
}) => {
  const weekDays = getWeekViewDays(currentDate);

  const formatHourLabel = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header Row: Days */}
        <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50/90 sticky top-0 z-10">
          <div className="p-3 border-r border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center">
            GMT+4
          </div>
          {weekDays.map((day) => {
            const dayEventsCount = events.filter((e) => isSameDay(e.scheduled_at, day.date)).length;
            return (
              <div
                key={day.dateString}
                className={`py-3 px-2 text-center border-r border-slate-200 last:border-r-0 ${
                  day.isToday ? 'bg-indigo-50/50' : day.isWeekend ? 'bg-slate-100/40' : ''
                }`}
              >
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  {day.date.toLocaleDateString([], { weekday: 'short' })}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                      day.isToday
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-800'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                </div>
                {dayEventsCount > 0 && (
                  <span className="inline-block mt-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-full">
                    {dayEventsCount} appt{dayEventsCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Hourly Grid Rows */}
        <div className="divide-y divide-slate-100">
          {WORK_HOURS.map((hour) => {
            const timeFormatted = `${String(hour).padStart(2, '0')}:00`;

            return (
              <div
                key={hour}
                className="grid grid-cols-[80px_repeat(7,1fr)] min-h-[64px]"
              >
                {/* Hour Label */}
                <div className="p-2 border-r border-slate-200 text-right text-[11px] font-semibold text-slate-400 select-none bg-slate-50/30">
                  {formatHourLabel(hour)}
                </div>

                {/* 7 Columns for Days */}
                {weekDays.map((day) => {
                  // Find events starting in this hour on this day
                  const matchingEvents = events.filter((e) => {
                    if (!isSameDay(e.scheduled_at, day.date)) return false;
                    const d = safeDate(e.scheduled_at);
                    return d && d.getHours() === hour;
                  });

                  return (
                    <div
                      key={day.dateString + '-' + hour}
                      id={`week-slot-${day.dateString}-${hour}`}
                      onClick={() => onSelectSlot(day.date, timeFormatted)}
                      className={`relative border-r border-slate-200 last:border-r-0 p-1 group transition cursor-pointer hover:bg-indigo-50/20 ${
                        day.isToday ? 'bg-indigo-50/10' : day.isWeekend ? 'bg-slate-50/20' : ''
                      }`}
                    >
                      {/* Plus icon on hover for empty slot */}
                      {matchingEvents.length === 0 && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full text-slate-300 group-hover:text-indigo-500 transition">
                          <Plus className="h-3.5 w-3.5" />
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
                                <span className="text-[10px] opacity-75 font-normal">
                                  {duration}m
                                </span>
                              </div>

                              <div className="font-bold truncate text-[11px] text-slate-900">
                                {event.title || event.company_name}
                              </div>

                              {event.company_name && event.title && (
                                <div className="truncate text-[10px] text-slate-600">
                                  {event.company_name}
                                </div>
                              )}

                              {event.location && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate mt-0.5">
                                  <MapPin className="h-3 w-3 shrink-0 text-rose-500" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}

                              {event.assigned_to_name && (
                                <div className="text-[9px] text-slate-500 truncate mt-1 pt-1 border-t border-slate-200/50">
                                  Rep: {event.assigned_to_name}
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
