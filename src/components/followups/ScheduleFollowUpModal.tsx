import React, { useState } from 'react';
import {
  X,
  CalendarPlus,
  AlertCircle,
  Building2,
  User,
  Clock,
} from 'lucide-react';
import { LeadRecord, UserProfile, CreateFollowUpInput, FollowUpActionType } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface ScheduleFollowUpModalProps {
  isOpen: boolean;
  leads: LeadRecord[];
  users: UserProfile[];
  initialLeadId?: string;
  initialAction?: FollowUpActionType;
  onClose: () => void;
  onSchedule: (input: CreateFollowUpInput) => Promise<void>;
}

export const ScheduleFollowUpModal: React.FC<ScheduleFollowUpModalProps> = ({
  isOpen,
  leads,
  users,
  initialLeadId,
  initialAction = 'Call',
  onClose,
  onSchedule,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || leads[0]?.id || '');
  const [action, setAction] = useState<FollowUpActionType>(initialAction);
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [time, setTime] = useState<string>('10:00');
  const [assignedTo, setAssignedTo] = useState<string>(() => {
    if (initialLeadId) {
      const match = leads.find((l) => l.id === initialLeadId);
      if (match?.assigned_to) return match.assigned_to;
    }
    return userProfile?.id || '';
  });
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      const effectiveId = initialLeadId || leads[0]?.id || '';
      setSelectedLeadId(effectiveId);
      if (initialAction) setAction(initialAction);
      const match = leads.find((l) => l.id === effectiveId);
      if (match?.assigned_to) {
        setAssignedTo(match.assigned_to);
      } else {
        setAssignedTo(userProfile?.id || '');
      }
      setError('');
    }
  }, [isOpen, initialLeadId, initialAction, leads, userProfile?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
      setError('Please select a lead for this follow-up.');
      return;
    }
    if (!date) {
      setError('Please select a follow-up date.');
      return;
    }

    const selectedLead = leads.find((l) => l.id === selectedLeadId);
    const combinedDateTime = new Date(`${date}T${time || '10:00'}:00`).toISOString();

    try {
      setSubmitting(true);
      setError('');
      await onSchedule({
        lead_id: selectedLeadId,
        company_name: selectedLead?.company_name,
        contact_person: selectedLead?.contact_person,
        phone: selectedLead?.phone || selectedLead?.whatsapp,
        priority: selectedLead?.priority,
        action,
        scheduled_at: combinedDateTime,
        notes: notes.trim(),
        assigned_to: isAdmin && assignedTo ? assignedTo : userProfile?.id,
        status: 'pending',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule follow-up');
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Schedule Follow-up</h3>
              <p className="text-xs text-slate-500">
                Plan your next contact touchpoint
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
          {/* Select Lead */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Client / Lead <span className="text-rose-500">*</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Action Type */}
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
                <option value="Email">Email</option>
                <option value="Site Visit">Site Visit</option>
                <option value="Customer Check-in">Customer Check-in</option>
                <option value="New Requirement">New Requirement</option>
                <option value="Repeat Order Discussion">Repeat Order Discussion</option>
                <option value="General Follow-up">General Follow-up</option>
                <option value="Quotation Follow-up">Quotation Follow-up</option>
                <option value="Contract Review">Contract Review</option>
                <option value="Payment Follow-up">Payment Follow-up</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Admin Assignment */}
            {isAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign To Representative
                </label>
                <select
                  id="select-schedule-assigned-to"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  <option value={userProfile?.id || ''}>Myself ({userProfile?.full_name})</option>
                  {users
                    .filter((u) => u.id !== userProfile?.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </option>
                    ))}
                </select>
              </div>
            )}
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

          {/* Action Objective / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Objective / Discussion Points
            </label>
            <textarea
              id="input-schedule-notes"
              rows={3}
              placeholder="e.g., Check if client reviewed the proposal and answer technical questions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
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
              disabled={submitting || leads.length === 0}
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
