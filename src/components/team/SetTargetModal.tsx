import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  Calendar,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import {
  UserProfile,
  TargetRecord,
  TargetType,
  TargetPeriodType,
} from '../../types/database';
import { createTarget, updateTarget } from '../../lib/dal';
import {
  formatTargetTypeName,
  getTargetTypeDescription,
  calculatePeriodDates,
} from '../../utils/targetUtils';
import { useAuth } from '../../context/AuthContext';

interface SetTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesman: UserProfile;
  existingTarget?: TargetRecord | null;
  activeTargets?: TargetRecord[];
  onTargetSaved?: (target: TargetRecord) => void;
}

export const SetTargetModal: React.FC<SetTargetModalProps> = ({
  isOpen,
  onClose,
  salesman,
  existingTarget,
  activeTargets = [],
  onTargetSaved,
}) => {
  const { userProfile: currentAdmin } = useAuth();

  const [targetType, setTargetType] = useState<TargetType>(
    existingTarget?.target_type || 'LEADS_MANAGED'
  );
  const [targetValue, setTargetValue] = useState<string>(
    existingTarget ? String(existingTarget.target_value) : '50'
  );
  const [periodType, setPeriodType] = useState<TargetPeriodType>(
    existingTarget?.period_type || 'MONTHLY'
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [notes, setNotes] = useState<string>(existingTarget?.notes || '');
  const [updateReason, setUpdateReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or recompute default dates when period type changes
  useEffect(() => {
    if (existingTarget) {
      setTargetType(existingTarget.target_type);
      setTargetValue(String(existingTarget.target_value));
      setPeriodType(existingTarget.period_type);
      setStartDate(existingTarget.start_date || '');
      setEndDate(existingTarget.end_date || '');
      setNotes(existingTarget.notes || '');
    } else {
      const dates = calculatePeriodDates(periodType);
      setStartDate(dates.startDate);
      setEndDate(dates.endDate);
    }
  }, [existingTarget, periodType]);

  // Check if an existing active target matches the selected targetType and periodType
  const conflictingTarget = activeTargets.find(
    (t) =>
      t.salesman_id === salesman.id &&
      t.target_type === targetType &&
      t.period_type === periodType &&
      t.status === 'ACTIVE' &&
      (!existingTarget || t.id !== existingTarget.id)
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = Number(targetValue);
    if (!val || isNaN(val) || val <= 0) {
      setError('Target value must be a positive number greater than 0.');
      return;
    }

    if (!startDate || !endDate) {
      setError('Both start date and end date are required.');
      return;
    }

    if (endDate < startDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setLoading(true);
    try {
      let saved: TargetRecord;
      if (existingTarget) {
        saved = await updateTarget(
          existingTarget.id,
          {
            target_id: existingTarget.id,
            target_value: val,
            period_type: periodType,
            start_date: startDate,
            end_date: endDate,
            notes: notes.trim(),
            reason: updateReason.trim() || undefined,
          },
          currentAdmin || undefined
        );
      } else if (conflictingTarget) {
        // Update the conflicting active target seamlessly while archiving history
        saved = await updateTarget(
          conflictingTarget.id,
          {
            target_id: conflictingTarget.id,
            target_value: val,
            period_type: periodType,
            start_date: startDate,
            end_date: endDate,
            notes: notes.trim(),
            reason: `Target revised by ${currentAdmin?.full_name || 'Admin'}`,
          },
          currentAdmin || undefined
        );
      } else {
        saved = await createTarget(
          {
            salesman_id: salesman.id,
            salesman_name: salesman.full_name,
            target_type: targetType,
            target_value: val,
            period_type: periodType,
            start_date: startDate,
            end_date: endDate,
            notes: notes.trim(),
          },
          currentAdmin || undefined
        );
      }

      if (onTargetSaved) {
        onTargetSaved(saved);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save target.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="set-target-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="set-target-modal-container"
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: '#18181b',
          borderColor: 'var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl border flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(212, 175, 55, 0.15)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
              }}
            >
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {existingTarget ? 'Update Commercial Target' : 'Set Sales Target'}
              </h2>
              <p className="text-xs text-slate-400">
                Configure KPI goal for <strong className="text-amber-400">{salesman.full_name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Warning if conflicting active target */}
        {!existingTarget && conflictingTarget && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Existing Active Target Detected</p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                {salesman.full_name} already has an active {formatTargetTypeName(targetType)} target (
                <strong>{conflictingTarget.target_value}</strong>). Saving will update the target and preserve history.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Target Metric / Type <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  'LEADS_MANAGED',
                  'LEADS_WON',
                  'CLIENTS_ADDED',
                  'FOLLOWUPS_COMPLETED',
                  'ACTIVITIES_COMPLETED',
                ] as TargetType[]
              ).map((type) => {
                const isSelected = targetType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => !existingTarget && setTargetType(type)}
                    disabled={!!existingTarget}
                    className={`flex items-start justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-amber-400/80 bg-amber-400/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    } ${existingTarget ? 'opacity-80 cursor-not-allowed' : ''}`}
                  >
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                        <span className={isSelected ? 'text-amber-300' : 'text-slate-200'}>
                          {formatTargetTypeName(type)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {getTargetTypeDescription(type)}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Value & Period Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Value */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Goal Value <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-black/40 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Quantity required for the period
              </p>
            </div>

            {/* Period Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cadence / Period <span className="text-rose-400">*</span>
              </label>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as TargetPeriodType)}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-black/40 text-xs font-semibold text-white focus:outline-none focus:border-amber-400 transition"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <option value="MONTHLY">Monthly (Current Month)</option>
                <option value="QUARTERLY">Quarterly (Current Quarter)</option>
                <option value="YEARLY">Yearly (Current Year)</option>
                <option value="CUSTOM">Custom Date Range</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Evaluation time window
              </p>
            </div>
          </div>

          {/* Date Boundaries */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border bg-black/40 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                End Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border bg-black/40 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </div>
          </div>

          {/* Reason for change (if editing) */}
          {existingTarget && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Revision
              </label>
              <input
                type="text"
                value={updateReason}
                onChange={(e) => setUpdateReason(e.target.value)}
                placeholder="e.g., Increased pipeline quota for mid-year expansion"
                className="w-full px-3.5 py-2 rounded-xl border bg-black/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Instructions &amp; Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide strategic context or incentives for the sales representative..."
              className="w-full px-3.5 py-2 rounded-xl border bg-black/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition resize-none"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>

          {/* Modal Footer */}
          <div
            className="pt-4 border-t flex items-center justify-end gap-3"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              style={{ borderColor: 'var(--border-color)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-black transition cursor-pointer flex items-center gap-2 hover:opacity-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Target className="h-4 w-4" />
              <span>{loading ? 'Saving...' : existingTarget ? 'Update Target' : 'Set Target'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
