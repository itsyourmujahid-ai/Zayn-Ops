import React, { useState, useMemo } from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  MapPin,
  Clock,
  StickyNote,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  UserCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { LeadActivityRecord, ActivityType, UserProfile } from '../../types/database';

interface ClientActivityTimelineProps {
  activities: LeadActivityRecord[];
  loading?: boolean;
  users?: UserProfile[];
  onAddActivity: () => void;
}

type FilterType = 'All' | 'Call' | 'WhatsApp' | 'Email' | 'Meeting' | 'Site Visit' | 'Note';

export const ClientActivityTimeline: React.FC<ClientActivityTimelineProps> = ({
  activities,
  loading = false,
  users = [],
  onAddActivity,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  const [performedByFilter, setPerformedByFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Format date helper: "17 Sep 2026"
  const formatDateHeader = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Recent';
      return d.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Recent';
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

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Type filter
      if (selectedFilter !== 'All') {
        if (selectedFilter === 'Call' && act.activity_type !== 'Call') return false;
        if (selectedFilter === 'WhatsApp' && act.activity_type !== 'WhatsApp') return false;
        if (selectedFilter === 'Email' && act.activity_type !== 'Email') return false;
        if (selectedFilter === 'Meeting' && act.activity_type !== 'Meeting') return false;
        if (selectedFilter === 'Site Visit' && act.activity_type !== 'Site Visit') return false;
        if (selectedFilter === 'Note' && act.activity_type !== 'Note') return false;
      }

      // Performed by filter
      if (performedByFilter !== 'All') {
        const perf = act.performed_by || act.created_by;
        if (perf !== performedByFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = act.description?.toLowerCase().includes(q);
        const notesMatch = act.notes?.toLowerCase().includes(q);
        const outcomeMatch = act.outcome?.toLowerCase().includes(q);
        const userMatch = act.performed_by_name?.toLowerCase().includes(q);
        if (!descMatch && !notesMatch && !outcomeMatch && !userMatch) return false;
      }

      return true;
    });
  }, [activities, selectedFilter, performedByFilter, searchQuery]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: { dateKey: string; items: LeadActivityRecord[] }[] = [];
    const dateMap = new Map<string, LeadActivityRecord[]>();

    filteredActivities.forEach((act) => {
      const dateKey = formatDateHeader(act.activity_date || act.activity_at || act.created_at);
      const existing = dateMap.get(dateKey) || [];
      existing.push(act);
      dateMap.set(dateKey, existing);
    });

    dateMap.forEach((items, dateKey) => {
      groups.push({ dateKey, items });
    });

    return groups;
  }, [filteredActivities]);

  const getActivityVisuals = (type: ActivityType | string) => {
    switch (type) {
      case 'Site Visit':
        return {
          icon: MapPin,
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dotBg: 'bg-emerald-600 ring-4 ring-emerald-100',
        };
      case 'Meeting':
        return {
          icon: Users,
          badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          dotBg: 'bg-indigo-600 ring-4 ring-indigo-100',
        };
      case 'Call':
        return {
          icon: Phone,
          badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
          dotBg: 'bg-blue-600 ring-4 ring-blue-100',
        };
      case 'WhatsApp':
        return {
          icon: MessageSquare,
          badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
          dotBg: 'bg-teal-600 ring-4 ring-teal-100',
        };
      case 'Email':
        return {
          icon: Mail,
          badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
          dotBg: 'bg-slate-600 ring-4 ring-slate-100',
        };
      case 'Note':
        return {
          icon: StickyNote,
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
          dotBg: 'bg-amber-600 ring-4 ring-amber-100',
        };
      default:
        return {
          icon: Clock,
          badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
          dotBg: 'bg-slate-500 ring-4 ring-slate-100',
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* ---------------- Filter & Quick Action Bar ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        {/* Lightweight Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { key: 'All', label: 'All' },
              { key: 'Call', label: 'Calls' },
              { key: 'WhatsApp', label: 'WhatsApp' },
              { key: 'Email', label: 'Email' },
              { key: 'Meeting', label: 'Meetings' },
              { key: 'Site Visit', label: 'Visits' },
              { key: 'Note', label: 'Notes' },
            ] as const
          ).map((filter) => {
            const isSelected = selectedFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setSelectedFilter(filter.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Search & Team Filter & Add Action */}
        <div className="flex items-center gap-2">
          {users.length > 0 && (
            <select
              value={performedByFilter}
              onChange={(e) => setPerformedByFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-semibold text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="All">All Team</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={onAddActivity}
            className="zaynops-btn-primary py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>Add Activity</span>
          </button>
        </div>
      </div>

      {/* ---------------- Timeline Container ---------------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading relationship history...</p>
        </div>
      ) : groupedActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
            <Clock className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No activity yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            Start building the relationship history by recording a call, meeting, visit, or note.
          </p>
          <button
            type="button"
            onClick={onAddActivity}
            className="zaynops-btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>Add Activity</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedActivities.map((group) => (
            <div key={group.dateKey} className="space-y-3">
              {/* Date Section Header */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/60">
                  {group.dateKey}
                </span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* Items for this date */}
              <div className="relative pl-6 space-y-3 border-l-2 border-slate-200 ml-3">
                {group.items.map((activity) => {
                  const visuals = getActivityVisuals(activity.activity_type);
                  const Icon = visuals.icon;
                  const timeStr = formatTime(activity.activity_date || activity.activity_at || activity.created_at);
                  const performerName = activity.performed_by_name || 'Team Member';
                  const nextAction = activity.metadata?.next_action;
                  const location = activity.metadata?.location;
                  const purpose = activity.metadata?.purpose;

                  return (
                    <div
                      key={activity.id}
                      className="relative rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-slate-300 transition"
                    >
                      {/* Timeline Dot */}
                      <span
                        className={`absolute -left-[31px] top-4.5 h-3 w-3 rounded-full ${visuals.dotBg}`}
                      />

                      {/* Top Meta Line: Type + Performer + Time */}
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${visuals.badgeBg}`}
                          >
                            <Icon className="h-3 w-3" />
                            <span>{activity.activity_type}</span>
                          </span>

                          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                            <span className="text-slate-400 font-normal">by</span>
                            <span>{performerName}</span>
                          </span>
                        </div>

                        {timeStr && (
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{timeStr}</span>
                          </span>
                        )}
                      </div>

                      {/* Purpose or Location details */}
                      {(purpose || location) && (
                        <div className="mb-2 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          {purpose && (
                            <span className="font-semibold text-slate-800">
                              Purpose: <span className="font-normal text-slate-700">{purpose}</span>
                            </span>
                          )}
                          {location && (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span>{location}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Main Notes / Description */}
                      {activity.notes ? (
                        <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                          {activity.notes}
                        </p>
                      ) : activity.description ? (
                        <p className="text-xs text-slate-600">
                          {activity.description}
                        </p>
                      ) : null}

                      {/* Outcome & Next Action Footer */}
                      {(activity.outcome || nextAction) && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 text-xs flex-wrap">
                          {activity.outcome && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-medium text-[11px]">Outcome:</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                                {activity.outcome}
                              </span>
                            </div>
                          )}

                          {nextAction && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                              <span className="text-emerald-700">Next:</span>
                              <span>{nextAction}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
