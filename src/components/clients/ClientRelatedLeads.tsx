import React, { useMemo } from 'react';
import {
  Sparkles,
  Plus,
  ChevronRight,
  UserCheck,
  Calendar,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FolderGit2,
  Building2,
} from 'lucide-react';
import { LeadRecord, ClientRecord, FollowUpRecord, LeadActivityRecord, UserProfile } from '../../types/database';
import { getUserDisplayName } from '../../lib/dal';

interface ClientRelatedLeadsProps {
  client: ClientRecord;
  leads: LeadRecord[];
  followups?: FollowUpRecord[];
  activities?: LeadActivityRecord[];
  users?: UserProfile[];
  onNavigateToLead: (leadId: string) => void;
  onCreateOpportunity: () => void;
}

export const ClientRelatedLeads: React.FC<ClientRelatedLeadsProps> = ({
  client,
  leads,
  followups = [],
  activities = [],
  users = [],
  onNavigateToLead,
  onCreateOpportunity,
}) => {
  // Compute metrics
  const wonCount = leads.filter((l) => l.status === 'Won').length;
  const activeCount = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost').length;

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'None';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'None';
      return d.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'None';
    }
  };

  const getLeadStageBadge = (status: string) => {
    switch (status) {
      case 'Won':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Negotiation':
      case 'Proposal / Quote':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Meeting / Presentation':
      case 'Site Visit':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Interested':
      case 'Qualified':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Lost':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* ---------------- Header Banner: Concept Explanation & Create Action ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Related Leads &amp; Projects
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {leads.length} {leads.length === 1 ? 'Opportunity' : 'Opportunities'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual sales projects linked to <span className="font-semibold text-slate-700">{client.company_name}</span>. One client can have multiple opportunities over time.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateOpportunity}
          className="zaynops-btn-primary py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span>New Opportunity</span>
        </button>
      </div>

      {/* ---------------- Visual Hierarchy Tree Diagram (Section 11) ---------------- */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 pb-3 border-b border-slate-200/80">
          <Building2 className="h-4 w-4 text-emerald-600" />
          <span>{client.company_name}</span>
          <span className="text-[11px] font-semibold text-slate-500">
            (Client Relationship: {activeCount} Open, {wonCount} Won)
          </span>
        </div>

        {leads.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs font-semibold text-slate-800">No active leads</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-3">
              Create a new Lead when this Client has a new sales opportunity.
            </p>
            <button
              type="button"
              onClick={onCreateOpportunity}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Lead</span>
            </button>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-200/70">
            {leads.map((lead, idx) => {
              const isLast = idx === leads.length - 1;
              const ownerName = lead.assigned_to_name || getUserDisplayName(lead.assigned_to, users);

              // Find lead's next follow-up
              const leadFus = followups.filter((f) => f.lead_id === lead.id && f.status === 'pending');
              const nextFu = leadFus.sort(
                (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
              )[0];

              // Find lead's last activity
              const leadActs = activities.filter((a) => a.lead_id === lead.id);
              const lastAct = leadActs.sort(
                (a, b) =>
                  new Date(b.activity_date || b.activity_at || b.created_at).getTime() -
                  new Date(a.activity_date || a.activity_at || a.created_at).getTime()
              )[0];

              return (
                <div
                  key={lead.id}
                  onClick={() => onNavigateToLead(lead.id)}
                  className="group relative flex items-center justify-between py-3 px-3 rounded-lg hover:bg-white transition cursor-pointer"
                >
                  {/* Tree branch line */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-slate-400 font-mono select-none text-sm">
                      {isLast ? '└──' : '├──'}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition truncate">
                          {lead.project_name || lead.title || lead.company_name}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getLeadStageBadge(
                            lead.status
                          )}`}
                        >
                          {lead.status}
                        </span>
                        {lead.deal_value ? (
                          <span className="text-[11px] font-semibold text-slate-500">
                            {lead.currency || 'OMR'} {lead.deal_value.toLocaleString()}
                          </span>
                        ) : null}
                      </div>

                      {/* Meta: Owner, Last Activity, Next Follow-up */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                        <span>
                          Owner: <span className="font-semibold text-slate-700">{ownerName}</span>
                        </span>
                        <span>·</span>
                        <span>
                          Last Activity:{' '}
                          <span className="font-medium text-slate-700">
                            {lastAct ? `${lastAct.activity_type} (${formatDate(lastAct.activity_date || lastAct.created_at)})` : 'None'}
                          </span>
                        </span>
                        <span>·</span>
                        <span>
                          Next Follow-up:{' '}
                          <span
                            className={`font-semibold ${
                              nextFu ? 'text-emerald-700' : 'text-slate-400 italic'
                            }`}
                          >
                            {nextFu ? `${nextFu.action} · ${formatDate(nextFu.scheduled_at)}` : 'None'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition shrink-0 ml-3">
                    <span>View Lead</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
