import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  CheckCircle2,
  RotateCcw,
  XCircle,
  AlertCircle,
  Phone,
  MessageSquare,
  Mail,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { FollowUpRecord } from '../../../types/database';
import {
  formatAppointmentDate,
  formatAppointmentTime,
  formatTimeRange,
  getActionBadgeConfig,
  getEventDurationMinutes,
  safeDate,
  isSameDay,
} from '../../../lib/calendarUtils';
import { isFollowUpOverdue, isFollowUpDueToday } from '../../../utils/dashboardUtils';

interface AgendaViewProps {
  events: FollowUpRecord[];
  onSelectEvent: (event: FollowUpRecord) => void;
  onOpenComplete?: (event: FollowUpRecord) => void;
  onOpenReschedule?: (event: FollowUpRecord) => void;
  onOpenCancel?: (event: FollowUpRecord) => void;
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToClient?: (clientId: string) => void;
}

export type AgendaTab = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

export const AgendaView: React.FC<AgendaViewProps> = ({
  events,
  onSelectEvent,
  onOpenComplete,
  onOpenReschedule,
  onOpenCancel,
  onNavigateToLead,
  onNavigateToClient,
}) => {
  const [activeTab, setActiveTab] = useState<AgendaTab>('all');

  // Filter events based on active tab
  const tabFilteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter((e) => {
      const isOverdue = isFollowUpOverdue(e);
      const isToday = isFollowUpDueToday(e);

      if (activeTab === 'today') return isToday;
      if (activeTab === 'overdue') return isOverdue;
      if (activeTab === 'completed') return e.status === 'completed';
      if (activeTab === 'upcoming') {
        const d = safeDate(e.scheduled_at);
        return d && d > now && !isToday && e.status === 'pending';
      }
      return true; // 'all'
    });
  }, [events, activeTab]);

  // Group events by date string
  const groupedByDate = useMemo(() => {
    // Sort chronological
    const sorted = [...tabFilteredEvents].sort((a, b) => {
      const t1 = safeDate(a.scheduled_at)?.getTime() || 0;
      const t2 = safeDate(b.scheduled_at)?.getTime() || 0;
      return t1 - t2;
    });

    const groups: { [dateKey: string]: { date: Date; items: FollowUpRecord[] } } = {};

    sorted.forEach((event) => {
      const d = safeDate(event.scheduled_at);
      if (!d) return;
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: d,
          items: [],
        };
      }
      groups[dateKey].items.push(event);
    });

    return Object.values(groups);
  }, [tabFilteredEvents]);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        {[
          { id: 'all', label: 'All Agenda' },
          { id: 'today', label: "Today's Schedule" },
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'completed', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as AgendaTab)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {groupedByDate.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Calendar className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No scheduled appointments</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No events match your current view filters. Use the "Schedule Appointment" button above
            to plan meetings or follow-ups.
          </p>
        </div>
      ) : (
        /* Grouped Sections */
        <div className="space-y-6">
          {groupedByDate.map((group) => {
            const isToday = isSameDay(group.date, new Date());
            const dateLabel = formatAppointmentDate(group.date.toISOString(), {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div key={group.date.toISOString()} className="space-y-2.5">
                {/* Date Header Strip */}
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold ${
                      isToday
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-200/80 text-slate-800'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{isToday ? `Today — ${dateLabel}` : dateLabel}</span>
                  </div>
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-semibold text-slate-500">
                    {group.items.length} booking{group.items.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Event Cards */}
                <div className="space-y-2">
                  {group.items.map((event) => {
                    const badge = getActionBadgeConfig(event.action);
                    const isOverdue = isFollowUpOverdue(event);
                    const duration = getEventDurationMinutes(event);
                    const timeRange = formatTimeRange(event.scheduled_at, event.end_time, duration);
                    const isClientEvent = Boolean(event.client_id || event.entity_type === 'Client');

                    return (
                      <div
                        key={event.id}
                        id={`agenda-event-${event.id}`}
                        onClick={() => onSelectEvent(event)}
                        className={`rounded-2xl border bg-white p-4 shadow-2xs transition hover:shadow-md cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          event.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : event.status === 'cancelled'
                            ? 'border-slate-200 opacity-60'
                            : isOverdue
                            ? 'border-rose-300 bg-rose-50/30'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {/* Main Info */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${badge.dotColor}`} />
                              <span>{event.action}</span>
                            </span>

                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>{timeRange}</span>
                            </span>

                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                <AlertCircle className="h-3 w-3" />
                                <span>Overdue</span>
                              </span>
                            )}

                            {event.status === 'completed' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Completed</span>
                              </span>
                            )}
                          </div>

                          <div className="text-base font-bold text-slate-900 leading-snug">
                            {event.title || `${event.action}: ${event.company_name}`}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                              {isClientEvent ? (
                                <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              )}
                              <span>{event.company_name}</span>
                            </div>

                            {event.contact_person && (
                              <span className="text-slate-500">• {event.contact_person}</span>
                            )}

                            {event.location && (
                              <span className="flex items-center gap-1 text-slate-600 font-medium">
                                <MapPin className="h-3.5 w-3.5 text-rose-500" />
                                <span>{event.location}</span>
                              </span>
                            )}

                            {event.assigned_to_name && (
                              <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                                Rep: {event.assigned_to_name}
                              </span>
                            )}
                          </div>

                          {event.notes && (
                            <p className="text-xs text-slate-500 line-clamp-1 italic pt-0.5">
                              "{event.notes}"
                            </p>
                          )}
                        </div>

                        {/* Right: Actions & Contacts */}
                        <div
                          className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Contact Shortcuts */}
                          {event.phone && (
                            <a
                              href={`tel:${event.phone}`}
                              className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                              title={`Call ${event.phone}`}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {event.whatsapp && (
                            <a
                              href={`https://wa.me/${event.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 w-8 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition"
                              title="WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          )}

                          {/* Workflow buttons */}
                          {event.status === 'pending' && (
                            <>
                              {onOpenComplete && (
                                <button
                                  type="button"
                                  onClick={() => onOpenComplete(event)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Complete</span>
                                </button>
                              )}
                              {onOpenReschedule && (
                                <button
                                  type="button"
                                  onClick={() => onOpenReschedule(event)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Reschedule</span>
                                </button>
                              )}
                              {onOpenCancel && (
                                <button
                                  type="button"
                                  onClick={() => onOpenCancel(event)}
                                  className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Cancel Appointment"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}

                          {/* Open Record */}
                          {isClientEvent && event.client_id && onNavigateToClient ? (
                            <button
                              type="button"
                              onClick={() => onNavigateToClient(event.client_id!)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                              title="Open Client Record"
                            >
                              <span>Client</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          ) : event.lead_id && onNavigateToLead ? (
                            <button
                              type="button"
                              onClick={() => onNavigateToLead(event.lead_id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                              title="Open Lead Record"
                            >
                              <span>Lead</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
