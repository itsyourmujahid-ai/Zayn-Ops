import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  Check,
  GitMerge,
  ShieldAlert,
  Building2,
  User,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Tag,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { LeadRecord, ClientRecord, UserProfile } from '../../types/database';
import { mergeLeads, mergeClients, markAsNotDuplicate, getAllUsers } from '../../lib/dal';
import { useAuth } from '../../context/AuthContext';

interface RecordMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'Lead' | 'Client';
  recordA: LeadRecord | ClientRecord;
  recordB: LeadRecord | ClientRecord;
  matchReason?: string;
  matchScore?: number;
  onMergeSuccess: (survivingId: string) => void;
  onMarkNotDuplicate?: () => void;
}

export const RecordMergeModal: React.FC<RecordMergeModalProps> = ({
  isOpen,
  onClose,
  entityType,
  recordA,
  recordB,
  matchReason,
  matchScore,
  onMergeSuccess,
  onMarkNotDuplicate,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [survivorId, setSurvivorId] = useState<string>(recordA.id);
  const [notesMode, setNotesMode] = useState<'combine' | 'survivor_only'>('combine');
  const [tagsMode, setTagsMode] = useState<'combine' | 'survivor_only'>('combine');
  const [survivingOwnerId, setSurvivingOwnerId] = useState<string>('');
  const [customMergeNote, setCustomMergeNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Field picks: key -> 'A' or 'B'
  const [fieldPicks, setFieldPicks] = useState<Record<string, 'A' | 'B'>>({});

  useEffect(() => {
    if (!isOpen) return;
    // By default, let older record or record with more data be survivor, or recordA
    setSurvivorId(recordA.id);
    const initialOwner =
      entityType === 'Lead'
        ? (recordA as LeadRecord).assigned_to
        : (recordA as ClientRecord).owner_id;
    setSurvivingOwnerId(initialOwner);

    // Default all field picks to Record A, unless Record A is empty and B has value
    const picks: Record<string, 'A' | 'B'> = {};
    const keysToCheck = [
      'company_name',
      'contact_person',
      'phone',
      'whatsapp',
      'email',
      'location',
      entityType === 'Lead' ? 'lead_type' : 'client_type',
      'source',
      'priority',
      'status',
      'estimated_value',
      'expected_closing_date',
    ];

    keysToCheck.forEach((k) => {
      const valA = (recordA as any)[k];
      const valB = (recordB as any)[k];
      if (!valA && valB) {
        picks[k] = 'B';
      } else {
        picks[k] = 'A';
      }
    });

    setFieldPicks(picks);

    // Load salesmen list for owner dropdown
    getAllUsers()
      .then((u) => setUsers(u))
      .catch((err) => console.warn('RecordMergeModal users load notice:', err));
  }, [isOpen, recordA, recordB, entityType]);

  if (!isOpen) return null;

  const isSurvivorA = survivorId === recordA.id;
  const survivingRecord = isSurvivorA ? recordA : recordB;
  const mergedRecord = isSurvivorA ? recordB : recordA;

  const handlePickField = (field: string, source: 'A' | 'B') => {
    setFieldPicks((prev) => ({ ...prev, [field]: source }));
  };

  const handleSwitchSurvivor = (newSurvivorId: string) => {
    setSurvivorId(newSurvivorId);
    const newOwner =
      entityType === 'Lead'
        ? newSurvivorId === recordA.id
          ? (recordA as LeadRecord).assigned_to
          : (recordB as LeadRecord).assigned_to
        : newSurvivorId === recordA.id
        ? (recordA as ClientRecord).owner_id
        : (recordB as ClientRecord).owner_id;
    setSurvivingOwnerId(newOwner);
  };

  const handleExecuteMerge = async () => {
    if (!isAdmin) {
      setError('Administrator credentials required to perform record merges.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (entityType === 'Lead') {
        const leadA = recordA as LeadRecord;
        const leadB = recordB as LeadRecord;

        const getWinningVal = (field: string) => {
          const pick = fieldPicks[field] || (isSurvivorA ? 'A' : 'B');
          return pick === 'A' ? (leadA as any)[field] : (leadB as any)[field];
        };

        const winningFields = {
          company_name: getWinningVal('company_name') || survivingRecord.company_name,
          contact_person: getWinningVal('contact_person'),
          phone: getWinningVal('phone'),
          whatsapp: getWinningVal('whatsapp'),
          email: getWinningVal('email'),
          location: getWinningVal('location'),
          lead_type: getWinningVal('lead_type'),
          source: getWinningVal('source'),
          priority: getWinningVal('priority'),
          status: getWinningVal('status'),
          estimated_value: getWinningVal('estimated_value'),
          expected_closing_date: getWinningVal('expected_closing_date'),
        };

        await mergeLeads({
          survivingLeadId: survivingRecord.id,
          mergedLeadId: mergedRecord.id,
          survivingOwnerId: survivingOwnerId || (survivingRecord as LeadRecord).assigned_to,
          winningFields,
          notesMode,
          tagsMode,
          mergeNotes: customMergeNote || undefined,
        });

        onMergeSuccess(survivingRecord.id);
        onClose();
      } else {
        const clientA = recordA as ClientRecord;
        const clientB = recordB as ClientRecord;

        const getWinningVal = (field: string) => {
          const pick = fieldPicks[field] || (isSurvivorA ? 'A' : 'B');
          return pick === 'A' ? (clientA as any)[field] : (clientB as any)[field];
        };

        const winningFields = {
          company_name: getWinningVal('company_name') || survivingRecord.company_name,
          contact_person: getWinningVal('contact_person'),
          phone: getWinningVal('phone'),
          whatsapp: getWinningVal('whatsapp'),
          email: getWinningVal('email'),
          location: getWinningVal('location'),
          client_type: getWinningVal('client_type'),
          status: getWinningVal('status'),
        };

        await mergeClients({
          survivingClientId: survivingRecord.id,
          mergedClientId: mergedRecord.id,
          survivingOwnerId: survivingOwnerId || (survivingRecord as ClientRecord).owner_id,
          winningFields,
          notesMode,
          tagsMode,
          mergeNotes: customMergeNote || undefined,
        });

        onMergeSuccess(survivingRecord.id);
        onClose();
      }
    } catch (err: any) {
      console.error('Record merge error:', err);
      setError(err?.message || 'Failed to merge records. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissDuplicate = async () => {
    if (!isAdmin) {
      setError('Only administrators can dismiss duplicate suggestions.');
      return;
    }

    try {
      await markAsNotDuplicate(recordA.id, recordB.id, entityType);
      if (onMarkNotDuplicate) onMarkNotDuplicate();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to dismiss duplicate.');
    }
  };

  // Helper row component for side-by-side field resolution
  const renderFieldRow = (
    label: string,
    fieldKey: string,
    icon: React.ReactNode,
    formatter?: (val: any) => string | React.ReactNode
  ) => {
    const valA = (recordA as any)[fieldKey];
    const valB = (recordB as any)[fieldKey];
    const chosenSource = fieldPicks[fieldKey] || (isSurvivorA ? 'A' : 'B');

    const displayA = formatter ? formatter(valA) : valA || <span className="text-slate-400 italic">Empty</span>;
    const displayB = formatter ? formatter(valB) : valB || <span className="text-slate-400 italic">Empty</span>;

    const isIdentical = String(valA || '').trim().toLowerCase() === String(valB || '').trim().toLowerCase();

    return (
      <div key={fieldKey} className="grid grid-cols-12 gap-3 py-2.5 px-3 border-b border-slate-100 hover:bg-slate-50/70 items-center text-sm">
        <div className="col-span-3 flex items-center gap-2 text-slate-600 font-medium">
          <span className="text-slate-400">{icon}</span>
          <span className="truncate">{label}</span>
          {isIdentical && valA && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
              Match
            </span>
          )}
        </div>

        {/* Option A */}
        <div className="col-span-4">
          <button
            type="button"
            onClick={() => handlePickField(fieldKey, 'A')}
            className={`w-full text-left px-3 py-1.5 rounded-lg border text-xs transition flex items-center justify-between ${
              chosenSource === 'A'
                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium ring-1 ring-indigo-600 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="truncate pr-1">{displayA}</span>
            {chosenSource === 'A' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
          </button>
        </div>

        {/* Option B */}
        <div className="col-span-4">
          <button
            type="button"
            onClick={() => handlePickField(fieldKey, 'B')}
            className={`w-full text-left px-3 py-1.5 rounded-lg border text-xs transition flex items-center justify-between ${
              chosenSource === 'B'
                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium ring-1 ring-indigo-600 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="truncate pr-1">{displayB}</span>
            {chosenSource === 'B' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
          </button>
        </div>

        {/* Indicator */}
        <div className="col-span-1 text-center">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
            chosenSource === 'A' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {chosenSource}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      id="record-merge-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Safe Record Merge ({entityType})
                </h2>
                {matchScore !== undefined && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      matchScore >= 90
                        ? 'bg-emerald-100 text-emerald-800'
                        : matchScore >= 70
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {matchScore}% Match
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {matchReason || 'Resolve field conflicts and consolidate duplicate records without data loss.'}
              </p>
            </div>
          </div>

          <button
            id="close-merge-modal-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3.5 text-sm text-red-700 border border-red-200">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Survivor Selector */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Step 1: Choose Surviving Master Record</span>
              <span className="text-[11px] font-normal text-slate-400 lowercase">
                The surviving record preserves its primary ID & URL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card A */}
              <div
                onClick={() => handleSwitchSurvivor(recordA.id)}
                className={`cursor-pointer rounded-xl p-4 border transition ${
                  isSurvivorA
                    ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/30 shadow-xs'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    <span>Record A</span>
                    {isSurvivorA && <span>(Surviving Master)</span>}
                  </span>
                  <input
                    type="radio"
                    name="survivorSelection"
                    checked={isSurvivorA}
                    onChange={() => handleSwitchSurvivor(recordA.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="font-semibold text-slate-900 text-base">{recordA.company_name}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>ID: {recordA.id}</span>
                  <span>•</span>
                  <span>Created: {new Date(recordA.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-3 text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg">
                  <div>Contact: {recordA.contact_person || '—'}</div>
                  <div>Phone: {recordA.phone || '—'}</div>
                  <div>Email: {recordA.email || '—'}</div>
                </div>
              </div>

              {/* Card B */}
              <div
                onClick={() => handleSwitchSurvivor(recordB.id)}
                className={`cursor-pointer rounded-xl p-4 border transition ${
                  !isSurvivorA
                    ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/30 shadow-xs'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                    <span>Record B</span>
                    {!isSurvivorA && <span>(Surviving Master)</span>}
                  </span>
                  <input
                    type="radio"
                    name="survivorSelection"
                    checked={!isSurvivorA}
                    onChange={() => handleSwitchSurvivor(recordB.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="font-semibold text-slate-900 text-base">{recordB.company_name}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>ID: {recordB.id}</span>
                  <span>•</span>
                  <span>Created: {new Date(recordB.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-3 text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg">
                  <div>Contact: {recordB.contact_person || '—'}</div>
                  <div>Phone: {recordB.phone || '—'}</div>
                  <div>Email: {recordB.email || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Field-by-field Resolution Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Step 2: Choose Winning Field Values
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select which value to retain on the surviving master record
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const allA: Record<string, 'A' | 'B'> = {};
                    Object.keys(fieldPicks).forEach((k) => (allA[k] = 'A'));
                    setFieldPicks(allA);
                  }}
                  className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md font-medium transition"
                >
                  Pick All Record A
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const allB: Record<string, 'A' | 'B'> = {};
                    Object.keys(fieldPicks).forEach((k) => (allB[k] = 'B'));
                    setFieldPicks(allB);
                  }}
                  className="px-2.5 py-1 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-md font-medium transition"
                >
                  Pick All Record B
                </button>
              </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-3 py-2 px-3 bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Field</div>
              <div className="col-span-4">Record A Value</div>
              <div className="col-span-4">Record B Value</div>
              <div className="col-span-1 text-center">Winner</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {renderFieldRow('Company Name', 'company_name', <Building2 className="w-3.5 h-3.5" />)}
              {renderFieldRow('Contact Person', 'contact_person', <User className="w-3.5 h-3.5" />)}
              {renderFieldRow('Phone', 'phone', <Phone className="w-3.5 h-3.5" />)}
              {renderFieldRow('WhatsApp', 'whatsapp', <MessageSquare className="w-3.5 h-3.5" />)}
              {renderFieldRow('Email', 'email', <Mail className="w-3.5 h-3.5" />)}
              {renderFieldRow('Location', 'location', <MapPin className="w-3.5 h-3.5" />)}
              {entityType === 'Lead' ? (
                <>
                  {renderFieldRow('Lead Type', 'lead_type', <Tag className="w-3.5 h-3.5" />)}
                  {renderFieldRow('Source', 'source', <Sparkles className="w-3.5 h-3.5" />)}
                  {renderFieldRow('Priority', 'priority', <Sparkles className="w-3.5 h-3.5" />)}
                  {renderFieldRow('Stage / Status', 'status', <Sparkles className="w-3.5 h-3.5" />)}
                  {renderFieldRow(
                    'Estimated Value',
                    'estimated_value',
                    <DollarSign className="w-3.5 h-3.5" />,
                    (v) => (v ? `SAR ${Number(v).toLocaleString()}` : null)
                  )}
                  {renderFieldRow(
                    'Closing Date',
                    'expected_closing_date',
                    <Calendar className="w-3.5 h-3.5" />
                  )}
                </>
              ) : (
                <>
                  {renderFieldRow('Client Type', 'client_type', <Tag className="w-3.5 h-3.5" />)}
                  {renderFieldRow('Status', 'status', <Sparkles className="w-3.5 h-3.5" />)}
                </>
              )}
            </div>
          </div>

          {/* Sub-Items & Reconciliations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notes Handling */}
            <div className="rounded-xl border border-slate-200 p-4 bg-white">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Notes Consolidation
              </h4>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notesMode"
                    value="combine"
                    checked={notesMode === 'combine'}
                    onChange={() => setNotesMode('combine')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <strong>Combine chronologically</strong> (Appends notes with merge attribution)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notesMode"
                    value="survivor_only"
                    checked={notesMode === 'survivor_only'}
                    onChange={() => setNotesMode('survivor_only')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Keep winning record notes only</span>
                </label>
              </div>
            </div>

            {/* Tags Handling */}
            <div className="rounded-xl border border-slate-200 p-4 bg-white">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Tags Consolidation
              </h4>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tagsMode"
                    value="combine"
                    checked={tagsMode === 'combine'}
                    onChange={() => setTagsMode('combine')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <strong>Combine all unique tags</strong> from both records
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tagsMode"
                    value="survivor_only"
                    checked={tagsMode === 'survivor_only'}
                    onChange={() => setTagsMode('survivor_only')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Keep winning record tags only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Assigned Owner & Custom Merge Note */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Final Assigned Owner
              </label>
              <select
                id="surviving-owner-select"
                value={survivingOwnerId}
                onChange={(e) => setSurvivingOwnerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Merge Audit Note (Optional)
              </label>
              <input
                id="merge-audit-note-input"
                type="text"
                value={customMergeNote}
                onChange={(e) => setCustomMergeNote(e.target.value)}
                placeholder="e.g., Branch phone duplicate consolidated"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Safe Merge Preservation Notice */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-950 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-indigo-900">
                Zero Data Loss Guaranteed
              </div>
              <p className="text-indigo-800">
                All timeline activities, scheduled follow-ups, and uploaded attachments from duplicate record <strong>{mergedRecord.company_name}</strong> will be safely migrated and linked to surviving master record <strong>{survivingRecord.company_name}</strong>. The duplicate record will be archived as <em>merged</em> with an immutable audit entry.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
          <div>
            <button
              id="dismiss-duplicate-btn"
              type="button"
              onClick={handleDismissDuplicate}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline transition"
            >
              Not a duplicate? Dismiss pair
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="cancel-merge-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              id="confirm-merge-btn"
              type="button"
              onClick={handleExecuteMerge}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-98 transition disabled:opacity-50"
            >
              <GitMerge className="w-4 h-4" />
              <span>{isSubmitting ? 'Merging Records...' : 'Execute Safe Merge'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
