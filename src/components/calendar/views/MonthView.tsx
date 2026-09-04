import React from 'react';
import { Plus, Clock, MapPin, Building2, Users } from 'lucide-react';
import { FollowUpRecord } from '../../../types/database';
import {
  getMonthViewDays,
  isSameDay,
  getActionBadgeConfig,
  formatAppointmentTime,
} from '../../../lib/calendarUtils';
import { isFollowUpOverdue } from '../../../utils/dashboardUtils';

interface MonthViewProps {
  currentDate: Date;
  events: FollowUpRecord[];
  onSelectEvent: (event: FollowUpRecord) => void;
  onSelectDate: (date: Date) => void;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  onSelectEvent,
  onSelectDate,
}) => {
  const days = getMonthViewDays(currentDate);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {/* Day of Week Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-600">
        {WEEK_DAYS.map((dayName, idx) => (
          <div
            key={dayName}
            className={`py-2.5 border-r border-slate-200 last:border-r-0 ${
              idx === 5 || idx === 6 ? 'text-slate-400 bg-slate-100/50' : ''
            }`}
          >
            <span>{dayName}</span>
            {(idx === 5 || idx === 6) && (
              <span className="block text-[9px] font-normal text-slate-400">Weekend</span>
            )}
          </div>
        ))}
      </div>

      {/* Grid Cells */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day, dayIdx) => {
          // Find events for this day
          const dayEvents = events.filter((e) => isSameDay(e.scheduled_at, day.date));

          return (
            <div
              key={day.dateString}
              id={`month-day-${day.dateString}`}
              className={`min-h-[110px] sm:min-h-[130px] p-1.5 border-b border-r border-slate-200 last:border-r-0 flex flex-col transition group ${
                !day.isCurrentMonth
                  ? 'bg-slate-50/50 text-slate-400'
                  : day.isWeekend
                  ? 'bg-slate-50/20'
                  : 'bg-white'
              } ${day.isToday ? 'bg-indigo-50/30' : ''}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1 px-1">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    day.isToday
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : day.isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  {day.date.getDate()}
                </span>

                {/* Quick Add Button on Hover */}
                <button
                  type="button"
                  onClick={() => onSelectDate(day.date)}
                  className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition cursor-pointer"
                  title="Schedule on this day"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Events List inside Day Cell */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => {
                  const badge = getActionBadgeConfig(event.action);
                  const isOverdue = isFollowUpOverdue(event);
                  const timeStr = formatAppointmentTime(event.scheduled_at);

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      className={`w-full text-left truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium border flex items-center gap-1 transition cursor-pointer shadow-2xs hover:brightness-95 ${
                        event.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through opacity-75'
                          : event.status === 'cancelled'
                          ? 'bg-slate-100 text-slate-500 border-slate-200 line-through opacity-60'
                          : isOverdue
                          ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                          : `${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`
                      }`}
                      title={`${event.action}: ${event.company_name} (${timeStr})`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dotColor}`} />
                      <span className="font-bold shrink-0">{timeStr}</span>
                      <span className="truncate">{event.title || event.company_name}</span>
                    </button>
                  );
                })}

                {/* More events indicator */}
                {dayEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onSelectDate(day.date)}
                    className="w-full text-center text-[10px] font-bold text-indigo-600 hover:text-indigo-800 py-0.5 cursor-pointer"
                  >
                    +{dayEvents.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
