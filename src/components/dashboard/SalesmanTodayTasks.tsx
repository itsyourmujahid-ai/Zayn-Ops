import React from 'react';
import {
  CalendarClock,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Phone,
  MessageSquare,
  ArrowRight,
  Flame,
  Plus,
  Sparkles,
} from 'lucide-react';
import { FollowUpRecord, LeadRecord } from '../../types/database';
import { Badge } from '../common/Badge';
import {
  isFollowUpDueToday,
  isFollowUpOverdue,
  isFollowUpUpcoming,
  getOverdueDuration,
  formatScheduledDateTime,
} from '../../utils/dashboardUtils';

interface SalesmanTodayTasksProps {
  followups: FollowUpRecord[];
  leads: LeadRecord[];
  onSelectLead?: (leadId: string) => void;
  onOpenComplete?: (followup: FollowUpRecord) => void;
  onOpenReschedule?: (followup: FollowUpRecord) => void;
  onOpenScheduleFollowUp?: () => void;
  onViewAllFollowups?: () => void;
}

export const SalesmanTodayTasks: React.FC<SalesmanTodayTasksProps> = ({
  followups,
  leads,
  onSelectLead,
  onOpenComplete,
  onOpenReschedule,
  onOpenScheduleFollowUp,
  onViewAllFollowups,
}) => {
  const leadsMap = new Map<string, LeadRecord>();
  leads.forEach((l) => leadsMap.set(l.id, l));

  const pendingList = followups.filter((f) => f.status === 'pending');

  // Filter tasks: Overdue OR Due Today
  const overdueTasks = pendingList.filter((f) => isFollowUpOverdue(f));
  const todayTasks = pendingList.filter((f) => isFollowUpDueToday(f));
  const upcomingTasks = pendingList.filter((f) => isFollowUpUpcoming(f));

  // Next single upcoming task
  const nextUpcoming = upcomingTasks.sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )[0];

  // Combined active tasks for today/overdue prioritized
  const prioritizedTasks = [...overdueTasks, ...todayTasks].sort((a, b) => {
    const isOverdueA = isFollowUpOverdue(a);
    const isOverdueB = isFollowUpOverdue(b);
    const leadA = leadsMap.get(a.lead_id);
    const leadB = leadsMap.get(b.lead_id);
    const isHotA = (leadA?.priority || a.priority) === 'Hot';
    const isHotB = (leadB?.priority || b.priority) === 'Hot';

    // 1. Overdue
    if (isOverdueA && !isOverdueB) return -1;
    if (!isOverdueA && isOverdueB) return 1;

    // 2. Hot Leads
    if (isHotA && !isHotB) return -1;
    if (!isHotA && isHotB) return 1;

    // 3. Scheduled Time
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });

  return (
    <div
      id="salesman-today-tasks-section"
      className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Today's Work &amp; Action Plan</h3>
              {overdueTasks.length > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  {overdueTasks.length} Overdue
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Prioritized execution queue for client follow-ups
            </p>
          </div>
        </div>

        {onViewAllFollowups && (
          <button
            type="button"
            onClick={onViewAllFollowups}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
          >
            All Follow-ups ({pendingList.length}) →
          </button>
        )}
      </div>

      {/* Main Task List */}
      <div className="flex-1 divide-y divide-slate-100">
        {prioritizedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="mt-3 text-xs font-semibold text-slate-800">
              No follow-ups scheduled for today.
            </h4>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
              Great progress! You are fully caught up. Use the button below to schedule your next client follow-up.
            </p>
            {onOpenScheduleFollowUp && (
              <button
                type="button"
                onClick={onOpenScheduleFollowUp}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Schedule Follow-up</span>
              </button>
            )}
          </div>
        ) : (
          prioritizedTasks.map((task) => {
            const isOverdue = isFollowUpOverdue(task);
            const lead = leadsMap.get(task.lead_id);
            const companyName = task.company_name || lead?.company_name || 'Client';
            const contactPerson = task.contact_person || lead?.contact_person;
            const phone = task.phone || task.whatsapp || lead?.phone || lead?.whatsapp;
            const priority = lead?.priority || task.priority || 'Warm';
            const isHot = priority === 'Hot';

            return (
              <div
                key={task.id}
                className={`p-4 transition hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isOverdue ? 'bg-rose-50/30' : ''
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      onClick={() => onSelectLead && onSelectLead(task.lead_id)}
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition truncate"
                    >
                      {companyName}
                    </span>

                    <Badge priority={priority.toLowerCase() as any} size="sm">
                      {priority}
                    </Badge>

                    {isOverdue ? (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        <AlertCircle className="h-3 w-3" />
                        {getOverdueDuration(task.scheduled_at)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        <Clock className="h-3 w-3" />
                        Due Today
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span className="font-semibold text-indigo-700">
                      Action: {task.action || 'Follow-up'}
                    </span>
                    <span>•</span>
                    <span>{formatScheduledDateTime(task.scheduled_at)}</span>
                    {contactPerson && (
                      <>
                        <span>•</span>
                        <span>Contact: {contactPerson}</span>
                      </>
                    )}
                  </div>

                  {task.notes && (
                    <p className="text-xs text-slate-500 italic line-clamp-1">
                      "{task.notes}"
                    </p>
                  )}
                </div>

                {/* Direct Action Controls */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {phone && (
                    <>
                      <a
                        href={`tel:${phone}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition"
                        title={`Call ${phone}`}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 transition"
                        title="Chat on WhatsApp"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </a>
                    </>
                  )}

                  {onOpenComplete && (
                    <button
                      type="button"
                      onClick={() => onOpenComplete(task)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Complete</span>
                    </button>
                  )}

                  {onOpenReschedule && (
                    <button
                      type="button"
                      onClick={() => onOpenReschedule(task)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Reschedule</span>
                    </button>
                  )}

                  {onSelectLead && (
                    <button
                      type="button"
                      onClick={() => onSelectLead(task.lead_id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                      title="Open Lead"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Next Upcoming Follow-up Banner */}
      {nextUpcoming && (
        <div className="border-t border-slate-100 bg-indigo-50/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900 uppercase tracking-wider text-[10px] bg-indigo-100 px-1.5 py-0.5 rounded">
              Next Upcoming
            </span>
            <span className="font-bold text-slate-900">
              {nextUpcoming.company_name || 'Client'}:
            </span>
            <span className="text-slate-600">
              {nextUpcoming.action} on {formatScheduledDateTime(nextUpcoming.scheduled_at)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelectLead && onSelectLead(nextUpcoming.lead_id)}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 cursor-pointer self-end sm:self-auto"
          >
            Prepare Account →
          </button>
        </div>
      )}
    </div>
  );
};
