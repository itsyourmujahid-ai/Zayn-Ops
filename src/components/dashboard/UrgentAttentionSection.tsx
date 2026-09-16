import React from 'react';
import {
  AlertCircle,
  Clock,
  Flame,
  Calendar,
  User,
  Phone,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { FollowUpRecord, LeadRecord, UserProfile } from '../../types/database';
import { Badge } from '../common/Badge';
import {
  isFollowUpOverdue,
  isFollowUpDueToday,
  getOverdueDuration,
  formatScheduledDateTime,
} from '../../utils/dashboardUtils';
import { getUserDisplayName } from '../../lib/dal';

interface UrgentAttentionSectionProps {
  followups: FollowUpRecord[];
  leads: LeadRecord[];
  users: UserProfile[];
  onSelectLead?: (leadId: string) => void;
  onOpenComplete?: (followup: FollowUpRecord) => void;
  onOpenReschedule?: (followup: FollowUpRecord) => void;
  onViewAllOverdue?: () => void;
}

export const UrgentAttentionSection: React.FC<UrgentAttentionSectionProps> = ({
  followups,
  leads,
  users,
  onSelectLead,
  onOpenComplete,
  onOpenReschedule,
  onViewAllOverdue,
}) => {
  const leadsMap = new Map<string, LeadRecord>();
  leads.forEach((l) => leadsMap.set(l.id, l));

  const pendingFollowups = followups.filter((f) => f.status === 'pending');
  const overdueFollowups = pendingFollowups.filter((f) => isFollowUpOverdue(f));
  const todayFollowups = pendingFollowups.filter((f) => isFollowUpDueToday(f));

  // Find unassigned active leads
  const unassignedLeads = leads.filter(
    (l) =>
      l.status !== 'Won' &&
      l.status !== 'Lost' &&
      (!l.assigned_to ||
        l.assigned_to === 'unassigned' ||
        l.assigned_to === '' ||
        l.assigned_to === 'none')
  );

  type UrgentItem =
    | { type: 'followup'; data: FollowUpRecord; isOverdue: boolean; isHot: boolean }
    | { type: 'unassigned_lead'; data: LeadRecord; isHot: boolean };

  const urgentItems: UrgentItem[] = [];

  // 1. Overdue follow-ups (hot first, then regular)
  overdueFollowups.forEach((f) => {
    const lead = leadsMap.get(f.lead_id);
    const isHot = (lead?.priority || f.priority) === 'Hot';
    urgentItems.push({ type: 'followup', data: f, isOverdue: true, isHot });
  });

  // 2. Unassigned leads
  unassignedLeads.forEach((l) => {
    urgentItems.push({ type: 'unassigned_lead', data: l, isHot: l.priority === 'Hot' });
  });

  // 3. Today's follow-ups
  todayFollowups.forEach((f) => {
    const lead = leadsMap.get(f.lead_id);
    const isHot = (lead?.priority || f.priority) === 'Hot';
    urgentItems.push({ type: 'followup', data: f, isOverdue: false, isHot });
  });

  // Sort urgent items:
  // 1. Overdue followups with Hot leads
  // 2. Other Overdue followups
  // 3. Unassigned Hot Leads
  // 4. Other Unassigned Leads
  // 5. Today's follow-ups
  urgentItems.sort((a, b) => {
    // Overdue follow-up with hot leads is rank 1
    const rank = (item: UrgentItem) => {
      if (item.type === 'followup' && item.isOverdue && item.isHot) return 1;
      if (item.type === 'followup' && item.isOverdue) return 2;
      if (item.type === 'unassigned_lead' && item.isHot) return 3;
      if (item.type === 'unassigned_lead') return 4;
      if (item.type === 'followup' && item.isHot) return 5;
      return 6;
    };
    return rank(a) - rank(b);
  });

  const overdueCount = overdueFollowups.length;
  const unassignedCount = unassignedLeads.length;

  return (
    <div
      id="admin-urgent-attention-section"
      className="flex flex-col rounded-xl border border-rose-200 bg-white shadow-xs overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white shadow-xs">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Urgent Attention</h3>
              {overdueCount > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                  {overdueCount} Overdue
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Immediate action required across sales pipeline
            </p>
          </div>
        </div>

        {onViewAllOverdue && (
          <button
            type="button"
            onClick={onViewAllOverdue}
            className="text-xs font-bold text-rose-700 hover:text-rose-800 transition cursor-pointer"
          >
            View All Follow-ups →
          </button>
        )}
      </div>

      <div className="flex-1 divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
        {urgentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="mt-3 text-xs font-semibold text-slate-800">
              No urgent items right now.
            </h4>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
              All team follow-ups are up to date and all leads are assigned.
            </p>
          </div>
        ) : (
          urgentItems.slice(0, 8).map((item, idx) => {
            if (item.type === 'followup') {
              const fu = item.data;
              const isOverdue = item.isOverdue;
              const lead = leadsMap.get(fu.lead_id);
              const companyName = fu.company_name || lead?.company_name || 'Lead Account';
              const salesmanName = getUserDisplayName(fu.assigned_to, users);
              const priority = lead?.priority || fu.priority || 'Warm';

              return (
                <div
                  key={fu.id || `fu-${idx}`}
                  className={`p-4 transition hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isOverdue ? 'bg-rose-50/20' : ''
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        onClick={() => onSelectLead && onSelectLead(fu.lead_id)}
                        className="text-sm font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition truncate"
                      >
                        {companyName}
                      </span>
                      <Badge priority={priority.toLowerCase() as any} size="sm">
                        {priority}
                      </Badge>
                      {isOverdue ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          <Clock className="h-3 w-3" />
                          {getOverdueDuration(fu.scheduled_at)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <Calendar className="h-3 w-3" />
                          Due Today
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="font-semibold text-indigo-700">
                        Action: {fu.action || 'Follow-up'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-600">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        Salesman: <strong className="text-slate-800">{salesmanName}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-slate-500">
                        {formatScheduledDateTime(fu.scheduled_at)}
                      </span>
                    </div>

                    {fu.notes && (
                      <p className="text-xs text-slate-500 italic line-clamp-1">
                        "{fu.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {onOpenComplete && (
                      <button
                        type="button"
                        onClick={() => onOpenComplete(fu)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Complete</span>
                      </button>
                    )}
                    {onOpenReschedule && (
                      <button
                        type="button"
                        onClick={() => onOpenReschedule(fu)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        <span>Reschedule</span>
                      </button>
                    )}
                    {onSelectLead && (
                      <button
                        type="button"
                        onClick={() => onSelectLead(fu.lead_id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                        title="View Lead Details"
                      >
                        <span>Details</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Unassigned Lead
            const lead = item.data;
            return (
              <div
                key={lead.id || `lead-${idx}`}
                className="p-4 transition hover:bg-purple-50/40 bg-purple-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      onClick={() => onSelectLead && onSelectLead(lead.id)}
                      className="text-sm font-bold text-slate-900 hover:text-[#0CB675] cursor-pointer transition truncate"
                    >
                      {lead.company_name}
                    </span>
                    <Badge priority={lead.priority.toLowerCase() as any} size="sm">
                      {lead.priority}
                    </Badge>
                    <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                      Unassigned Lead
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>Contact: {lead.contact_person || 'N/A'}</span>
                    {lead.location && (
                      <>
                        <span>•</span>
                        <span>Location: {lead.location}</span>
                      </>
                    )}
                    {lead.source && (
                      <>
                        <span>•</span>
                        <span>Source: {lead.source}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {onSelectLead && (
                    <button
                      type="button"
                      onClick={() => onSelectLead(lead.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                    >
                      <span>Assign &amp; View</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
