import React, { useState, useEffect } from 'react';
import {
  Tag as TagIcon,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  ShieldCheck,
  Users,
  Building2,
} from 'lucide-react';
import { TagRecord, TagType } from '../types/database';
import {
  getLocalTags,
  subscribeToTags,
  createTag,
  updateTag,
  toggleTagActive,
  deleteTag,
  getTagUsageCounts,
} from '../lib/dal';
import { TagBadge } from './TagBadge';

const COLOR_OPTIONS = [
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-100 text-indigo-800' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-100 text-emerald-800' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-100 text-purple-800' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-100 text-rose-800' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-100 text-cyan-800' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-100 text-amber-800' },
  { id: 'slate', name: 'Slate', bg: 'bg-slate-200 text-slate-800' },
];

export const TagManagementSection: React.FC = () => {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [usageCounts, setUsageCounts] = useState<
    Record<string, { leads: number; clients: number; total: number }>
  >({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagRecord | null>(null);

  // Form states
  const [tagName, setTagName] = useState('');
  const [tagDesc, setTagDesc] = useState('');
  const [tagType, setTagType] = useState<TagType>('Both');
  const [tagColor, setTagColor] = useState('indigo');
  const [tagActive, setTagActive] = useState(true);

  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Blocked deletion modal state
  const [blockedDeleteTag, setBlockedDeleteTag] = useState<{
    name: string;
    leads: number;
    clients: number;
  } | null>(null);

  const refreshData = () => {
    const all = getLocalTags();
    setTags(all);
    setUsageCounts(getTagUsageCounts());
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeToTags(() => {
      refreshData();
    });

    const handleDataChange = () => {
      setUsageCounts(getTagUsageCounts());
    };
    window.addEventListener('crm_leads_changed', handleDataChange);
    window.addEventListener('crm_clients_changed', handleDataChange);

    return () => {
      unsub();
      window.removeEventListener('crm_leads_changed', handleDataChange);
      window.removeEventListener('crm_clients_changed', handleDataChange);
    };
  }, []);

  const handleOpenCreate = () => {
    setEditingTag(null);
    setTagName('');
    setTagDesc('');
    setTagType('Both');
    setTagColor('indigo');
    setTagActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tag: TagRecord) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagDesc(tag.description || '');
    setTagType(tag.type);
    setTagColor(tag.color || 'indigo');
    setTagActive(tag.is_active);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      setFormError('Tag name is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingTag) {
        await updateTag(editingTag.id, {
          name: tagName.trim(),
          description: tagDesc.trim(),
          type: tagType,
          color: tagColor,
          is_active: tagActive,
        });
        setFeedback({
          type: 'success',
          message: `Tag "${tagName.trim()}" updated successfully.`,
        });
      } else {
        await createTag({
          name: tagName.trim(),
          description: tagDesc.trim(),
          type: tagType,
          color: tagColor,
          is_active: tagActive,
        });
        setFeedback({
          type: 'success',
          message: `New tag "${tagName.trim()}" created successfully.`,
        });
      }
      setIsModalOpen(false);
      refreshData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save tag.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (tag: TagRecord) => {
    const nextStatus = !tag.is_active;
    try {
      await toggleTagActive(tag.id, nextStatus);
      setFeedback({
        type: 'success',
        message: `Tag "${tag.name}" is now ${nextStatus ? 'active' : 'deactivated'}.`,
      });
      refreshData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to update tag status.',
      });
    }
  };

  const handleDelete = async (tag: TagRecord) => {
    const usage = usageCounts[tag.name] || { leads: 0, clients: 0, total: 0 };
    if (usage.total > 0) {
      setBlockedDeleteTag({
        name: tag.name,
        leads: usage.leads,
        clients: usage.clients,
      });
      return;
    }

    if (confirm(`Are you sure you want to delete unused tag "${tag.name}"?`)) {
      try {
        await deleteTag(tag.id);
        setFeedback({
          type: 'success',
          message: `Unused tag "${tag.name}" deleted.`,
        });
        refreshData();
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: err?.message || 'Failed to delete tag.',
        });
      }
    }
  };

  const activeCount = tags.filter((t) => t.is_active).length;
  const inactiveCount = tags.length - activeCount;
  const totalAssignments = (
    Object.values(usageCounts) as { leads: number; clients: number; total: number }[]
  ).reduce((acc, curr) => acc + (curr?.total || 0), 0);

  return (
    <div id="tag-management-card" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <TagIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              CRM Tag Taxonomy &amp; Segmentation (Admin Only)
            </h3>
            <p className="text-xs text-slate-500">
              Configure global tags, enforce uniqueness, monitor usage counts, and manage lifecycle.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-create-crm-tag"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Tag
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[11px] font-medium text-slate-500 block">Total Tags</span>
          <span className="text-lg font-bold text-slate-900">{tags.length}</span>
        </div>
        <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
          <span className="text-[11px] font-medium text-emerald-700 block">Active Tags</span>
          <span className="text-lg font-bold text-emerald-800">{activeCount}</span>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[11px] font-medium text-slate-500 block">Deactivated</span>
          <span className="text-lg font-bold text-slate-600">{inactiveCount}</span>
        </div>
        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
          <span className="text-[11px] font-medium text-indigo-700 block">Total Assignments</span>
          <span className="text-lg font-bold text-indigo-900">{totalAssignments}</span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tags Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Tag Name &amp; Color</th>
              <th className="py-2.5 px-4 font-semibold">Description</th>
              <th className="py-2.5 px-3 font-semibold">Applicable Type</th>
              <th className="py-2.5 px-4 font-semibold text-center">Portfolio Usage</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              <th className="py-2.5 px-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tags.map((tag) => {
              const usage = usageCounts[tag.name] || { leads: 0, clients: 0, total: 0 };
              return (
                <tr
                  key={tag.id}
                  id={`tag-row-${tag.id}`}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <TagBadge name={tag.name} color={tag.color} isActive={tag.is_active} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-600 text-xs truncate max-w-xs block">
                      {tag.description || <span className="text-slate-400 italic">—</span>}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        tag.type === 'Both'
                          ? 'bg-indigo-50 text-indigo-700'
                          : tag.type === 'Lead'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {tag.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <span
                        className="text-blue-700 font-semibold"
                        title={`${usage.leads} Leads assigned`}
                      >
                        {usage.leads}L
                      </span>
                      <span className="text-slate-300">/</span>
                      <span
                        className="text-emerald-700 font-semibold"
                        title={`${usage.clients} Clients assigned`}
                      >
                        {usage.clients}C
                      </span>
                      <span className="text-[11px] text-slate-400">({usage.total} total)</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      id={`btn-toggle-tag-active-${tag.id}`}
                      onClick={() => handleToggleStatus(tag)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        tag.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {tag.is_active ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          <span>Deactivated</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        id={`btn-edit-tag-${tag.id}`}
                        onClick={() => handleOpenEdit(tag)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                        title="Edit tag"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        id={`btn-delete-tag-${tag.id}`}
                        onClick={() => handleDelete(tag)}
                        className={`p-1 rounded ${
                          usage.total > 0
                            ? 'text-slate-300 hover:text-amber-600'
                            : 'text-slate-400 hover:text-rose-600'
                        }`}
                        title={
                          usage.total > 0
                            ? `Cannot delete (assigned to ${usage.total} records)`
                            : 'Delete unused tag'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
        <span>
          Tags can only be configured by Administrators. Tag modifications and deletions are tracked in immutable Audit Logs.
        </span>
      </div>

      {/* Create / Edit Tag Modal */}
      {isModalOpen && (
        <div
          id="tag-form-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            id="tag-form-modal-panel"
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <TagIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">
                      {editingTag ? 'Edit Tag Definition' : 'Create New CRM Tag'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Standardize segmentation tags across Leads and Clients
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tag Name * (Must be unique)
                  </label>
                  <input
                    type="text"
                    id="input-create-tag-name"
                    required
                    placeholder="e.g. VIP Client, Glass Project, Hot Prospect"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="input-create-tag-desc"
                    rows={2}
                    placeholder="Guidelines on when sales reps should assign this tag..."
                    value={tagDesc}
                    onChange={(e) => setTagDesc(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Applicable Entity Type
                    </label>
                    <select
                      id="select-tag-type"
                      value={tagType}
                      onChange={(e) => setTagType(e.target.value as TagType)}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-700"
                    >
                      <option value="Both">Both (Leads &amp; Clients)</option>
                      <option value="Lead">Leads Only</option>
                      <option value="Client">Clients Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Initial Status
                    </label>
                    <select
                      id="select-tag-active"
                      value={tagActive ? 'active' : 'inactive'}
                      onChange={(e) => setTagActive(e.target.value === 'active')}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-700"
                    >
                      <option value="active">Active (Reps can apply)</option>
                      <option value="inactive">Deactivated</option>
                    </select>
                  </div>
                </div>

                {/* Color Scheme Picker */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Color Accent
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setTagColor(c.id)}
                        className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-all ${
                          c.bg
                        } ${
                          tagColor === c.id
                            ? 'ring-2 ring-indigo-500 ring-offset-1 border-indigo-400'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <span className="text-slate-500 block mb-1">Preview:</span>
                  <TagBadge
                    name={tagName.trim() || 'Sample Tag'}
                    color={tagColor}
                    type={tagType}
                    isActive={tagActive}
                  />
                </div>

                {formError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                    {formError}
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-tag-form"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingTag ? 'Save Changes' : 'Create Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blocked Deletion Explanation Modal */}
      {blockedDeleteTag && (
        <div
          id="blocked-deletion-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setBlockedDeleteTag(null)}
        >
          <div
            id="blocked-deletion-modal-panel"
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Tag Deletion Blocked</h3>
              <p className="text-xs text-slate-600 mt-1">
                The tag <span className="font-semibold text-slate-800">"{blockedDeleteTag.name}"</span> is currently assigned to{' '}
                <span className="font-semibold text-slate-900">{blockedDeleteTag.leads} Lead(s)</span> and{' '}
                <span className="font-semibold text-slate-900">{blockedDeleteTag.clients} Client(s)</span>.
              </p>
              <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800 text-left">
                <strong>Recommended action:</strong> Deactivate the tag instead of deleting it. Deactivated tags cannot be newly assigned by salesmen, but preserve all historical customer associations and reporting cohorts safely.
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                id="btn-close-blocked-modal"
                onClick={() => setBlockedDeleteTag(null)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
