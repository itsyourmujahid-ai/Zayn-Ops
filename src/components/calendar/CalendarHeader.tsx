import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Search,
  Users,
  Building2,
  Clock,
  Layers,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CalendarViewMode,
  CalendarFilterState,
  UserProfile,
} from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface CalendarHeaderProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  currentDate: Date;
  onNavigatePrev: () => void;
  onNavigateToday: () => void;
  onNavigateNext: () => void;
  filters: CalendarFilterState;
  onFilterChange: (key: keyof CalendarFilterState, value: any) => void;
  salesmen: UserProfile[];
  onOpenSchedule: () => void;
  isTeamMode: boolean;
  onToggleTeamMode: (team: boolean) => void;
  totalEventsCount: number;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  viewMode,
  onViewModeChange,
  currentDate,
  onNavigatePrev,
  onNavigateToday,
  onNavigateNext,
  filters,
  onFilterChange,
  salesmen,
  onOpenSchedule,
  isTeamMode,
  onToggleTeamMode,
  totalEventsCount,
}) => {
  const { userProfile, isAdmin } = useAuth();

  // Period label formatting
  const getPeriodLabel = (): string => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (viewMode === 'week') {
      const dayOfWeek = currentDate.getDay();
      const sun = new Date(currentDate);
      sun.setDate(currentDate.getDate() - dayOfWeek);
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);

      const startStr = sun.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const endStr = sat.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${startStr} – ${endStr}`;
    }
    // Agenda
    return currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
      {/* Top Bar: Title, Date Navigator, Views & Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Navigation */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs">
            <button
              id="calendar-prev-btn"
              type="button"
              onClick={onNavigatePrev}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition cursor-pointer"
              title="Previous Period"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              id="calendar-today-btn"
              type="button"
              onClick={onNavigateToday}
              className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white hover:text-slate-900 transition cursor-pointer"
            >
              Today
            </button>
            <button
              id="calendar-next-btn"
              type="button"
              onClick={onNavigateNext}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition cursor-pointer"
              title="Next Period"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {getPeriodLabel()}
          </h2>

          <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {totalEventsCount} event{totalEventsCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Right: Team mode toggle (Admin), View Switchers & Schedule Button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Admin Team Calendar switch */}
          {isAdmin && (
            <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600 border border-slate-200">
              <button
                type="button"
                onClick={() => onToggleTeamMode(false)}
                className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  !isTeamMode
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Filtered
              </button>
              <button
                type="button"
                onClick={() => onToggleTeamMode(true)}
                className={`rounded-lg px-2.5 py-1 transition cursor-pointer flex items-center gap-1 ${
                  isTeamMode
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                <Users className="h-3 w-3" />
                <span>Team Grid</span>
              </button>
            </div>
          )}

          {/* View Mode Switchers */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs text-xs font-semibold text-slate-600">
            {(['month', 'week', 'day', 'agenda'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                id={`calendar-view-${mode}-btn`}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={`rounded-lg px-3 py-1.5 transition capitalize cursor-pointer ${
                  viewMode === mode
                    ? 'bg-white text-indigo-600 font-bold shadow-2xs'
                    : 'hover:text-slate-900'
                }`}
              >
                {mode === 'agenda' ? 'Agenda/List' : mode}
              </button>
            ))}
          </div>

          {/* New Schedule Button */}
          <button
            id="open-schedule-appointment-btn"
            type="button"
            onClick={onOpenSchedule}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 active:scale-98 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Appointment</span>
          </button>
        </div>
      </div>

      {/* Bottom Filter Row */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] sm:min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            placeholder="Search company, title, location..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Action Type Filter */}
        <select
          value={filters.eventType}
          onChange={(e) => onFilterChange('eventType', e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:border-indigo-500"
        >
          <option value="all">All Event Types</option>
          <option value="Meeting">Meetings</option>
          <option value="Site Visit">Site Visits</option>
          <option value="Call">Calls</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Email">Email</option>
          <option value="Check-in">Customer Check-ins</option>
          <option value="Requirement">New Requirements</option>
          <option value="Repeat">Repeat Order Discussions</option>
        </select>

        {/* Status Filter */}
        <select
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Scheduled (Pending)</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Record Type (Lead vs Client) */}
        <select
          value={filters.recordType}
          onChange={(e) => onFilterChange('recordType', e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:border-indigo-500"
        >
          <option value="all">All Records</option>
          <option value="lead">Leads Only</option>
          <option value="client">Clients Only</option>
        </select>

        {/* Admin Salesman Filter */}
        {isAdmin && (
          <select
            value={filters.salesmanId}
            onChange={(e) => onFilterChange('salesmanId', e.target.value)}
            className="rounded-xl border border-slate-200 bg-indigo-50/50 px-2.5 py-1.5 text-xs text-indigo-900 font-medium focus:border-indigo-500"
          >
            <option value="all">Team (All Salesmen)</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.role})
              </option>
            ))}
          </select>
        )}

        {/* Clear Filters Button if any active */}
        {(filters.eventType !== 'all' ||
          filters.status !== 'all' ||
          filters.recordType !== 'all' ||
          filters.salesmanId !== 'all' ||
          filters.searchQuery) && (
          <button
            type="button"
            onClick={() => {
              onFilterChange('eventType', 'all');
              onFilterChange('status', 'all');
              onFilterChange('recordType', 'all');
              onFilterChange('salesmanId', 'all');
              onFilterChange('searchQuery', '');
            }}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};
