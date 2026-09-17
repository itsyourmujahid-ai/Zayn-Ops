import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { FollowUpRecord, RescheduleFollowUpInput, FollowUpActionType } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface RescheduleFollowUpModalProps {
  isOpen: boolean;
  followUp: FollowUpRecord | null;
  onClose: () => void;
  onReschedule: (input: RescheduleFollowUpInput) => Promise<void>;
}

export const RescheduleFollowUpModal: React.FC<RescheduleFollowUpModalProps> = ({
  isOpen,
  followUp,
  onClose,
  onReschedule,
}) => {
  const { userProfile } = useAuth();
  const [newAction, setNewAction] = useState<FollowUpActionType>(
    (followUp?.action as FollowUpActionType) || 'Call'
  );
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('11:00');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !followUp) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) {
      setError('Please select a new date for the follow-up.');
      return;
    }

    const combinedDateTime = new Date(`${newDate}T${newTime || '10:00'}:00`).toISOString();

    try {
      setSubmitting(true);
      setError('');
      await onReschedule({
        lead_id: followUp.lead_id,
        client_id: followUp.client_id,
        followup_id: followUp.id,
        new_scheduled_at: combinedDateTime,
        new_action: newAction,
        notes: notes.trim(),
        performer_id: userProfile?.id,
        performer_name: userProfile?.full_name,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  const oldDateFormatted = followUp.scheduled_at
    ? new Date(followUp.scheduled_at).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not set';

  return (
    <div
      id="modal-reschedule-followup"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Reschedule Follow-up</h3>
              <p className="text-xs text-slate-500">
                {followUp.company_name}
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
          {/* Current schedule info */}
          <div className="rounded-xl bg-slate-50 p-3 text-xs border border-slate-200 text-slate-600">
            <span className="font-semibold text-slate-700">Currently Scheduled: </span>
            <span>{followUp.action} on {oldDateFormatted}</span>
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Action Type
            </label>
            <select
              id="select-reschedule-action"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value as FollowUpActionType)}
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

          {/* New Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-reschedule-date"
                type="date"
                value={newDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Time
              </label>
              <input
                id="input-reschedule-time"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Reschedule Reason / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Rescheduling / Notes
            </label>
            <textarea
              id="input-reschedule-notes"
              rows={2}
              placeholder="e.g., Client out of office, requested call on Thursday afternoon..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none resize-none"
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
              id="btn-submit-reschedule-followup"
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{submitting ? 'Saving...' : 'Confirm Reschedule'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
