import React from 'react';
import {
  Flame,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Phone,
  MessageSquare,
  Building2,
  Calendar,
} from 'lucide-react';
import { FollowUpRecord, LeadRecord } from '../../types/database';
import { Badge } from '../common/Badge';
import { isFollowUpOverdue, formatScheduledDateTime } from '../../utils/dashboardUtils';

interface SalesmanPriorityLeadsProps {
  leads: LeadRecord[];
  followups: FollowUpRecord[];
  onSelectLead?: (leadId: string) => void;
  onViewAllLeads?: () => void;
}

export const SalesmanPriorityLeads: React.FC<SalesmanPriorityLeadsProps> = ({
  leads,
  followups,
  onSelectLead,
  onViewAllLeads,
}) => {
  // Find leads that have overdue follow-ups
  const overdueLeadIds = new Set(
    followups
      .filter((f) => f.status === 'pending' && isFollowUpOverdue(f))
      .map((f) => f.lead_id)
  );

  // Filter priority leads: Hot Leads OR Overdue Follow-up Leads OR recently created (< 3 days old)
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

  const priorityLeads = leads
    .filter((l) => {
      if (l.status === 'Won' || l.status === 'Lost') return false;
      const isHot = l.priority === 'Hot';
      const hasOverdue = overdueLeadIds.has(l.id);
      const isRecent = new Date(l.created_at).getTime() > threeDaysAgo;
      return isHot || hasOverdue || isRecent;
    })
    .sort((a, b) => {
      // 1. Overdue first
      const overdueA = overdueLeadIds.has(a.id);
      const overdueB = overdueLeadIds.has(b.id);
      if (overdueA && !overdueB) return -1;
      if (!overdueA && overdueB) return 1;

      // 2. Hot next
      if (a.priority === 'Hot' && b.priority !== 'Hot') return -1;
      if (a.priority !== 'Hot' && b.priority === 'Hot') return 1;

      // 3. Newest updated
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });

  return (
    <div
      id="salesman-priority-leads-section"
      className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
            <Flame className="h-4 w-4 fill-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Priority Leads</h3>
            <p className="text-[11px] text-slate-500">
              Hot prospects, overdue commitments, and new additions
            </p>
          </div>
        </div>

        {onViewAllLeads && (
          <button
            type="button"
            onClick={onViewAllLeads}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
          >
            All My Leads ({leads.length}) →
          </button>
        )}
      </div>

      <div className="flex-1 divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
        {priorityLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Building2 className="h-5 w-5" />
            </div>
            <h4 className="mt-3 text-xs font-semibold text-slate-700">
              No immediate priority leads
            </h4>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
              All client accounts are balanced. Add new leads or review warm and cold accounts.
            </p>
          </div>
        ) : (
          priorityLeads.slice(0, 6).map((lead) => {
            const hasOverdue = overdueLeadIds.has(lead.id);
            const phone = lead.phone || lead.whatsapp;

            return (
              <div
                key={lead.id}
                onClick={() => onSelectLead && onSelectLead(lead.id)}
                className="p-4 hover:bg-slate-50 transition cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                      {lead.company_name}
                    </span>
                    <Badge priority={lead.priority.toLowerCase() as any} size="sm">
                      {lead.priority}
                    </Badge>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {lead.status}
                    </span>
                    {hasOverdue && (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        Overdue Task
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>Contact: {lead.contact_person || 'N/A'}</span>
                    {lead.location && (
                      <>
                        <span>•</span>
                        <span>Location: {lead.location}</span>
                      </>
                    )}
                    {lead.estimated_value ? (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">
                          AED {lead.estimated_value.toLocaleString()}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {lead.next_action && (
                    <div className="text-xs font-medium text-indigo-700 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-indigo-500" />
                      <span>{lead.next_action}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {phone && (
                    <>
                      <a
                        href={`tel:${phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition"
                        title="Call"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 transition"
                        title="WhatsApp"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLead && onSelectLead(lead.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <span>Details</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
