import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Layers,
  UserCheck,
  Tag,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Flame,
  Activity,
  User,
  Check,
} from 'lucide-react';
import { LeadRecord, ClientRecord, LeadStatus, Priority, ClientStatus, UserProfile } from '../../types/database';
import { BulkOperationResult } from '../../types/dataManagement';
import { executeBulkLeadUpdate, executeBulkLeadAssignment, executeBulkClientUpdate } from '../../lib/bulkOperationsService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface BulkLeadToolbarProps {
  mode: 'leads';
  selectedItems: LeadRecord[];
  allTeamUsers: UserProfile[];
  onClearSelection: () => void;
  onOperationComplete: () => void;
}

interface BulkClientToolbarProps {
  mode: 'clients';
  selectedItems: ClientRecord[];
  allTeamUsers: UserProfile[];
  onClearSelection: () => void;
  onOperationComplete: () => void;
}

type BulkActionToolbarProps = BulkLeadToolbarProps | BulkClientToolbarProps;

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = (props) => {
  const { mode, selectedItems, allTeamUsers, onClearSelection, onOperationComplete } = props;
  const { currentUser, userProfile, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [activeModal, setActiveModal] = useState<
    'status' | 'priority' | 'assign' | 'add_tag' | 'remove_tag' | 'client_status' | null
  >(null);

  // Form selections
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>('Contacted');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('Hot');
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [tagName, setTagName] = useState<string>('');
  const [selectedClientStatus, setSelectedClientStatus] = useState<ClientStatus>('Active');

  // Execution state
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [resultModal, setResultModal] = useState<BulkOperationResult | null>(null);

  if (selectedItems.length === 0) return null;

  const count = selectedItems.length;

  // 1. Confirm and execute lead status / priority / tag
  const handleApplyLeadUpdate = async (updates: {
    status?: LeadStatus;
    priority?: Priority;
    addTag?: string;
    removeTag?: string;
  }) => {
    setIsExecuting(true);
    try {
      const result = await executeBulkLeadUpdate(
        selectedItems as LeadRecord[],
        updates,
        {
          uid: currentUser?.uid || '',
          name: userProfile?.full_name || 'User',
          role: userProfile?.role || 'SALESMAN',
        }
      );
      setResultModal(result);
      setActiveModal(null);
      if (result.succeeded > 0) {
        addToast('success', 'Bulk Update Complete', `Successfully updated ${result.succeeded} leads.`);
        onOperationComplete();
      }
    } catch (err: any) {
      addToast('error', 'Bulk Action Error', err.message || 'Could not complete update.');
    } finally {
      setIsExecuting(false);
    }
  };

  // 2. Confirm and execute lead assignment
  const handleApplyLeadAssignment = async () => {
    if (!selectedSalesmanId) {
      addToast('error', 'Select Salesman', 'Please select a sales representative.');
      return;
    }
    const targetUser = allTeamUsers.find((u) => u.id === selectedSalesmanId);
    const salesmanName = targetUser?.full_name || 'Sales Representative';

    setIsExecuting(true);
    try {
      const result = await executeBulkLeadAssignment(
        selectedItems as LeadRecord[],
        selectedSalesmanId,
        salesmanName,
        {
          uid: currentUser?.uid || '',
          name: userProfile?.full_name || 'Administrator',
          role: 'ADMIN',
        }
      );
      setResultModal(result);
      setActiveModal(null);
      if (result.succeeded > 0) {
        addToast('success', 'Bulk Assignment Complete', `Reassigned ${result.succeeded} leads to ${salesmanName}.`);
        onOperationComplete();
      }
    } catch (err: any) {
      addToast('error', 'Bulk Assignment Failed', err.message || 'Could not complete assignment.');
    } finally {
      setIsExecuting(false);
    }
  };

  // 3. Confirm and execute client update
  const handleApplyClientUpdate = async (updates: {
    status?: ClientStatus;
    addTag?: string;
    removeTag?: string;
  }) => {
    setIsExecuting(true);
    try {
      const result = await executeBulkClientUpdate(
        selectedItems as ClientRecord[],
        updates,
        {
          uid: currentUser?.uid || '',
          name: userProfile?.full_name || 'User',
          role: userProfile?.role || 'SALESMAN',
        }
      );
      setResultModal(result);
      setActiveModal(null);
      if (result.succeeded > 0) {
        addToast('success', 'Bulk Update Complete', `Successfully updated ${result.succeeded} clients.`);
        onOperationComplete();
      }
    } catch (err: any) {
      addToast('error', 'Bulk Action Error', err.message || 'Could not complete update.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
      {/* Sticky Floating Bottom Bar */}
      <div className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-64 md:right-8 z-40">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 text-white p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 font-bold text-xs text-white">
              {count}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-200">
              {count} {mode === 'leads' ? (count === 1 ? 'Lead' : 'Leads') : count === 1 ? 'Client' : 'Clients'} selected
            </span>
          </div>

          {/* Action Buttons for Leads */}
          {mode === 'leads' && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveModal('status')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5 text-indigo-400" />
                <span>Status</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('priority')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
              >
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                <span>Priority</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveModal('assign')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
                >
                  <UserCheck className="h-3.5 w-3.5 text-white" />
                  <span>Assign Salesman</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveModal('add_tag')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5 text-emerald-400" />
                <span>+ Tag</span>
              </button>
            </div>
          )}

          {/* Action Buttons for Clients */}
          {mode === 'clients' && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveModal('client_status')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                <span>Status</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('add_tag')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5 text-indigo-400" />
                <span>+ Tag</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('remove_tag')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-rose-300 transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-rose-400" />
                <span>- Tag</span>
              </button>
            </div>
          )}

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            title="Deselect All"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Deselect</span>
          </button>
        </div>
      </div>

      {/* CONFIRMATION & INPUT MODALS */}

      {/* 1. Lead Status Update Modal */}
      {activeModal === 'status' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Update Lead Status</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to update the status of <span className="font-bold text-slate-900">{count}</span> prospective leads.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Stage</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as LeadStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                {['New', 'Contacted', 'Interested', 'Meeting', 'Quotation', 'Negotiation', 'Won', 'Lost'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Preserves all timeline history, ownership records, and creates note activities on all affected records.
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => handleApplyLeadUpdate({ status: selectedStatus })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Apply to {count} Leads</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Lead Priority Update Modal */}
      {activeModal === 'priority' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Update Lead Priority</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to change priority for <span className="font-bold text-slate-900">{count}</span> leads.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as Priority)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                <option value="Hot">Hot (High Urgency)</option>
                <option value="Warm">Warm (Active Pipeline)</option>
                <option value="Cold">Cold (Low Engagement)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => handleApplyLeadUpdate({ priority: selectedPriority })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Apply Priority</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bulk Assignment Modal (Admin Only) */}
      {activeModal === 'assign' && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Reassign Leads in Bulk</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to reassign <span className="font-bold text-slate-900">{count}</span> prospective leads to a team representative.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Assignee (Sales Representative)</label>
              <select
                value={selectedSalesmanId}
                onChange={(e) => setSelectedSalesmanId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                <option value="">-- Choose Sales Representative --</option>
                {allTeamUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-indigo-900">Safety &amp; Compliance Guarantee:</div>
              <ul className="list-disc pl-4 text-[11px] text-slate-500 space-y-0.5">
                <li>Preserves original creator (<code>created_by</code>)</li>
                <li>Appends "Lead Assigned" activity to lead timeline</li>
                <li>Dispatches real-time notification to the new assignee</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecuting || !selectedSalesmanId}
                onClick={handleApplyLeadAssignment}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Assign {count} Leads</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add Tag Modal */}
      {activeModal === 'add_tag' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Tag to Selected Records</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apply a tag to <span className="font-bold text-slate-900">{count}</span> records.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tag Name</label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. VIP, Q4 Target, Corporate"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecuting || !tagName.trim()}
                onClick={() => {
                  if (mode === 'leads') {
                    handleApplyLeadUpdate({ addTag: tagName.trim() });
                  } else {
                    handleApplyClientUpdate({ addTag: tagName.trim() });
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Apply Tag</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Client Status Modal */}
      {activeModal === 'client_status' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Update Client Account Status</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to change the account status for <span className="font-bold text-slate-900">{count}</span> clients.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={selectedClientStatus}
                onChange={(e) => setSelectedClientStatus(e.target.value as ClientStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                <option value="Active">Active (In Business)</option>
                <option value="Inactive">Inactive (Dormant Account)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => handleApplyClientUpdate({ status: selectedClientStatus })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Update Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS / SUMMARY MODAL */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              {resultModal.failed === 0 ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900">Bulk Operation Summary</h3>
                <p className="text-xs text-slate-500">
                  {resultModal.succeeded} updated, {resultModal.failed} failed
                </p>
              </div>
            </div>

            {resultModal.errors && resultModal.errors.length > 0 && (
              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 max-h-40 overflow-y-auto space-y-1 text-xs text-rose-800">
                <div className="font-bold text-[11px] uppercase tracking-wider text-rose-700">Failure Notices:</div>
                {resultModal.errors.map((err, idx) => (
                  <div key={idx} className="text-[11px]">
                    • {err.name ? `${err.name}: ` : ''}{err.error}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setResultModal(null);
                  onClearSelection();
                }}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
