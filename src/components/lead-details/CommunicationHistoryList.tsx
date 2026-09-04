import React, { useState } from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  MapPin,
  StickyNote,
  Clock,
  Calendar,
  CalendarPlus,
  User,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { LeadActivityRecord } from '../../types/database';
import { CommunicationFilter, CommunicationType } from '../../types/communication';

interface CommunicationHistoryListProps {
  activities: LeadActivityRecord[];
  loading?: boolean;
  onScheduleFollowUp?: (suggestedAction?: string) => void;
}

const TYPE_STYLES: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    textColor: string;
    borderColor: string;
    badgeBg: string;
  }
> = {
  Call: {
    icon: Phone,
    bgColor: 'bg-indigo-50 text-indigo-600',
    textColor: 'text-indigo-900',
    borderColor: 'border-indigo-100',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  WhatsApp: {
    icon: MessageSquare,
    bgColor: 'bg-emerald-50 text-emerald-600',
    textColor: 'text-emerald-900',
    borderColor: 'border-emerald-100',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  Email: {
    icon: Mail,
    bgColor: 'bg-blue-50 text-blue-600',
    textColor: 'text-blue-900',
    borderColor: 'border-blue-100',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  Meeting: {
    icon: Users,
    bgColor: 'bg-purple-50 text-purple-600',
    textColor: 'text-purple-900',
    borderColor: 'border-purple-100',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  'Site Visit': {
    icon: MapPin,
    bgColor: 'bg-rose-50 text-rose-600',
    textColor: 'text-rose-900',
    borderColor: 'border-rose-100',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  Note: {
    icon: StickyNote,
    bgColor: 'bg-slate-100 text-slate-600',
    textColor: 'text-slate-900',
    borderColor: 'border-slate-200',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const CommunicationHistoryList: React.FC<CommunicationHistoryListProps> = ({
  activities,
  loading = false,
  onScheduleFollowUp,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<CommunicationFilter>('all');

  // Filter out pure internal system events like status change or ownership reassignment from the communication view
  const communicationActivities = activities.filter((a) => {
    const validCommTypes = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Site Visit', 'Note'];
    return validCommTypes.includes(a.activity_type);
  });

  const filteredActivities = communicationActivities.filter((a) => {
    if (selectedFilter === 'all') return true;
    return a.activity_type === selectedFilter;
  });

  const formatActivityTime = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Recent';

      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) {
        return `Today, ${timeStr}`;
      }
      if (isYesterday) {
        return `Yesterday, ${timeStr}`;
      }
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    } catch {
      return 'Recent';
    }
  };

  const filterTabs: { id: CommunicationFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: communicationActivities.length },
    {
      id: 'Call',
      label: 'Calls',
      count: communicationActivities.filter((a) => a.activity_type === 'Call').length,
    },
    {
      id: 'WhatsApp',
      label: 'WhatsApp',
      count: communicationActivities.filter((a) => a.activity_type === 'WhatsApp').length,
    },
    {
      id: 'Email',
      label: 'Email',
      count: communicationActivities.filter((a) => a.activity_type === 'Email').length,
    },
    {
      id: 'Meeting',
      label: 'Meetings',
      count: communicationActivities.filter((a) => a.activity_type === 'Meeting').length,
    },
    {
      id: 'Site Visit',
      label: 'Site Visits',
      count: communicationActivities.filter((a) => a.activity_type === 'Site Visit').length,
    },
    {
      id: 'Note',
      label: 'Notes',
      count: communicationActivities.filter((a) => a.activity_type === 'Note').length,
    },
  ];

  return (
    <div id="communication-history-section" className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Communication History
          </span>
          <span className="text-xs font-semibold text-slate-400">
            ({filteredActivities.length} {filteredActivities.length === 1 ? 'record' : 'records'})
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = selectedFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                id={`comm-filter-btn-${tab.id.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setSelectedFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {loading && filteredActivities.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2"></div>
          <p className="text-xs font-semibold text-slate-500">Loading communication history...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredActivities.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            {selectedFilter === 'all'
              ? 'No Communication History Yet'
              : `No ${selectedFilter} Activities Recorded`}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {selectedFilter === 'all'
              ? 'Use the composer above to log phone calls, WhatsApp messages, emails, meetings, or notes for this client.'
              : `No ${selectedFilter.toLowerCase()} entries have been logged for this lead yet. You can log one using the composer above.`}
          </p>
        </div>
      )}

      {/* Chronological List of Cards */}
      <div className="space-y-3">
        {filteredActivities.map((act) => {
          const style = TYPE_STYLES[act.activity_type] || TYPE_STYLES.Note;
          const Icon = style.icon;
          const timeLabel = formatActivityTime(act.activity_date || act.activity_at || act.created_at);

          return (
            <div
              key={act.id}
              id={`comm-history-item-${act.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-xs transition duration-150 space-y-2.5"
            >
              {/* Card Header: Timestamp & Type Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl border ${style.borderColor} ${style.bgColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{act.activity_type}</span>
                      {act.outcome && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${style.badgeBg}`}
                        >
                          {act.outcome}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{timeLabel}</span>
                      <span>•</span>
                      <User className="h-3 w-3" />
                      <span className="font-medium text-slate-600">{act.performed_by_name || 'Sales Rep'}</span>
                    </div>
                  </div>
                </div>

                {/* Follow-up Action Trigger */}
                {onScheduleFollowUp && (
                  <button
                    type="button"
                    onClick={() => onScheduleFollowUp(act.activity_type)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition cursor-pointer"
                    title="Schedule follow-up based on this communication"
                  >
                    <CalendarPlus className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Follow-up</span>
                  </button>
                )}
              </div>

              {/* Card Content & Notes */}
              {(act.notes || act.description) && (
                <div className="pl-11">
                  {act.metadata?.message_context && (
                    <div className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-100 p-2 rounded-lg mb-1.5 italic">
                      &ldquo;{act.metadata.message_context}&rdquo;
                    </div>
                  )}

                  {act.metadata?.email_subject && (
                    <div className="text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                      <span className="text-slate-400 font-normal">Subject:</span>
                      <span>{act.metadata.email_subject}</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {act.notes || act.description}
                  </p>
                </div>
              )}

              {/* Linked Follow-up Notification indicator if created with follow-up */}
              {act.scheduled_followup_id && (
                <div className="pl-11 pt-1">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100">
                    <CheckCircle2 className="h-3 w-3 text-indigo-600" />
                    <span>Follow-up scheduled from this activity</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
