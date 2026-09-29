import React, { useState, useEffect } from 'react';
import {
  X,
  CalendarPlus,
  AlertCircle,
  Building2,
  User,
  Clock,
  Bell,
  Briefcase,
  ChevronDown,
  Phone,
  MessageSquare,
  Users,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import {
  LeadRecord,
  ClientRecord,
  UserProfile,
  CreateFollowUpInput,
  FollowUpActionType,
} from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { createFollowUp, getAllUsers } from '../../lib/dal';

export interface ScheduleFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Lead or Client context
  leads?: LeadRecord[];
  client?: ClientRecord | null;
  clientRecord?: ClientRecord | null;
  targetType?: 'lead' | 'client';
  isClientContext?: boolean;
  initialLeadId?: string;
  initialClientId?: string;
  leadId?: string;
  initialAction?: FollowUpActionType;
  users?: UserProfile[];
  onSchedule?: (input: CreateFollowUpInput) => Promise<void>;
  onScheduled?: () => void;
}

export const ScheduleFollowUpModal: React.FC<ScheduleFollowUpModalProps> = ({
  isOpen,
  onClose,
  leads = [],
  client,
  clientRecord,
  targetType,
  isClientContext,
  initialLeadId,
  initialClientId,
  leadId,
  initialAction = 'Call',
  users: propUsers,
  onSchedule,
  onScheduled,
}) => {
  const { userProfile, isAdmin } = useAuth();

  // Determine client mode vs lead mode
  const effectiveClient = client || clientRecord || null;
  const effectiveClientId = effectiveClient?.id || initialClientId || '';
  const isClient = Boolean(
    isClientContext ||
    targetType === 'client' ||
    effectiveClient ||
    initialClientId
  );

  const [users, setUsers] = useState<UserProfile[]>(propUsers || []);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || leadId || leads[0]?.id || '');
  const [optionalLeadId, setOptionalLeadId] = useState<string>('');
  const [action, setAction] = useState<FollowUpActionType>(initialAction);
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [time, setTime] = useState<string>('10:00');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [reminder, setReminder] = useState<string>('30m');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Fetch users if not passed in props
  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      setUsers(propUsers);
    } else if (isOpen) {
      getAllUsers()
        .then((fetched) => setUsers(fetched))
        .catch(() => {});
    }
  }, [propUsers, isOpen]);

  // Reset and sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isClient) {
        if (effectiveClient?.owner_id) {
          setAssignedTo(effectiveClient.owner_id);
        } else {
          setAssignedTo(userProfile?.id || '');
        }
        setOptionalLeadId('');
      } else {
        const effLeadId = initialLeadId || leadId || leads[0]?.id || '';
        setSelectedLeadId(effLeadId);
        const match = leads.find((l) => l.id === effLeadId);
        if (match?.assigned_to) {
          setAssignedTo(match.assigned_to);
        } else {
          setAssignedTo(userProfile?.id || '');
        }
      }
      if (initialAction) {
        setAction(initialAction);
      }
      setReminder('30m');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen, initialLeadId, leadId, initialAction, leads, userProfile?.id, isClient, effectiveClient]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError('Please select a scheduled date.');
      return;
    }

    const combinedDateTime = new Date(`${date}T${time || '10:00'}:00`).toISOString();

    try {
      setSubmitting(true);
      setError('');

      const effectiveAssignedTo = (isAdmin && assignedTo) ? assignedTo : (userProfile?.id || assignedTo);

      if (isClient) {
        if (!effectiveClientId && !effectiveClient?.id) {
          setError('Client context missing. Please try again.');
          return;
        }

        const clientName = effectiveClient?.company_name || effectiveClient?.name || 'Customer Account';
        const contactPerson = effectiveClient?.contact_person || effectiveClient?.name || '';
        const phone = effectiveClient?.phone || effectiveClient?.whatsapp || '';
        const email = effectiveClient?.email || '';

        const payload: CreateFollowUpInput = {
          client_id: effectiveClientId || effectiveClient?.id,
          lead_id: optionalLeadId.trim() ? optionalLeadId : undefined,
          entity_type: 'Client',
          company_name: clientName,
          contact_person: contactPerson,
          phone,
          whatsapp: effectiveClient?.whatsapp || phone,
          email,
          action,
          scheduled_at: combinedDateTime,
          notes: notes.trim(),
          assigned_to: effectiveAssignedTo,
          status: 'pending',
          reminder,
          title: `${action}: ${clientName}`,
        };

        if (onSchedule) {
          await onSchedule(payload);
        } else {
          await createFollowUp(payload);
        }
      } else {
        if (!selectedLeadId) {
          setError('Please select a lead for this follow-up.');
          return;
        }

        const selectedLead = leads.find((l) => l.id === selectedLeadId);
        const payload: CreateFollowUpInput = {
          lead_id: selectedLeadId,
          entity_type: 'Lead',
          company_name: selectedLead?.company_name,
          contact_person: selectedLead?.contact_person,
          phone: selectedLead?.phone || selectedLead?.whatsapp,
          whatsapp: selectedLead?.whatsapp,
          email: selectedLead?.email,
          priority: selectedLead?.priority,
          action,
          scheduled_at: combinedDateTime,
          notes: notes.trim(),
          assigned_to: effectiveAssignedTo,
          status: 'pending',
          reminder,
          title: `${action}: ${selectedLead?.company_name || 'Lead'}`,
        };

        if (onSchedule) {
          await onSchedule(payload);
        } else {
          await createFollowUp(payload);
        }
      }

      if (onScheduled) {
        onScheduled();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="modal-schedule-followup"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isClient ? 'Schedule Client Follow-up' : 'Schedule Lead Follow-up'}
              </h3>
              <p className="text-xs text-slate-500">
                {isClient
                  ? 'Plan a customer touchpoint, call, meeting, or site visit'
                  : 'Plan your next contact touchpoint for this lead'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Target Card: Client vs Lead */}
          {isClient ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client Target
              </label>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-slate-900 block truncate">
                      {effectiveClient?.company_name || 'Client Account'}
                    </span>
                    {effectiveClient?.contact_person && (
                      <span className="text-slate-500 text-[11px] block truncate">
                        Contact: {effectiveClient.contact_person}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Client Direct
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Lead <span className="text-rose-500">*</span>
              </label>
              {leads.length === 0 ? (
                <p className="text-xs text-rose-500 font-medium">
                  No active leads found. Please create a lead first.
                </p>
              ) : (
                <select
                  id="select-schedule-lead"
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.company_name} ({l.contact_person || 'No Contact'} • {l.priority} Priority)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Action Type & Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Action Type <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-schedule-action"
                value={action}
                onChange={(e) => setAction(e.target.value as FollowUpActionType)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                <option value="Call">Call</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Meeting">Meeting</option>
                <option value="Site Visit">Site Visit</option>
                <option value="Customer Check-in">Customer Check-in</option>
                <option value="New Requirement">New Requirement</option>
                <option value="Repeat Order Discussion">Repeat Order Discussion</option>
                <option value="Email">Email</option>
                <option value="Quotation Follow-up">Quotation Follow-up</option>
                <option value="Contract Review">Contract Review</option>
                <option value="Payment Follow-up">Payment Follow-up</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Representative
              </label>
              <select
                id="select-schedule-assigned-to"
                value={assignedTo}
                disabled={!isAdmin && users.length > 0}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 font-medium focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-75"
              >
                <option value={userProfile?.id || ''}>
                  Myself ({userProfile?.full_name || 'Current User'})
                </option>
                {users
                  .filter((u) => u.id !== userProfile?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scheduled Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-schedule-date"
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scheduled Time
              </label>
              <input
                id="input-schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Reminder Setting */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-slate-400" />
              <span>Reminder</span>
            </label>
            <select
              id="select-schedule-reminder"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="none">No reminder</option>
              <option value="15m">15 minutes before</option>
              <option value="30m">30 minutes before (Default)</option>
              <option value="1h">1 hour before</option>
              <option value="1d">1 day before</option>
            </select>
          </div>

          {/* Optional Lead / Project Link (when in Client Context) */}
          {isClient && leads.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span>Related Project / Lead</span>
                <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                id="select-schedule-related-lead"
                value={optionalLeadId}
                onChange={(e) => setOptionalLeadId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                <option value="">None — General Relationship Activity</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.company_name} — {l.project_name || l.requirement || 'Project'} ({l.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Objective / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Objective / Discussion Points
            </label>
            <textarea
              id="input-schedule-notes"
              rows={3}
              placeholder={
                isClient
                  ? "e.g., Discuss upcoming project, review contract renewal, satisfaction check-in..."
                  : "e.g., Check if client reviewed the proposal and answer questions..."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-schedule-followup"
              type="submit"
              disabled={submitting || (!isClient && leads.length === 0)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
            >
              <CalendarPlus className="h-4 w-4" />
              <span>{submitting ? 'Scheduling...' : 'Schedule Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
