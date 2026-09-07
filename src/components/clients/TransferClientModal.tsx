import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { UserProfile, ClientRecord } from '../../types/database';
import { getActiveSalesmen, transferClientOwnership } from '../../lib/dal';
import { useAuth } from '../../context/AuthContext';

interface TransferClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientRecord;
  currentOwnerName: string;
  onTransferred?: () => void;
}

export const TransferClientModal: React.FC<TransferClientModalProps> = ({
  isOpen,
  onClose,
  client,
  currentOwnerName,
  onTransferred,
}) => {
  const { userProfile, currentUser } = useAuth();
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
          // Filter to same company
          const companyUsers = client.company_id
            ? users.filter((u) => !u.company_id || u.company_id === client.company_id)
            : users;
          setSalesmen(companyUsers);
          const other = companyUsers.find((u) => u.id !== client.owner_id);
          if (other) {
            setSelectedSalesmanId(other.id);
          } else if (companyUsers.length > 0) {
            setSelectedSalesmanId(companyUsers[0].id);
          }
        })
        .catch((err) => {
          console.error('Failed to load salesmen for client transfer:', err);
          setError('Failed to load team members.');
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [isOpen, client.owner_id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSalesmanId) {
      setError('Please select a new representative.');
      return;
    }

    if (selectedSalesmanId === client.owner_id) {
      setError('Selected representative is already the current owner of this client.');
      return;
    }

    const selectedSalesman = salesmen.find((s) => s.id === selectedSalesmanId);
    const newOwnerName = selectedSalesman?.full_name || selectedSalesman?.email || 'New Representative';
    const adminId = userProfile?.id || currentUser?.uid || '';
    const adminName = userProfile?.full_name || currentUser?.displayName || 'Admin';

    try {
      setSubmitting(true);
      await transferClientOwnership({
        client_id: client.id,
        new_owner_id: selectedSalesmanId,
        new_owner_name: newOwnerName,
        reason: reason.trim(),
      });
      onTransferred?.();
      onClose();
    } catch (err: any) {
      console.error('Client ownership transfer failed:', err);
      setError(err?.message || 'Failed to transfer client ownership. Please try again.');
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
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 border border-emerald-100">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Transfer Client Ownership</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">{client.company_name}</p>
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

        {/* Lead immutability notice */}
        <div className="bg-amber-50/80 border-b border-amber-200 px-5 py-2.5 text-xs text-amber-900 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <strong>Preserving Historical Record:</strong> Transferring this Client portfolio reassigns the active account without altering the original Lead’s closing representative.
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Owner Display */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs flex items-center justify-between">
            <span className="text-slate-500">Current Representative:</span>
            <span className="font-bold text-slate-800">{currentOwnerName || 'Unassigned'}</span>
          </div>

          {/* New Representative Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Reassign To Representative <span className="text-rose-500">*</span>
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                <span>Loading team...</span>
              </div>
            ) : (
              <select
                value={selectedSalesmanId}
                onChange={(e) => setSelectedSalesmanId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
              >
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.email}) {s.id === client.owner_id ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Reassignment Reason */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Reason / Account Handover Notes
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Client relationship realignment, regional portfolio transition..."
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingUsers}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirm Transfer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
