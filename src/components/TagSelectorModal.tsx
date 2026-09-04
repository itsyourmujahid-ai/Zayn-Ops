import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, Search, Check, Plus, X, AlertCircle } from 'lucide-react';
import { TagRecord } from '../types/database';
import { getLocalTags, subscribeToTags } from '../lib/dal';
import { TagBadge } from './TagBadge';

export interface TagSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'Lead' | 'Client';
  currentTags: string[];
  onSelectTag: (tagName: string) => Promise<void> | void;
  onRemoveTag?: (tagName: string) => Promise<void> | void;
  isAdmin?: boolean;
  onOpenTagManagement?: () => void;
  title?: string;
}

export const TagSelectorModal: React.FC<TagSelectorModalProps> = ({
  isOpen,
  onClose,
  entityType,
  currentTags = [],
  onSelectTag,
  onRemoveTag,
  isAdmin = false,
  onOpenTagManagement,
  title = 'Manage Tags',
}) => {
  const [allTags, setAllTags] = useState<TagRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAllTags(getLocalTags());
    const unsub = subscribeToTags((tags) => {
      setAllTags(tags);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter available tags: must be active, and matching type (Lead/Client/Both)
  const availableTags = allTags.filter((tag) => {
    if (!tag.is_active) return false;
    if (tag.type !== 'Both' && tag.type !== entityType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        tag.name.toLowerCase().includes(q) ||
        (tag.description && tag.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleToggleTag = async (tagName: string) => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const isAssigned = currentTags.includes(tagName);
      if (isAssigned && onRemoveTag) {
        await onRemoveTag(tagName);
      } else if (!isAssigned) {
        await onSelectTag(tagName);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update tag.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="tag-selector-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="tag-selector-modal-panel"
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TagIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">{title}</h3>
              <p className="text-xs text-slate-500">
                Apply standardized CRM tags for {entityType} segmentation
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Current Assigned Tags */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
              Currently Assigned ({currentTags.length})
            </label>
            {currentTags.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No tags assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto py-1">
                {currentTags.map((tagName) => {
                  const tagDef = allTags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
                  return (
                    <TagBadge
                      key={tagName}
                      name={tagName}
                      color={tagDef?.color}
                      onRemove={
                        onRemoveTag
                          ? () => {
                              handleToggleTag(tagName);
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-tag-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search active ${entityType.toLowerCase()} tags...`}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Available Tags List */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
              Available Active Tags
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {availableTags.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <p>No matching active tags found.</p>
                  {isAdmin && onOpenTagManagement && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTagManagement();
                      }}
                      className="mt-2 text-indigo-600 font-medium hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create new tag in Settings
                    </button>
                  )}
                </div>
              ) : (
                availableTags.map((tag) => {
                  const isAssigned = currentTags.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      id={`btn-tag-item-${tag.id}`}
                      disabled={loading}
                      onClick={() => handleToggleTag(tag.name)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                        isAssigned
                          ? 'border-indigo-200 bg-indigo-50/50'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TagBadge name={tag.name} color={tag.color} />
                        {tag.description && (
                          <span className="text-xs text-slate-500 truncate max-w-[180px]">
                            {tag.description}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 ml-2">
                        {isAssigned ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                            <Check className="w-3.5 h-3.5" /> Added
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600">
                            <Plus className="w-3.5 h-3.5" /> Apply
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {isAdmin && onOpenTagManagement ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTagManagement();
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Configure Tag Taxonomy →
            </button>
          ) : (
            <span>Tags managed by system admin</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
