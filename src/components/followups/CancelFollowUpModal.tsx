import React, { useState } from 'react';
import {
  X,
  XCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { FollowUpRecord, CancelFollowUpInput } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface CancelFollowUpModalProps {
  isOpen: boolean;
  followUp: FollowUpRecord | null;
  onClose: () => void;
  onCancelFollowUp: (input: CancelFollowUpInput) => Promise<void>;
}

const CANCEL_REASONS = [
  'Client unreachable after multiple attempts',
  'Client no longer interested / Requirements cancelled',
  'Duplicate or redundant follow-up task',
  'Requirement postponed indefinitely by prospect',
  'Assigned to different representative',
  'Other / Custom reason',
];

export const CancelFollowUpModal: React.FC<CancelFollowUpModalProps> = ({
  isOpen,
  followUp,
  onClose,
  onCancelFollowUp,
}) => {
  const { userProfile } = useAuth();
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !followUp) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = isCustom ? customReason.trim() : reason;
    if (!finalReason) {
      setError('Please provide a reason for cancelling this follow-up.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await onCancelFollowUp({
        lead_id: followUp.lead_id,
        followup_id: followUp.id,
        cancellation_reason: finalReason,
        performer_id: userProfile?.id,
        performer_name: userProfile?.full_name,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="modal-cancel-followup"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cancel Follow-up</h3>
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
          <p className="text-xs text-slate-600">
            Cancelling this task will mark it as cancelled and permanently preserve this record in the lead&apos;s activity audit timeline.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            {!isCustom ? (
              <div className="space-y-2">
                <select
                  id="select-cancel-reason"
                  value={reason}
                  onChange={(e) => {
                    if (e.target.value === 'Other / Custom reason') {
                      setIsCustom(true);
                    } else {
                      setReason(e.target.value);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  {CANCEL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  + Write custom reason
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  id="input-custom-cancel-reason"
                  type="text"
                  placeholder="Specify cancellation reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCustom(false)}
                  className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                >
                  ← Choose from preset reasons
                </button>
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
              Keep Follow-up
            </button>
            <button
              id="btn-submit-cancel-followup"
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>{submitting ? 'Cancelling...' : 'Confirm Cancellation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
