import React, { useState, useMemo } from 'react';
import {
  CalendarPlus,
  Clock,
  Phone,
  MessageSquare,
  Users,
  MapPin,
  CheckCircle2,
  Calendar,
  AlertCircle,
  RotateCcw,
  XCircle,
  Plus,
  User,
  Filter,
} from 'lucide-react';
import { FollowUpRecord, ClientRecord, UserProfile, FollowUpActionType } from '../../types/database';
import { getUserDisplayName } from '../../lib/dal';

interface ClientFollowUpsProps {
  client: ClientRecord;
  followups: FollowUpRecord[];
  users?: UserProfile[];
  onScheduleFollowUp: (action?: FollowUpActionType) => void;
  onCompleteFollowUp: (followUp: FollowUpRecord) => void;
  onRescheduleFollowUp: (followUp: FollowUpRecord) => void;
  onCancelFollowUp: (followUp: FollowUpRecord) => void;
}

export const ClientFollowUps: React.FC<ClientFollowUpsProps> = ({
  client,
  followups,
  users = [],
  onScheduleFollowUp,
  onCompleteFollowUp,
  onRescheduleFollowUp,
  onCancelFollowUp,
}) => {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'cancelled' | 'all'>('pending');

  const filteredFollowUps = useMemo(() => {
    return followups
      .filter((fu) => {
        if (statusFilter === 'all') return true;
        return fu.status === statusFilter;
      })
      .sort((a, b) => {
        if (statusFilter === 'completed') {
          return new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime();
        }
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
  }, [followups, statusFilter]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Date not set';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Date not set';
      return d.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Date not set';
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isOverdue = (scheduledAt: string) => {
    return new Date(scheduledAt).getTime() < Date.now();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Call':
        return Phone;
      case 'WhatsApp':
        return MessageSquare;
      case 'Meeting':
        return Users;
      case 'Site Visit':
        return MapPin;
      default:
        return CalendarPlus;
    }
  };

  return (
    <div className="space-y-4">
      {/* ---------------- Filter & Quick Action Bar ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        {/* Status Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { key: 'pending', label: 'Upcoming & Pending' },
              { key: 'completed', label: 'Completed' },
              { key: 'cancelled', label: 'Cancelled' },
              { key: 'all', label: 'All Follow-ups' },
            ] as const
          ).map((tab) => {
            const isSelected = statusFilter === tab.key;
            const count = followups.filter((f) => (tab.key === 'all' ? true : f.status === tab.key)).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Schedule Button */}
        <button
          type="button"
          onClick={() => onScheduleFollowUp()}
          className="zaynops-btn-primary py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span>Schedule Follow-up</span>
        </button>
      </div>

      {/* ---------------- Follow-ups List ---------------- */}
      {filteredFollowUps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
            <Calendar className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {statusFilter === 'pending' ? 'No pending follow-ups scheduled' : 'No follow-ups found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            Plan your next customer check-in, phone call, or site visit with this client.
          </p>
          <button
            type="button"
            onClick={() => onScheduleFollowUp()}
            className="zaynops-btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFollowUps.map((fu) => {
            const Icon = getActionIcon(fu.action);
            const overdue = fu.status === 'pending' && isOverdue(fu.scheduled_at);
            const assigneeName = fu.assigned_to
              ? getUserDisplayName(fu.assigned_to, users)
              : client.owner_name || 'Assigned Salesman';

            return (
              <div
                key={fu.id}
                className={`rounded-xl border p-4 shadow-2xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  overdue
                    ? 'border-rose-300 bg-rose-50/40'
                    : fu.status === 'completed'
                    ? 'border-slate-200/80 bg-slate-50/50'
                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                }`}
              >
                {/* Left details */}
                <div className="flex items-start gap-3">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      overdue
                        ? 'bg-rose-100 text-rose-700 border-rose-200'
                        : fu.status === 'completed'
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">
                        {fu.action}
                      </span>

                      {overdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertCircle className="h-3 w-3" />
                          Overdue
                        </span>
                      )}

                      {fu.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed
                        </span>
                      )}

                      {fu.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle className="h-3 w-3" />
                          Cancelled
                        </span>
                      )}
                    </div>

                    {fu.notes && (
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">
                        {fu.notes}
                      </p>
                    )}

                    {/* Metadata: Scheduled date, time, assignee */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>{formatDate(fu.scheduled_at)}</span>
                      </span>

                      {formatTime(fu.scheduled_at) && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{formatTime(fu.scheduled_at)}</span>
                        </span>
                      )}

                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{assigneeName}</span>
                      </span>
                    </div>

                    {/* Completion Notes if completed */}
                    {fu.status === 'completed' && fu.completion_notes && (
                      <div className="mt-2 text-[11px] bg-white/80 p-2 rounded-lg border border-slate-200 text-slate-700">
                        <span className="font-semibold text-emerald-800">Outcome: </span>
                        <span>{fu.completion_notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Actions: Complete, Reschedule, Cancel */}
                {fu.status === 'pending' && (
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => onCompleteFollowUp(fu)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Complete</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRescheduleFollowUp(fu)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reschedule</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onCancelFollowUp(fu)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
