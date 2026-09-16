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
  Trash2,
} from 'lucide-react';
import { LeadRecord, ClientRecord, LeadStatus, Priority, ClientStatus, UserProfile } from '../../types/database';
import { BulkOperationResult } from '../../types/dataManagement';
import { executeBulkLeadUpdate, executeBulkLeadAssignment, executeBulkClientUpdate } from '../../lib/bulkOperationsService';
import { deleteLead } from '../../lib/dal';
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
    'status' | 'priority' | 'assign' | 'add_tag' | 'remove_tag' | 'client_status' | 'delete' | null
  >(null);

  // Form selections
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>('Contacted');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('Hot');
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [tagName, setTagName] = useState<string>('');
  const [selectedClientStatus, setSelectedClientStatus] = useState<ClientStatus>('Active');
  const [deleteReason, setDeleteReason] = useState<string>('Bulk lead deletion by administrator');
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

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

  // 4. Confirm and execute lead deletion (Admin Only)
  const handleApplyLeadDelete = async () => {
    if (deleteConfirmText.trim() !== 'DELETE') {
      addToast('error', 'Confirmation Required', 'Please type DELETE to confirm removal.');
      return;
    }
    setIsExecuting(true);
    let successCount = 0;
    let failCount = 0;

    const actor = {
      id: userProfile?.id || currentUser?.uid || 'user',
      name: userProfile?.full_name || currentUser?.displayName || 'Administrator',
      role: userProfile?.role || 'ADMIN',
      company_id: userProfile?.company_id,
    };

    for (const lead of selectedItems as LeadRecord[]) {
      try {
        await deleteLead(lead.id, deleteReason.trim() || 'Bulk deletion by administrator', actor);
        successCount++;
      } catch (e) {
        console.error(`Failed to delete lead ${lead.id}:`, e);
        failCount++;
      }
    }

    setIsExecuting(false);
    setActiveModal(null);
    setDeleteConfirmText('');

    if (successCount > 0) {
      addToast(
        'success',
        'Leads Deleted',
        `Successfully deleted ${successCount} lead${successCount > 1 ? 's' : ''}.${failCount > 0 ? ` (${failCount} failed)` : ''}`
      );
      onOperationComplete();
      onClearSelection();
    } else {
      addToast('error', 'Deletion Failed', 'Could not delete the selected leads.');
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

              {/* Delete Button (Strictly for Company Admin) */}
              {isAdmin && (
                <button
                  type="button"
                  id="bulk-delete-leads-btn"
                  onClick={() => {
                    setDeleteReason('Bulk lead deletion by administrator');
                    setDeleteConfirmText('');
                    setActiveModal('delete');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer shadow-xs"
                  title="Delete selected leads (Admin Only)"
                >
                  <Trash2 className="h-3.5 w-3.5 text-white" />
                  <span>Delete</span>
                </button>
              )}
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

      {/* 7. Admin Bulk Delete Leads Modal */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete {count} Selected Lead{count > 1 ? 's' : ''}</h3>
                  <p className="text-xs text-slate-500">Company Administrator Action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-3.5 text-xs text-rose-800 leading-relaxed space-y-1">
              <p className="font-semibold text-rose-950">
                Are you sure you want to delete these {count} selected lead{count > 1 ? 's' : ''}?
              </p>
              <p className="text-slate-600 text-[11px]">
                • The leads will be removed from all active pipelines, views, and metrics.<br />
                • Linked Client entities, notes, and activity history remain intact.<br />
                • The deletion is recorded in the permanent company audit trail.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Reason for Deletion <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="E.g., Duplicate records, obsolete contacts, bulk cleanup..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isExecuting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyLeadDelete}
                disabled={isExecuting || deleteConfirmText.trim() !== 'DELETE'}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
              >
                {isExecuting ? 'Deleting...' : `Confirm Delete (${count})`}
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
