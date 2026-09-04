import React from 'react';
import {
  Activity,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  FileText,
  MapPin,
  Clock,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { LeadActivityRecord, LeadRecord, UserProfile } from '../../types/database';
import { getRelativeTime } from '../../utils/dashboardUtils';
import { getUserDisplayName } from '../../lib/dal';

interface RecentActivityFeedProps {
  activities: LeadActivityRecord[];
  leads: LeadRecord[];
  users: UserProfile[];
  onSelectLead?: (leadId: string) => void;
  title?: string;
  maxItems?: number;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  leads,
  users,
  onSelectLead,
  title = 'Recent Activity',
  maxItems = 10,
}) => {
  // Map lead_id to company name for instant lookup
  const leadsMap = new Map<string, LeadRecord>();
  leads.forEach((l) => leadsMap.set(l.id, l));

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'Call':
        return <Phone className="h-3.5 w-3.5 text-blue-600" />;
      case 'WhatsApp':
        return <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />;
      case 'Email':
        return <Mail className="h-3.5 w-3.5 text-indigo-600" />;
      case 'Meeting':
        return <Calendar className="h-3.5 w-3.5 text-purple-600" />;
      case 'Quotation':
        return <FileText className="h-3.5 w-3.5 text-amber-600" />;
      case 'Site Visit':
        return <MapPin className="h-3.5 w-3.5 text-teal-600" />;
      case 'Follow-up':
        return <Clock className="h-3.5 w-3.5 text-rose-600" />;
      case 'Status Change':
        return <RotateCcw className="h-3.5 w-3.5 text-cyan-600" />;
      case 'Assignment':
        return <UserCheck className="h-3.5 w-3.5 text-violet-600" />;
      case 'Lead Created':
        return <Sparkles className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  const getActivityBadgeColor = (type: string) => {
    switch (type) {
      case 'Call':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'WhatsApp':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'Email':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'Meeting':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'Quotation':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'Site Visit':
        return 'bg-teal-50 border-teal-200 text-teal-700';
      case 'Follow-up':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'Status Change':
        return 'bg-cyan-50 border-cyan-200 text-cyan-700';
      case 'Assignment':
        return 'bg-violet-50 border-violet-200 text-violet-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          Live authorized timeline
        </span>
      </div>

      <div className="flex-1 divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
        {displayedActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Activity className="h-5 w-5" />
            </div>
            <h4 className="mt-3 text-xs font-semibold text-slate-700">
              No recent activity yet.
            </h4>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
              Logged calls, WhatsApp messages, meetings, notes, and status transitions will appear in real time.
            </p>
          </div>
        ) : (
          displayedActivities.map((act) => {
            const lead = leadsMap.get(act.lead_id);
            const companyName =
              lead?.company_name ||
              act.metadata?.company_name ||
              'Client Account';

            const performerName =
              act.performed_by_name ||
              (act.performed_by ? getUserDisplayName(act.performed_by, users) : 'Sales Rep');

            const timestamp = act.activity_at || act.activity_date || act.created_at;
            const relativeTimeStr = getRelativeTime(timestamp);

            return (
              <div
                key={act.id}
                onClick={() => onSelectLead && onSelectLead(act.lead_id)}
                className="p-3.5 hover:bg-slate-50 transition cursor-pointer group flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${getActivityBadgeColor(
                      act.activity_type
                    )}`}
                  >
                    {getActivityIcon(act.activity_type)}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                        {companyName}
                      </span>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="text-[11px] font-medium text-slate-600">
                        {performerName}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-1">
                      {act.description || act.notes || 'Activity recorded'}
                    </p>

                    {act.outcome && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50/70 px-1.5 py-0.5 rounded">
                        <span>Outcome: {act.outcome}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right flex flex-col items-end gap-1">
                  <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                    {relativeTimeStr}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
                    {act.activity_type}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
