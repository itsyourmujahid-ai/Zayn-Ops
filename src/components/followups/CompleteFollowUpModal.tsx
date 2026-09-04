import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { FollowUpRecord, CompleteFollowUpInput, FollowUpActionType } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface CompleteFollowUpModalProps {
  isOpen: boolean;
  followUp: FollowUpRecord | null;
  onClose: () => void;
  onComplete: (input: CompleteFollowUpInput) => Promise<void>;
}

const OUTCOME_PRESETS = [
  'Answered - Highly Interested',
  'Answered - Requested Quotation',
  'Answered - Scheduled Meeting',
  'Answered - Requested Callback',
  'Left Voicemail / Voice Note',
  'Client Busy - Try Again Later',
  'Requirement Changed / Delayed',
  'Not Interested at this time',
  'Meeting Completed Successfully',
  'Deal Closed / Won Verbal Agreement',
];

export const CompleteFollowUpModal: React.FC<CompleteFollowUpModalProps> = ({
  isOpen,
  followUp,
  onClose,
  onComplete,
}) => {
  const { userProfile } = useAuth();
  const [outcome, setOutcome] = useState<string>(OUTCOME_PRESETS[0]);
  const [customOutcome, setCustomOutcome] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [scheduleNext, setScheduleNext] = useState<boolean>(false);
  const [nextAction, setNextAction] = useState<FollowUpActionType>('Call');
  const [nextDate, setNextDate] = useState<string>('');
  const [nextTime, setNextTime] = useState<string>('10:00');
  const [nextNotes, setNextNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !followUp) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalOutcome = isCustom ? customOutcome.trim() : outcome;
    if (!finalOutcome) {
      setError('Please select or specify an outcome for this follow-up.');
      return;
    }

    let nextFollowUpPayload = undefined;
    if (scheduleNext) {
      if (!nextDate) {
        setError('Please choose a date for the next follow-up.');
        return;
      }
      const combinedDateTime = new Date(`${nextDate}T${nextTime || '10:00'}:00`).toISOString();
      nextFollowUpPayload = {
        action: nextAction,
        scheduled_at: combinedDateTime,
        notes: nextNotes.trim(),
      };
    }

    try {
      setSubmitting(true);
      setError('');
      await onComplete({
        lead_id: followUp.lead_id,
        followup_id: followUp.id,
        outcome: finalOutcome,
        notes: notes.trim(),
        performer_id: userProfile?.id,
        performer_name: userProfile?.full_name,
        next_followup: nextFollowUpPayload,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="modal-complete-followup"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Complete Follow-up</h3>
              <p className="text-xs text-slate-500">
                {followUp.company_name} • {followUp.action}
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
          {/* Outcome selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Follow-up Outcome <span className="text-rose-500">*</span>
            </label>
            {!isCustom ? (
              <div className="space-y-2">
                <select
                  id="select-complete-outcome"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  {OUTCOME_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  + Write custom outcome
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  id="input-custom-outcome"
                  type="text"
                  placeholder="e.g., Client requested 15% volume discount..."
                  value={customOutcome}
                  onChange={(e) => setCustomOutcome(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCustom(false)}
                  className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                >
                  ← Choose from standard outcomes
                </button>
              </div>
            )}
          </div>

          {/* Interaction Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Discussion Notes &amp; Summary
            </label>
            <textarea
              id="input-complete-notes"
              rows={3}
              placeholder="What was discussed? Any specific requirements or client feedback?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none resize-none"
            />
          </div>

          {/* Schedule Next Follow-up Checkbox */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                id="checkbox-schedule-next"
                type="checkbox"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Schedule Next Action Immediately
              </span>
            </label>

            {scheduleNext && (
              <div className="mt-3 space-y-3 border-t border-indigo-100 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Action Type
                    </label>
                    <select
                      id="select-next-action-type"
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value as FollowUpActionType)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="Call">Call</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Email">Email</option>
                      <option value="Site Visit">Site Visit</option>
                      <option value="Demo">Demo</option>
                      <option value="Quotation">Quotation Follow-up</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="input-next-date"
                      type="date"
                      value={nextDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setNextDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Time
                    </label>
                    <input
                      id="input-next-time"
                      type="time"
                      value={nextTime}
                      onChange={(e) => setNextTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Next Action Objective
                    </label>
                    <input
                      id="input-next-notes"
                      type="text"
                      placeholder="e.g., Send revised quote"
                      value={nextNotes}
                      onChange={(e) => setNextNotes(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
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
              id="btn-submit-complete-followup"
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{submitting ? 'Saving...' : 'Mark as Completed'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
