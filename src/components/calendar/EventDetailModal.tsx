import React from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  Phone,
  MessageSquare,
  Mail,
  CheckCircle2,
  RotateCcw,
  XCircle,
  ExternalLink,
  ShieldCheck,
  FileText,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { FollowUpRecord } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import {
  formatAppointmentDate,
  formatTimeRange,
  getActionBadgeConfig,
  getEventDurationMinutes,
  safeDate,
} from '../../lib/calendarUtils';
import { isFollowUpOverdue } from '../../utils/dashboardUtils';

interface EventDetailModalProps {
  isOpen: boolean;
  event: FollowUpRecord | null;
  onClose: () => void;
  onOpenComplete: (event: FollowUpRecord) => void;
  onOpenReschedule: (event: FollowUpRecord) => void;
  onOpenCancel: (event: FollowUpRecord) => void;
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToClient?: (clientId: string) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  event,
  onClose,
  onOpenComplete,
  onOpenReschedule,
  onOpenCancel,
  onNavigateToLead,
  onNavigateToClient,
}) => {
  const { userProfile, isAdmin } = useAuth();

  if (!isOpen || !event) return null;

  const badgeConfig = getActionBadgeConfig(event.action);
  const isOverdue = isFollowUpOverdue(event);
  const duration = getEventDurationMinutes(event);
  const timeRange = formatTimeRange(event.scheduled_at, event.end_time, duration);
  const dateFormatted = formatAppointmentDate(event.scheduled_at, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const canManage =
    isAdmin ||
    event.assigned_to === userProfile?.id ||
    event.created_by === userProfile?.id;

  const isClientEvent = Boolean(event.client_id || event.entity_type === 'Client');

  return (
    <div
      id="event-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${badgeConfig.badgeBg} ${badgeConfig.badgeText} ${badgeConfig.badgeBorder}`}
            >
              <span className={`h-2 w-2 rounded-full ${badgeConfig.dotColor}`} />
              <span>{event.action}</span>
            </span>

            {/* Status Badge */}
            {isOverdue ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200">
                <AlertCircle className="h-3 w-3" />
                <span>Overdue</span>
              </span>
            ) : event.status === 'completed' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                <span>Completed</span>
              </span>
            ) : event.status === 'rescheduled' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 border border-purple-200">
                <RotateCcw className="h-3 w-3" />
                <span>Rescheduled</span>
              </span>
            ) : event.status === 'cancelled' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-slate-200">
                <XCircle className="h-3 w-3" />
                <span>Cancelled</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                <Clock className="h-3 w-3" />
                <span>Scheduled</span>
              </span>
            )}
          </div>

          <button
            id="close-event-detail-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Title & Organization */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-snug">
              {event.title || `${event.action}: ${event.company_name || 'Contact'}`}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
              {isClientEvent ? (
                <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              )}
              <span className="font-semibold text-slate-900">{event.company_name}</span>
              {event.contact_person && <span>• {event.contact_person}</span>}
            </div>
          </div>

          {/* Date, Time & Duration Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="font-semibold">{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>
                {timeRange} <span className="text-slate-400">({duration} mins)</span>
              </span>
            </div>
            {event.location && (
              <div className="flex items-start gap-2.5 text-xs text-slate-700 pt-1 border-t border-slate-200/60">
                <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="font-medium text-slate-800">{event.location}</span>
              </div>
            )}
          </div>

          {/* Assigned Salesman info */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              <div>
                <span className="text-slate-500">Assigned Representative:</span>{' '}
                <strong className="text-slate-900">{event.assigned_to_name || 'Assigned Salesman'}</strong>
              </div>
            </div>
          </div>

          {/* Contact Actions (Phone, WhatsApp, Email) */}
          {(event.phone || event.whatsapp || event.email) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {event.phone && (
                <a
                  href={`tel:${event.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Call {event.phone}</span>
                </a>
              )}
              {event.whatsapp && (
                <a
                  href={`https://wa.me/${event.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </a>
              )}
              {event.email && (
                <a
                  href={`mailto:${event.email}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Mail className="h-3.5 w-3.5 text-sky-600" />
                  <span>Email</span>
                </a>
              )}
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Notes &amp; Objectives
              </span>
              <p className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {event.notes}
              </p>
            </div>
          )}

          {/* Completion Trail */}
          {event.status === 'completed' && (
            <div className="rounded-xl bg-emerald-50/80 p-3.5 border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Completed Outcome: {event.outcome || 'Done'}</span>
              </div>
              <div className="text-[11px] text-emerald-700">
                Completed by {event.completed_by_name || 'User'} on{' '}
                {event.completed_at ? new Date(event.completed_at).toLocaleString() : 'Recorded date'}
              </div>
            </div>
          )}

          {/* Cancellation Trail */}
          {event.status === 'cancelled' && (
            <div className="rounded-xl bg-rose-50/80 p-3.5 border border-rose-200 text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-rose-600" />
                <span>Cancelled: {event.cancellation_reason || 'Cancelled'}</span>
              </div>
              <div className="text-[11px] text-rose-700">
                Cancelled on {event.cancelled_at ? new Date(event.cancelled_at).toLocaleString() : 'Recorded date'}
              </div>
            </div>
          )}

          {/* Rescheduled Trail */}
          {event.status === 'rescheduled' && (
            <div className="rounded-xl bg-purple-50/80 p-3.5 border border-purple-200 text-xs text-purple-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-purple-600" />
                <span>Rescheduled to a new time</span>
              </div>
              <div className="text-[11px] text-purple-700">
                Rescheduled on {event.rescheduled_at ? new Date(event.rescheduled_at).toLocaleString() : 'Recorded date'}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-6 py-3.5">
          {/* Open Related Record */}
          <div>
            {isClientEvent && event.client_id && onNavigateToClient ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToClient(event.client_id!);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition cursor-pointer shadow-2xs"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Open Client Record</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </button>
            ) : event.lead_id && onNavigateToLead ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToLead(event.lead_id);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition cursor-pointer shadow-2xs"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Open Lead Record</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </button>
            ) : null}
          </div>

          {/* Workflow Action Buttons (Complete, Reschedule, Cancel) */}
          <div className="flex items-center gap-2">
            {event.status === 'pending' && canManage && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCancel(event);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReschedule(event);
                  }}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                >
                  Reschedule
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenComplete(event);
                  }}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                >
                  Complete
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
