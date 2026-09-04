import {
  FollowUpRecord,
  ScheduleConflictDetail,
  CalendarActionType,
  CalendarFilterState,
} from '../types/database';
import { isToday as checkIsToday, isFollowUpOverdue } from '../utils/dashboardUtils';

// ----------------------------------------------------------------------
// 1. Date & Timezone-Safe Formatting Helpers (Oman GST / UTC+4 compatible)
// ----------------------------------------------------------------------

export function safeDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  const d = typeof val === 'string' ? new Date(val) : val;
  return isNaN(d.getTime()) ? null : d;
}

export function isSameDay(d1: Date | string, d2: Date | string): boolean {
  const date1 = safeDate(d1);
  const date2 = safeDate(d2);
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function formatAppointmentTime(isoString?: string): string {
  const d = safeDate(isoString);
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatAppointmentDate(isoString?: string, options?: Intl.DateTimeFormatOptions): string {
  const d = safeDate(isoString);
  if (!d) return '';
  return d.toLocaleDateString([], options || { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimeRange(startIso?: string, endIso?: string, defaultDurationMinutes: number = 30): string {
  const start = safeDate(startIso);
  if (!start) return '';
  const startTimeStr = formatAppointmentTime(startIso);

  let end = safeDate(endIso);
  if (!end) {
    end = new Date(start.getTime() + defaultDurationMinutes * 60 * 1000);
  }
  const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${startTimeStr} – ${endTimeStr}`;
}

export function toDateInputValue(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function combineDateAndTime(dateStr: string, timeStr: string): string {
  // If timeStr is missing, default to 09:00
  const time = timeStr || '09:00';
  const [hours, minutes] = time.split(':').map((v) => parseInt(v, 10) || 0);
  const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));

  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return d.toISOString();
}

export function computeEndTime(startTimeIso: string, durationMinutes: number): string {
  const start = safeDate(startTimeIso);
  if (!start) return startTimeIso;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return end.toISOString();
}

// ----------------------------------------------------------------------
// 2. Calendar Grid Math (Month, Week, Day)
// ----------------------------------------------------------------------

export interface MonthGridDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean; // Friday & Saturday are weekend in Oman/GCC
}

export function getMonthViewDays(viewDate: Date): MonthGridDay[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Sunday = 0, Monday = 1 ... Saturday = 6
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  const grid: MonthGridDay[] = [];

  // Previous month padding days
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDate - i);
    grid.push({
      date: d,
      dateString: toDateInputValue(d),
      isCurrentMonth: false,
      isToday: checkIsToday(d),
      isWeekend: d.getDay() === 5 || d.getDay() === 6, // Fri & Sat
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    grid.push({
      date: d,
      dateString: toDateInputValue(d),
      isCurrentMonth: true,
      isToday: checkIsToday(d),
      isWeekend: d.getDay() === 5 || d.getDay() === 6,
    });
  }

  // Next month padding to complete standard 35 or 42 grid cells
  const remaining = (7 - (grid.length % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(year, month + 1, day);
    grid.push({
      date: d,
      dateString: toDateInputValue(d),
      isCurrentMonth: false,
      isToday: checkIsToday(d),
      isWeekend: d.getDay() === 5 || d.getDay() === 6,
    });
  }

  return grid;
}

export function getWeekViewDays(viewDate: Date): { date: Date; dateString: string; isToday: boolean; isWeekend: boolean }[] {
  const current = new Date(viewDate);
  const dayOfWeek = current.getDay(); // 0 = Sunday
  const sunday = new Date(current);
  sunday.setDate(current.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push({
      date: d,
      dateString: toDateInputValue(d),
      isToday: checkIsToday(d),
      isWeekend: d.getDay() === 5 || d.getDay() === 6,
    });
  }
  return days;
}

export const WORK_HOURS = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
];

export function getEventDurationMinutes(event: FollowUpRecord): number {
  const start = safeDate(event.scheduled_at);
  if (!start) return 30;

  const end = safeDate(event.end_time);
  if (end && end.getTime() > start.getTime()) {
    return Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  }

  const actionLower = (event.action || '').toLowerCase();
  if (actionLower.includes('meeting') || actionLower.includes('visit')) {
    return 60;
  }
  return 30;
}

// ----------------------------------------------------------------------
// 3. Conflict Detection Algorithm (Requirement 24)
// ----------------------------------------------------------------------

export function checkScheduleConflict(
  events: FollowUpRecord[],
  candidate: {
    assigned_to: string;
    scheduled_at: string;
    end_time?: string;
    action?: string;
    exclude_id?: string;
    salesman_name?: string;
  }
): ScheduleConflictDetail | null {
  if (!candidate.assigned_to || !candidate.scheduled_at) return null;

  const candStart = safeDate(candidate.scheduled_at);
  if (!candStart) return null;

  const candDuration = candidate.end_time
    ? Math.max(15, Math.round((safeDate(candidate.end_time)!.getTime() - candStart.getTime()) / (60 * 1000)))
    : ((candidate.action || '').toLowerCase().includes('meeting') || (candidate.action || '').toLowerCase().includes('visit') ? 60 : 30);

  const candEnd = candidate.end_time ? safeDate(candidate.end_time)! : new Date(candStart.getTime() + candDuration * 60 * 1000);

  // Active / pending events only for this salesman
  const relevantEvents = events.filter((e) => {
    if (e.id === candidate.exclude_id) return false;
    if (e.status === 'cancelled' || e.status === 'rescheduled') return false;
    return e.assigned_to === candidate.assigned_to;
  });

  for (const existing of relevantEvents) {
    const existStart = safeDate(existing.scheduled_at);
    if (!existStart) continue;

    const existDuration = getEventDurationMinutes(existing);
    const existEnd = existing.end_time ? safeDate(existing.end_time)! : new Date(existStart.getTime() + existDuration * 60 * 1000);

    // Standard interval overlap: (StartA < EndB) && (EndA > StartB)
    const isOverlapping = candStart.getTime() < existEnd.getTime() && candEnd.getTime() > existStart.getTime();

    if (isOverlapping) {
      const salesmanName = candidate.salesman_name || existing.assigned_to_name || 'Assigned Salesman';
      const existingSlot = formatTimeRange(existing.scheduled_at, existing.end_time, existDuration);
      const requestedSlot = formatTimeRange(candidate.scheduled_at, candidate.end_time, candDuration);
      const existingAction = existing.title || existing.action || 'Appointment';

      return {
        existingEvent: existing,
        salesmanName,
        salesmanId: candidate.assigned_to,
        conflictingTimeSlot: existingSlot,
        requestedTimeSlot: requestedSlot,
        reason: `${salesmanName} already has: ${existingAction} (${existingSlot}). Requested: ${candidate.action || 'New Event'} (${requestedSlot}).`,
      };
    }
  }

  return null;
}

// ----------------------------------------------------------------------
// 4. Action Badges & Aesthetic Presentation
// ----------------------------------------------------------------------

export interface ActionBadgeConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  category: 'meeting' | 'visit' | 'call' | 'whatsapp' | 'email' | 'other';
}

export function getActionBadgeConfig(action: string = ''): ActionBadgeConfig {
  const lower = action.toLowerCase();

  if (lower.includes('site visit') || lower.includes('visit')) {
    return {
      label: 'Site Visit',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      dotColor: 'bg-emerald-500',
      category: 'visit',
    };
  }

  if (lower.includes('meeting')) {
    return {
      label: 'Meeting',
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-700',
      badgeBorder: 'border-indigo-200',
      dotColor: 'bg-indigo-500',
      category: 'meeting',
    };
  }

  if (lower.includes('whatsapp')) {
    return {
      label: 'WhatsApp',
      badgeBg: 'bg-teal-50',
      badgeText: 'text-teal-700',
      badgeBorder: 'border-teal-200',
      dotColor: 'bg-teal-500',
      category: 'whatsapp',
    };
  }

  if (lower.includes('call')) {
    return {
      label: 'Call',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-700',
      badgeBorder: 'border-amber-200',
      dotColor: 'bg-amber-500',
      category: 'call',
    };
  }

  if (lower.includes('email')) {
    return {
      label: 'Email',
      badgeBg: 'bg-sky-50',
      badgeText: 'text-sky-700',
      badgeBorder: 'border-sky-200',
      dotColor: 'bg-sky-500',
      category: 'email',
    };
  }

  if (lower.includes('check-in') || lower.includes('check in')) {
    return {
      label: 'Check-in',
      badgeBg: 'bg-cyan-50',
      badgeText: 'text-cyan-700',
      badgeBorder: 'border-cyan-200',
      dotColor: 'bg-cyan-500',
      category: 'other',
    };
  }

  if (lower.includes('requirement') || lower.includes('repeat')) {
    return {
      label: action,
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      badgeBorder: 'border-purple-200',
      dotColor: 'bg-purple-500',
      category: 'other',
    };
  }

  return {
    label: action || 'Follow-up',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    dotColor: 'bg-slate-500',
    category: 'other',
  };
}

// ----------------------------------------------------------------------
// 5. Filter Engine
// ----------------------------------------------------------------------

export function filterCalendarEvents(
  events: FollowUpRecord[],
  filters: CalendarFilterState
): FollowUpRecord[] {
  return events.filter((e) => {
    // 1. Salesman filter (Admin only)
    if (filters.salesmanId && filters.salesmanId !== 'all') {
      if (e.assigned_to !== filters.salesmanId) return false;
    }

    // 2. Status filter
    if (filters.status && filters.status !== 'all') {
      const isOverdue = isFollowUpOverdue(e);
      if (filters.status === 'overdue') {
        if (!isOverdue) return false;
      } else if (filters.status === 'pending') {
        if (e.status !== 'pending' || isOverdue) return false;
      } else if (e.status !== filters.status) {
        return false;
      }
    }

    // 3. Event Type filter
    if (filters.eventType && filters.eventType !== 'all') {
      const actionLower = (e.action || '').toLowerCase();
      const filterLower = filters.eventType.toLowerCase();
      if (!actionLower.includes(filterLower)) return false;
    }

    // 4. Record Type filter (Lead vs Client)
    if (filters.recordType && filters.recordType !== 'all') {
      const isClient = Boolean(e.client_id || e.entity_type === 'Client');
      if (filters.recordType === 'client' && !isClient) return false;
      if (filters.recordType === 'lead' && isClient) return false;
    }

    // 5. Search query
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const company = (e.company_name || '').toLowerCase();
      const contact = (e.contact_person || '').toLowerCase();
      const title = (e.title || '').toLowerCase();
      const action = (e.action || '').toLowerCase();
      const location = (e.location || '').toLowerCase();
      const notes = (e.notes || '').toLowerCase();

      const match =
        company.includes(q) ||
        contact.includes(q) ||
        title.includes(q) ||
        action.includes(q) ||
        location.includes(q) ||
        notes.includes(q);

      if (!match) return false;
    }

    return true;
  });
}
