import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, Check, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { TagRecord } from '../types/database';
import { getLocalTags, bulkAddTag, bulkRemoveTag } from '../lib/dal';
import { TagBadge } from './TagBadge';

export interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'lead' | 'client';
  selectedIds: string[];
  onComplete?: () => void;
}

export const BulkTagModal: React.FC<BulkTagModalProps> = ({
  isOpen,
  onClose,
  entityType,
  selectedIds,
  onComplete,
}) => {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ successCount: number; failedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const all = getLocalTags();
      const relevant = all.filter(
        (t) => t.is_active && (t.type === 'Both' || t.type.toLowerCase() === entityType.toLowerCase())
      );
      setTags(relevant);
      if (relevant.length > 0) {
        setSelectedTag(relevant[0].name);
      }
      setResult(null);
      setError(null);
    }
  }, [isOpen, entityType]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (!selectedTag) {
      setError('Please choose a tag to proceed.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      let res;
      if (mode === 'add') {
        res = await bulkAddTag(entityType, selectedIds, selectedTag);
      } else {
        res = await bulkRemoveTag(entityType, selectedIds, selectedTag);
      }
      setResult(res);
      if (onComplete) onComplete();
    } catch (err: any) {
      setError(err?.message || 'Bulk operation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="bulk-tag-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="bulk-tag-modal-panel"
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TagIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Bulk Tag {entityType === 'lead' ? 'Leads' : 'Clients'}
              </h3>
              <p className="text-xs text-slate-500">
                Apply or remove tags across {selectedIds.length} selected record(s)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-slate-800">Bulk Operation Completed</h4>
              <p className="text-xs text-slate-600">
                Successfully updated <span className="font-semibold text-emerald-700">{result.successCount}</span> record(s).
                {result.failedCount > 0 && (
                  <span className="text-amber-700 block mt-1">
                    ({result.failedCount} records skipped due to ownership permissions)
                  </span>
                )}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-bulk-tag-done"
                  onClick={onClose}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Close Window
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Operation Mode Tabs */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                  Action Type
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    id="btn-mode-add"
                    onClick={() => setMode('add')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                      mode === 'add'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    + Add Tag
                  </button>
                  <button
                    type="button"
                    id="btn-mode-remove"
                    onClick={() => setMode('remove')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                      mode === 'remove'
                        ? 'bg-white text-rose-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    − Remove Tag
                  </button>
                </div>
              </div>

              {/* Tag Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                  Select CRM Tag
                </label>
                {tags.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No active tags available for this entity type.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {tags.map((tag) => (
                      <div
                        key={tag.id}
                        onClick={() => setSelectedTag(tag.name)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          selectedTag === tag.name
                            ? 'border-indigo-400 bg-indigo-50/60'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <TagBadge name={tag.name} color={tag.color} />
                          {tag.description && (
                            <span className="text-xs text-slate-500 truncate max-w-[200px]">
                              {tag.description}
                            </span>
                          )}
                        </div>
                        {selectedTag === tag.name && <Check className="w-4 h-4 text-indigo-600" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmation details */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  This will {mode === 'add' ? 'attach' : 'remove'} tag{' '}
                  <span className="font-semibold text-slate-800">"{selectedTag}"</span> on all{' '}
                  <span className="font-semibold text-slate-800">{selectedIds.length}</span> selected{' '}
                  {entityType === 'lead' ? 'leads' : 'clients'} you are authorized to manage.
                </div>
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-bulk-tag"
                  disabled={isProcessing || !selectedTag}
                  onClick={handleExecute}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${
                    mode === 'add'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  } disabled:opacity-50`}
                >
                  {isProcessing
                    ? 'Processing...'
                    : mode === 'add'
                    ? `Apply to ${selectedIds.length} Records`
                    : `Remove from ${selectedIds.length} Records`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
