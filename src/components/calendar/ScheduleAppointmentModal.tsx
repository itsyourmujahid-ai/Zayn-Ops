import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageSquare,
  Mail,
  ShieldCheck,
  Briefcase,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  LeadRecord,
  ClientRecord,
  UserProfile,
  CreateFollowUpInput,
  FollowUpRecord,
  ScheduleConflictDetail,
} from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { createFollowUp } from '../../lib/dal';
import {
  toDateInputValue,
  toTimeInputValue,
  combineDateAndTime,
  computeEndTime,
  checkScheduleConflict,
  formatTimeRange,
} from '../../lib/calendarUtils';

interface ScheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newFollowUp: FollowUpRecord) => void;
  allLeads: LeadRecord[];
  allClients: ClientRecord[];
  allUsers: UserProfile[];
  allEvents: FollowUpRecord[];
  initialDate?: string; // YYYY-MM-DD
  initialTime?: string; // HH:mm
  initialAction?: string;
  initialLeadId?: string;
  initialClientId?: string;
}

export const ScheduleAppointmentModal: React.FC<ScheduleAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  allLeads,
  allClients,
  allUsers,
  allEvents,
  initialDate,
  initialTime,
  initialAction,
  initialLeadId,
  initialClientId,
}) => {
  const { userProfile, isAdmin } = useAuth();

  // Record Type
  const [recordType, setRecordType] = useState<'Lead' | 'Client'>(
    initialClientId ? 'Client' : 'Lead'
  );
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || '');
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '');
  const [recordSearch, setRecordSearch] = useState<string>('');

  // Appointment Details
  const [actionType, setActionType] = useState<string>(initialAction || 'Meeting');
  const [title, setTitle] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(
    initialDate || toDateInputValue(new Date())
  );
  const [startTime, setStartTime] = useState<string>(
    initialTime || '10:00'
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Assigned Salesman
  const salesmen = useMemo(() => {
    return allUsers.filter((u) => u.role === 'SALESMAN' || u.role === 'ADMIN');
  }, [allUsers]);

  const [assignedTo, setAssignedTo] = useState<string>(
    userProfile?.id || (salesmen[0]?.id || '')
  );

  // Conflict state & Admin override
  const [conflict, setConflict] = useState<ScheduleConflictDetail | null>(null);
  const [adminOverride, setAdminOverride] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialClientId) {
        setRecordType('Client');
        setSelectedClientId(initialClientId);
      } else if (initialLeadId) {
        setRecordType('Lead');
        setSelectedLeadId(initialLeadId);
      }
      if (initialDate) setAppointmentDate(initialDate);
      if (initialTime) setStartTime(initialTime);
      if (initialAction) setActionType(initialAction);
      setAssignedTo(userProfile?.id || (salesmen[0]?.id || ''));
      setAdminOverride(false);
      setErrorMessage(null);
    }
  }, [isOpen, initialClientId, initialLeadId, initialDate, initialTime, initialAction, userProfile?.id, salesmen]);

  // Compute calculated end time
  const calculatedEndTimeIso = useMemo(() => {
    try {
      const startIso = combineDateAndTime(appointmentDate, startTime);
      return computeEndTime(startIso, durationMinutes);
    } catch (e) {
      return '';
    }
  }, [appointmentDate, startTime, durationMinutes]);

  // Live Conflict Check
  useEffect(() => {
    if (!appointmentDate || !startTime || !assignedTo) {
      setConflict(null);
      return;
    }
    try {
      const startIso = combineDateAndTime(appointmentDate, startTime);
      const assignedUser = allUsers.find((u) => u.id === assignedTo);
      const conf = checkScheduleConflict(allEvents, {
        assigned_to: assignedTo,
        scheduled_at: startIso,
        end_time: calculatedEndTimeIso,
        action: actionType,
        salesman_name: assignedUser?.full_name,
      });
      setConflict(conf);
    } catch (e) {
      setConflict(null);
    }
  }, [appointmentDate, startTime, calculatedEndTimeIso, assignedTo, actionType, allEvents, allUsers]);

  if (!isOpen) return null;

  // Filtered Leads & Clients for Search
  const filteredLeads = allLeads.filter((l) => {
    if (!recordSearch.trim()) return true;
    const q = recordSearch.toLowerCase();
    return (
      l.company_name?.toLowerCase().includes(q) ||
      l.contact_person?.toLowerCase().includes(q) ||
      l.phone?.includes(q)
    );
  });

  const filteredClients = allClients.filter((c) => {
    if (!recordSearch.trim()) return true;
    const q = recordSearch.toLowerCase();
    return (
      c.company_name?.toLowerCase().includes(q) ||
      c.contact_person?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  const selectedLead = allLeads.find((l) => l.id === selectedLeadId);
  const selectedClient = allClients.find((c) => c.id === selectedClientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (recordType === 'Lead' && !selectedLeadId) {
      setErrorMessage('Please select a related Lead record.');
      return;
    }
    if (recordType === 'Client' && !selectedClientId) {
      setErrorMessage('Please select a related Customer Client record.');
      return;
    }
    if (!appointmentDate || !startTime) {
      setErrorMessage('Date and Start Time are required.');
      return;
    }

    // Conflict handling
    if (conflict && !adminOverride) {
      if (isAdmin) {
        setErrorMessage('A schedule conflict exists for this salesman. Check "Admin Override" to proceed.');
        return;
      } else {
        setErrorMessage(`Schedule Conflict: ${conflict.reason} Please select a different time slot.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const scheduledAtIso = combineDateAndTime(appointmentDate, startTime);
      const companyName =
        recordType === 'Lead'
          ? selectedLead?.company_name
          : selectedClient?.company_name;

      const contactPerson =
        recordType === 'Lead'
          ? selectedLead?.contact_person
          : selectedClient?.contact_person;

      const phone =
        recordType === 'Lead'
          ? selectedLead?.phone || selectedLead?.whatsapp
          : selectedClient?.phone || selectedClient?.whatsapp;

      const email =
        recordType === 'Lead'
          ? selectedLead?.email
          : selectedClient?.email;

      const leadIdToStore =
        recordType === 'Lead'
          ? selectedLeadId
          : undefined;

      const payload: CreateFollowUpInput = {
        lead_id: leadIdToStore,
        action: actionType,
        scheduled_at: scheduledAtIso,
        end_time: calculatedEndTimeIso,
        title: title.trim() || `${actionType}: ${companyName || 'Contact'}`,
        location: location.trim(),
        notes: notes.trim(),
        assigned_to: assignedTo,
        company_name: companyName,
        contact_person: contactPerson,
        phone,
        email,
        priority: selectedLead?.priority || 'Warm',
        client_id: recordType === 'Client' ? selectedClientId : undefined,
        entity_type: recordType,
        status: 'pending',
      };

      const newRecord = await createFollowUp(payload);
      onSuccess(newRecord);
      onClose();
    } catch (err: any) {
      console.error('Error scheduling appointment:', err);
      setErrorMessage(err.message || 'Failed to schedule appointment. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="schedule-appointment-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Schedule Appointment / Follow-up
              </h3>
              <p className="text-xs text-slate-500">
                Synchronized with Sales Calendar &amp; Follow-up Center
              </p>
            </div>
          </div>
          <button
            id="close-schedule-modal-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-xs text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Conflict Alert Banner */}
          {conflict && (
            <div className="rounded-xl bg-amber-50 p-4 border border-amber-300 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Schedule Conflict Detected</span>
              </div>
              <p className="text-amber-800 leading-relaxed">{conflict.reason}</p>
              {isAdmin ? (
                <label className="flex items-center gap-2 pt-1 font-semibold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminOverride}
                    onChange={(e) => setAdminOverride(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Admin Override: Schedule appointment despite overlap</span>
                </label>
              ) : (
                <div className="text-[11px] text-amber-700 italic">
                  Please choose a non-overlapping time slot.
                </div>
              )}
            </div>
          )}

          {/* Section 1: Record Link (Lead vs Client) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Related CRM Record <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRecordType('Lead');
                  setRecordSearch('');
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold border transition ${
                  recordType === 'Lead'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Sales Lead</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecordType('Client');
                  setRecordSearch('');
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold border transition ${
                  recordType === 'Client'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Customer Account (Client)</span>
              </button>
            </div>

            {/* Selector Dropdown */}
            {recordType === 'Lead' ? (
              <div className="space-y-1 pt-1">
                <select
                  id="schedule-select-lead"
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select a Lead...</option>
                  {filteredLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.company_name} — {l.contact_person || l.phone || 'No Contact'} ({l.status})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1 pt-1">
                <select
                  id="schedule-select-client"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select a Client Account...</option>
                  {filteredClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} — {c.contact_person || c.phone || 'No Contact'} ({c.status || 'Active'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Action Type & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Action / Appointment Type <span className="text-rose-500">*</span>
              </label>
              <select
                id="schedule-action-type"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                <option value="Meeting">Meeting (In-person / Virtual)</option>
                <option value="Site Visit">Site Visit (Field Inspection)</option>
                <option value="Call">Phone Call Follow-up</option>
                <option value="WhatsApp Follow-up">WhatsApp Follow-up</option>
                <option value="Email Follow-up">Email Follow-up</option>
                <option value="Customer Check-in">Customer Check-in</option>
                <option value="New Requirement">New Requirement Review</option>
                <option value="Repeat Order Discussion">Repeat Order Discussion</option>
                <option value="General Follow-up">General Follow-up</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Title / Subject (Optional)
              </label>
              <input
                id="schedule-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Factory Tour or Pricing Negotiation"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Section 3: Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="schedule-date-input"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                id="schedule-time-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Duration
              </label>
              <select
                id="schedule-duration-select"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Section 4: Location (especially for Site Visit & Meeting) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Location / Venue
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="schedule-location-input"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Client HQ - Ruwi, Sohar Industrial Area, or Zoom"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {/* Quick location chips */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {['Client Office', 'Sohar Industrial Estate', 'Muscat HQ', 'Project Site', 'Phone / Virtual'].map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200 transition"
                >
                  + {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Section 5: Assigned Salesman */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Assigned Sales Representative <span className="text-rose-500">*</span>
            </label>
            {isAdmin ? (
              <select
                id="schedule-assigned-to"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.role})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-200 text-xs text-slate-700 font-medium">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <span>{userProfile?.full_name || 'My Schedule'} (Self-Assigned)</span>
              </div>
            )}
          </div>

          {/* Section 6: Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Appointment Notes &amp; Agenda (Optional)
            </label>
            <textarea
              id="schedule-notes-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preparation notes, discussion points, or directions..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              id="cancel-schedule-btn"
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              id="save-schedule-appointment-btn"
              type="submit"
              disabled={submitting}
              className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition ${
                conflict && !adminOverride
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98'
              }`}
            >
              {submitting ? 'Scheduling...' : conflict && adminOverride ? 'Override & Schedule' : 'Confirm & Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
