import React, { useState, useMemo } from 'react';
import {
  Paperclip,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  LayoutGrid,
  List,
  Clock,
  User,
  ExternalLink,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { AttachmentRecord, AttachmentCategory } from '../../types/database';
import { formatFileSize } from '../../lib/dal';
import { UploadAttachmentModal } from './UploadAttachmentModal';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';

interface AttachmentsSectionProps {
  leadId: string;
  companyName: string;
  attachments: AttachmentRecord[];
  loading?: boolean;
  canUpload: boolean;
  canDelete: boolean;
  onUpload: (file: File, category: AttachmentCategory, description: string, onProgress: (p: number) => void) => Promise<void>;
  onDelete: (attachment: AttachmentRecord) => Promise<void>;
}

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  leadId,
  companyName,
  attachments,
  loading = false,
  canUpload,
  canDelete,
  onUpload,
  onDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentRecord | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<AttachmentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compute total size
  const totalSizeBytes = useMemo(() => {
    return attachments.reduce((acc, curr) => acc + (curr.file_size || 0), 0);
  }, [attachments]);

  // Categories present in the lead's attachments
  const categories = useMemo(() => {
    const list: { id: string; label: string; count: number }[] = [
      { id: 'ALL', label: 'All Files', count: attachments.length },
      { id: 'Quotation', label: 'Quotations', count: attachments.filter((a) => a.category === 'Quotation').length },
      { id: 'Drawing', label: 'Drawings / CAD', count: attachments.filter((a) => a.category === 'Drawing').length },
      { id: 'BOQ', label: 'BOQ & Estimates', count: attachments.filter((a) => a.category === 'BOQ').length },
      { id: 'Project Document', label: 'Project Docs', count: attachments.filter((a) => a.category === 'Project Document').length },
      { id: 'Contract', label: 'Contracts', count: attachments.filter((a) => a.category === 'Contract').length },
      { id: 'Image', label: 'Images / Site Photos', count: attachments.filter((a) => a.category === 'Image').length },
    ];
    return list.filter((c) => c.id === 'ALL' || c.count > 0);
  }, [attachments]);

  // Filtered attachments
  const filteredAttachments = useMemo(() => {
    return attachments.filter((att) => {
      const matchesSearch =
        searchQuery === '' ||
        att.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (att.uploaded_by_name && att.uploaded_by_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (att.description && att.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'ALL' ||
        att.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [attachments, searchQuery, selectedCategory]);

  const getFileIcon = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
      return <ImageIcon className="h-5 w-5 text-emerald-600" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '') || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
    }
    if (['dwg', 'dxf', 'cad'].includes(ext || '')) {
      return <FileCode className="h-5 w-5 text-purple-600" />;
    }
    if (['pdf'].includes(ext || '') || mimeType?.includes('pdf')) {
      return <FileText className="h-5 w-5 text-rose-600" />;
    }
    if (['doc', 'docx', 'txt'].includes(ext || '') || mimeType?.includes('word')) {
      return <FileText className="h-5 w-5 text-indigo-600" />;
    }
    return <File className="h-5 w-5 text-slate-600" />;
  };

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'Quotation':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Drawing':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'BOQ':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Contract':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'Image':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'Specification':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Recently';
    }
  };

  const handleConfirmDelete = async () => {
    if (!attachmentToDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(attachmentToDelete);
      setAttachmentToDelete(null);
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action and Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Lead Attachments & Documents</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
              </span>
              {totalSizeBytes > 0 && (
                <span className="text-xs text-slate-400 font-medium">
                  ({formatFileSize(totalSizeBytes)})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure document storage for quotations, architectural drawings, BOQs, and project files.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Upload Button */}
            {canUpload && (
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Attach File</span>
              </button>
            )}
          </div>
        </div>

        {/* Search and Category Filters */}
        <div className="mt-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{c.label}</span>
                {c.count > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                      selectedCategory === c.id
                        ? 'bg-indigo-500/80 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {c.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative shrink-0 md:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file name or author..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8.5 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && attachments.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading lead attachments...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && attachments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3 shadow-xs">
            <Paperclip className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">No Documents Attached Yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Upload quotations, architectural CAD drawings, BOQ spreadsheets, and contracts directly to this lead.
          </p>
          {canUpload && (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Attach First Document</span>
            </button>
          )}
        </div>
      )}

      {/* No Results from Filter */}
      {!loading && attachments.length > 0 && filteredAttachments.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <FolderOpen className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-slate-800">No Matching Documents</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            No files matched your filter criteria or search query.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
            }}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Grid View */}
      {filteredAttachments.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredAttachments.map((att) => {
            const isImage =
              att.file_type?.startsWith('image/') ||
              /\.(jpg|jpeg|png|webp|gif)$/i.test(att.file_name);

            return (
              <div
                key={att.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
              >
                <div>
                  {/* Top row: Icon + Category Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 shadow-2xs group-hover:scale-105 transition-transform">
                      {getFileIcon(att.file_name, att.file_type)}
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryBadgeClass(
                        att.category
                      )}`}
                    >
                      {att.category || 'Document'}
                    </span>
                  </div>

                  {/* File Name & Preview Image */}
                  {isImage && att.download_url && (
                    <div
                      onClick={() => setPreviewAttachment(att)}
                      className="mb-3 h-28 w-full overflow-hidden rounded-xl bg-slate-100 border border-slate-200 cursor-pointer relative group/img"
                    >
                      <img
                        src={att.download_url}
                        alt={att.file_name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover group-hover/img:scale-105 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white">
                        <Eye className="h-5 w-5 drop-shadow-md" />
                      </div>
                    </div>
                  )}

                  <h4
                    onClick={() => setPreviewAttachment(att)}
                    className="text-xs font-bold text-slate-900 truncate hover:text-indigo-600 transition cursor-pointer"
                    title={att.file_name}
                  >
                    {att.file_name}
                  </h4>

                  {att.description && (
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed font-normal">
                      {att.description}
                    </p>
                  )}

                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{formatFileSize(att.file_size)}</span>
                    <span>•</span>
                    <span className="truncate">{att.uploaded_by_name || 'Team Member'}</span>
                  </div>
                </div>

                {/* Card Footer: Timestamp & Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {formatTimestamp(att.uploaded_at || att.created_at)}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(att)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition cursor-pointer"
                      title="Preview Document"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>

                    {att.download_url && (
                      <a
                        href={att.download_url}
                        download={att.file_name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition cursor-pointer"
                        title="Download File"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setAttachmentToDelete(att)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                        title="Delete File"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {filteredAttachments.length > 0 && viewMode === 'list' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Uploaded By</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAttachments.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50/60 transition group">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
                          {getFileIcon(att.file_name, att.file_type)}
                        </div>
                        <div className="min-w-0">
                          <p
                            onClick={() => setPreviewAttachment(att)}
                            className="font-bold text-slate-900 truncate hover:text-indigo-600 transition cursor-pointer max-w-xs"
                            title={att.file_name}
                          >
                            {att.file_name}
                          </p>
                          {att.description && (
                            <p className="text-[11px] text-slate-500 truncate max-w-xs">
                              {att.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryBadgeClass(
                          att.category
                        )}`}
                      >
                        {att.category || 'Document'}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                      {formatFileSize(att.file_size)}
                    </td>

                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{att.uploaded_by_name || 'Team Member'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {formatTimestamp(att.uploaded_at || att.created_at)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-indigo-600 transition cursor-pointer"
                          title="Preview Document"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {att.download_url && (
                          <a
                            href={att.download_url}
                            download={att.file_name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-indigo-600 transition cursor-pointer"
                            title="Download File"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setAttachmentToDelete(att)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                            title="Delete File"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {attachmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">Delete Attachment?</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Are you sure you want to permanently remove <strong className="text-slate-900">{attachmentToDelete.file_name}</strong>?
                This action cannot be undone and will be logged in the audit trail.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAttachmentToDelete(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Document</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadAttachmentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        leadId={leadId}
        companyName={companyName}
        onUpload={onUpload}
      />

      {/* Document Lightbox / Preview Modal */}
      <AttachmentPreviewModal
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
        canDelete={canDelete}
        onDelete={onDelete}
      />
    </div>
  );
};
