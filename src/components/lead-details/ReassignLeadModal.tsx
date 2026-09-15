import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle, Loader2, CheckCircle2, User } from 'lucide-react';
import { UserProfile } from '../../types/database';
import { getActiveSalesmen, getAllUsers } from '../../lib/dal';

interface ReassignLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  companyName: string;
  currentOwnerId: string;
  currentOwnerName: string;
  companyId?: string;
  onReassign: (newOwnerId: string, newOwnerName: string, reason: string) => Promise<void>;
}

export const ReassignLeadModal: React.FC<ReassignLeadModalProps> = ({
  isOpen,
  onClose,
  leadId,
  companyName,
  currentOwnerId,
  currentOwnerName,
  companyId,
  onReassign,
}) => {
  const [salesmen, setSalesmen] = useState<UserProfile[]>([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
      setLoadingUsers(true);

      getActiveSalesmen()
        .then((users) => {
          // Rule 2 & 4: Only active salesmen from the SAME company.
          // Never allow transfer to another company, Customer, SUPER_ADMIN, or ADMIN.
          const filtered = users.filter((u) => {
            const isSameCompany = !companyId || !u.company_id || u.company_id === companyId;
            const isSalesman = u.role === 'SALESMAN' || u.role === 'sales_rep';
            return isSameCompany && isSalesman && u.is_active !== false;
          });

          setSalesmen(filtered);
          // Set default to first salesman that is not the current owner
          const other = filtered.find((u) => u.id !== currentOwnerId);
          if (other) {
            setSelectedSalesmanId(other.id);
          } else if (filtered.length > 0) {
            setSelectedSalesmanId(filtered[0].id);
          }
        })
        .catch((err) => {
          console.error('Failed to load salesmen:', err);
          setError('Failed to load salesmen list.');
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [isOpen, currentOwnerId, companyId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSalesmanId) {
      setError('Please select a new salesman.');
      return;
    }

    if (selectedSalesmanId === currentOwnerId) {
      setError('Selected representative is already the current owner of this lead.');
      return;
    }

    if (!reason.trim()) {
      setError('Reason is required for ownership transfer.');
      return;
    }

    const selectedSalesman = salesmen.find((s) => s.id === selectedSalesmanId);
    const newOwnerName = selectedSalesman?.full_name || selectedSalesman?.email || 'New Salesman';

    try {
      setSubmitting(true);
      await onReassign(selectedSalesmanId, newOwnerName, reason.trim());
      onClose();
    } catch (err: any) {
      console.error('Lead transfer failed:', err);
      setError(err?.message || 'Failed to transfer lead. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Transfer Lead</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">{companyName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Lead & Current Owner Display */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Lead:</span>
              <span className="font-bold text-slate-900 truncate max-w-[200px]">{companyName}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium">Current Owner:</span>
              <span className="font-bold text-slate-800">{currentOwnerName || 'Unassigned'}</span>
            </div>
          </div>

          {/* Transfer To (Salesman selector) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Transfer To <span className="text-rose-500">*</span>
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span>Loading team members...</span>
              </div>
            ) : salesmen.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                No other active salesmen found in this company.
              </div>
            ) : (
              <select
                id="transfer-to-salesman-select"
                value={selectedSalesmanId}
                onChange={(e) => setSelectedSalesmanId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-600 focus:outline-none cursor-pointer"
              >
                {salesmen.map((salesman) => (
                  <option key={salesman.id} value={salesman.id}>
                    {salesman.full_name} ({salesman.email}) {salesman.id === currentOwnerId ? '(Current Owner)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Reason (required text) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="transfer-lead-reason-input"
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for transferring this lead (required)..."
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-indigo-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              id="cancel-transfer-lead-btn"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="confirm-transfer-lead-btn"
              disabled={submitting || loadingUsers || salesmen.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Transfer Lead</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
