import React, { useState } from 'react';
import {
  Building2,
  User,
  MapPin,
  Calendar,
  Clock,
  Flame,
  AlertCircle,
  MoreVertical,
  ArrowRight,
  Sparkles,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { LeadRecord, LeadStatus, FollowUpRecord, UserProfile } from '../../types/database';
import { Badge } from '../common/Badge';
import { getUserDisplayName } from '../../lib/dal';
import { isFollowUpOverdue, getOverdueDuration, formatScheduledDateTime } from '../../utils/dashboardUtils';

interface KanbanCardProps {
  lead: LeadRecord;
  followUp?: FollowUpRecord;
  users: UserProfile[];
  isAdmin: boolean;
  onSelectLead?: (leadId: string) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => Promise<void>;
  isDragging?: boolean;
}

const ALL_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Meeting',
  'Quotation',
  'Negotiation',
  'Won',
  'Lost',
];

export const KanbanCard: React.FC<KanbanCardProps> = ({
  lead,
  followUp,
  users,
  isAdmin,
  onSelectLead,
  onStatusChange,
}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showStatusMenu, setShowStatusMenu] = useState<boolean>(false);

  const salesmanName = getUserDisplayName(lead.assigned_to, users);
  const isHot = lead.priority === 'Hot';
  const isWarm = lead.priority === 'Warm';

  const isOverdue = followUp ? isFollowUpOverdue(followUp) : false;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.setData('application/json', JSON.stringify({ leadId: lead.id, currentStatus: lead.status }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleQuickStatus = async (newStatus: LeadStatus) => {
    setShowStatusMenu(false);
    if (newStatus === lead.status) return;
    try {
      setIsUpdating(true);
      await onStatusChange(lead.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      id={`kanban-card-${lead.id}`}
      draggable={!isUpdating}
      onDragStart={handleDragStart}
      className={`group relative rounded-xl border bg-white p-3.5 shadow-xs transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-slate-300 ${
        isHot
          ? 'border-rose-200/90 bg-linear-to-b from-white to-rose-50/20'
          : isWarm
          ? 'border-amber-200/60 bg-linear-to-b from-white to-amber-50/10'
          : 'border-slate-200'
      } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Card Header: Company Name & Priority Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4
            onClick={() => onSelectLead && onSelectLead(lead.id)}
            className="text-xs font-bold text-slate-900 truncate hover:text-indigo-600 transition cursor-pointer flex items-center gap-1.5"
            title={lead.company_name}
          >
            {isHot && <Flame className="h-3.5 w-3.5 text-rose-500 fill-rose-500 shrink-0" />}
            <span className="truncate">{lead.company_name}</span>
          </h4>
          {lead.contact_person && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
              <User className="h-3 w-3 text-slate-400 shrink-0" />
              <span>{lead.contact_person}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge priority={lead.priority.toLowerCase() as any} size="sm">
            {lead.priority}
          </Badge>

          {/* Quick Stage Change Button */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusMenu(!showStatusMenu);
              }}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              title="Move Stage"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {showStatusMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusMenu(false);
                  }}
                />
                <div
                  className="absolute right-0 top-full mt-1 z-30 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Move to Stage
                  </div>
                  {ALL_STATUSES.map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      disabled={statusOption === lead.status}
                      onClick={() => handleQuickStatus(statusOption)}
                      className={`w-full px-2.5 py-1.5 text-left text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                        statusOption === lead.status
                          ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      <span>{statusOption}</span>
                      {statusOption === lead.status && <span className="text-[10px] text-indigo-600 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Meta details: Lead Type, Location, Value */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
        {lead.lead_type && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-medium">
            <Building2 className="h-2.5 w-2.5 text-slate-400" />
            {lead.lead_type}
          </span>
        )}

        {lead.location && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            <MapPin className="h-2.5 w-2.5 text-slate-400" />
            {lead.location}
          </span>
        )}

        {lead.estimated_value && lead.estimated_value > 0 ? (
          <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
            SAR {lead.estimated_value.toLocaleString()}
          </span>
        ) : null}
      </div>

      {/* Next Follow-up Section */}
      {followUp ? (
        <div
          className={`mt-2.5 rounded-lg border p-2 text-[11px] space-y-1 ${
            isOverdue
              ? 'border-rose-200 bg-rose-50/60 text-rose-900'
              : 'border-slate-100 bg-slate-50/80 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1 truncate">
              <Calendar className={`h-3 w-3 ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`} />
              <span className="truncate">{followUp.action || 'Follow-up'}</span>
            </span>
            {isOverdue ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-rose-200/70 px-1.5 py-0.2 text-[9px] font-bold text-rose-800 shrink-0 animate-pulse">
                <Clock className="h-2.5 w-2.5" />
                {getOverdueDuration(followUp.scheduled_at)}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 shrink-0">
                {new Date(followUp.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          {followUp.notes && (
            <p className="text-[10px] text-slate-500 italic truncate">"{followUp.notes}"</p>
          )}
        </div>
      ) : lead.next_action ? (
        <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-[11px] text-slate-600">
          <p className="truncate">👉 {lead.next_action}</p>
        </div>
      ) : null}

      {/* Card Footer: Salesman (for Admin) & Details Link */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
        {isAdmin ? (
          <div className="flex items-center gap-1 text-slate-500 truncate" title={`Assigned: ${salesmanName}`}>
            <User className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate font-medium text-slate-700">{salesmanName}</span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400">
            {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : 'Active'}
          </span>
        )}

        <button
          type="button"
          onClick={() => onSelectLead && onSelectLead(lead.id)}
          className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer ml-auto"
        >
          <span>Details</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
