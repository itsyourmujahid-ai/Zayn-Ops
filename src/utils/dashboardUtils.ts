import { FollowUpRecord, LeadRecord, LeadStatus, Priority } from '../types/database';

/**
 * Checks if a given date/ISO string falls on the current local day
 */
export function isToday(dateInput?: string | Date | null): boolean {
  if (!dateInput) return false;
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Checks if a follow-up is pending and scheduled strictly before now
 */
export function isFollowUpOverdue(followup: FollowUpRecord): boolean {
  if (followup.status !== 'pending') return false;
  if (!followup.scheduled_at) return false;
  const d = new Date(followup.scheduled_at);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/**
 * Checks if a follow-up is pending and scheduled for today
 */
export function isFollowUpDueToday(followup: FollowUpRecord): boolean {
  if (followup.status !== 'pending') return false;
  return isToday(followup.scheduled_at);
}

/**
 * Checks if a follow-up is pending and scheduled in the future (after today)
 */
export function isFollowUpUpcoming(followup: FollowUpRecord): boolean {
  if (followup.status !== 'pending') return false;
  if (!followup.scheduled_at) return false;
  const d = new Date(followup.scheduled_at);
  if (isNaN(d.getTime())) return false;
  return d.getTime() > Date.now() && !isToday(d);
}

/**
 * Human-readable string for how overdue a task is
 */
export function getOverdueDuration(scheduledAtIso?: string): string {
  if (!scheduledAtIso) return 'Overdue';
  const schedTime = new Date(scheduledAtIso).getTime();
  if (isNaN(schedTime)) return 'Overdue';

  const diffMs = Date.now() - schedTime;
  if (diffMs <= 0) return 'Due now';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} overdue`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} overdue`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} overdue`;
  }
  return 'Just now overdue';
}

/**
 * Human friendly relative time formatting for activity logs
 */
export function getRelativeTime(isoString?: string): string {
  if (!isoString) return 'Recently';
  const target = new Date(isoString);
  if (isNaN(target.getTime())) return 'Recently';

  const now = new Date();
  const diffMs = now.getTime() - target.getTime();

  if (diffMs < 0) {
    return 'Upcoming';
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return target.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a scheduled date nicely (e.g. "Today at 2:30 PM", "Tomorrow at 10:00 AM", "Sep 12 at 4:00 PM")
 */
export function formatScheduledDateTime(isoString?: string): string {
  if (!isoString) return 'Not scheduled';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday(d)) {
    return `Today at ${timeStr}`;
  }

  if (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  ) {
    return `Tomorrow at ${timeStr}`;
  }

  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

/**
 * Computes pipeline stage distribution counts
 */
export function calculatePipelineCounts(leads: LeadRecord[]) {
  const stages: Record<LeadStatus, number> = {
    New: 0,
    Contacted: 0,
    Interested: 0,
    Meeting: 0,
    Quotation: 0,
    Negotiation: 0,
    Won: 0,
    Lost: 0,
  };

  leads.forEach((l) => {
    if (stages[l.status] !== undefined) {
      stages[l.status]++;
    }
  });

  return stages;
}
