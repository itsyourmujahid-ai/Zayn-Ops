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
import { UploadAttachmentModal } from '../lead-details/UploadAttachmentModal';
import { AttachmentPreviewModal } from '../lead-details/AttachmentPreviewModal';

interface ClientAttachmentsSectionProps {
  clientId: string;
  companyName: string;
  attachments: AttachmentRecord[];
  loading?: boolean;
  canUpload: boolean;
  canDelete: boolean;
  onUpload: (
    file: File,
    category: AttachmentCategory,
    description: string,
    onProgress: (p: number) => void
  ) => Promise<void>;
  onDelete: (attachment: AttachmentRecord) => Promise<void>;
}

export const ClientAttachmentsSection: React.FC<ClientAttachmentsSectionProps> = ({
  clientId,
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

  const totalSizeBytes = useMemo(() => {
    return attachments.reduce((acc, curr) => acc + (curr.file_size || 0), 0);
  }, [attachments]);

  const categories = useMemo(() => {
    const list: { id: string; label: string; count: number }[] = [
      { id: 'ALL', label: 'All Files', count: attachments.length },
      { id: 'Project Document', label: 'Client / Project Docs', count: attachments.filter((a) => a.category === 'Project Document').length },
      { id: 'Contract', label: 'Contracts & Agreements', count: attachments.filter((a) => a.category === 'Contract').length },
      { id: 'Drawing', label: 'Drawings & CAD', count: attachments.filter((a) => a.category === 'Drawing').length },
      { id: 'Quotation', label: 'Quotations', count: attachments.filter((a) => a.category === 'Quotation').length },
      { id: 'BOQ', label: 'BOQ & Estimates', count: attachments.filter((a) => a.category === 'BOQ').length },
      { id: 'Image', label: 'Site Photos & Images', count: attachments.filter((a) => a.category === 'Image').length },
      { id: 'Other', label: 'Other', count: attachments.filter((a) => a.category === 'Other').length },
    ];
    return list.filter((c) => c.id === 'ALL' || c.count > 0);
  }, [attachments]);

  const filteredAttachments = useMemo(() => {
    return attachments.filter((att) => {
      const matchesSearch =
        searchQuery === '' ||
        att.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (att.uploaded_by_name && att.uploaded_by_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (att.description && att.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'ALL' || att.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [attachments, searchQuery, selectedCategory]);

  const getFileIcon = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
      return <ImageIcon className="h-5 w-5 text-emerald-600" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '') || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
      return <FileSpreadsheet className="h-5 w-5 text-teal-600" />;
    }
    if (['dwg', 'dxf', 'cad'].includes(ext || '')) {
      return <FileCode className="h-5 w-5 text-indigo-600" />;
    }
    if (ext === 'pdf' || mimeType?.includes('pdf')) {
      return <FileText className="h-5 w-5 text-rose-600" />;
    }
    if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '') || mimeType?.includes('word')) {
      return <FileText className="h-5 w-5 text-blue-600" />;
    }
    return <File className="h-5 w-5 text-slate-500" />;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  const handleDownload = (att: AttachmentRecord) => {
    if (att.download_url) {
      window.open(att.download_url, '_blank');
    }
  };

  const confirmDelete = async () => {
    if (!attachmentToDelete) return;
    try {
      setIsDeleting(true);
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
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{cat.label}</span>
              <span className="ml-1.5 opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>

        {/* View Toggle & Upload Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-slate-500">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-md p-1.5 cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {canUpload && (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="zaynops-btn-primary py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Files Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center">
          <Loader2 className="h-6 w-6 text-emerald-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading files...</p>
        </div>
      ) : filteredAttachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
            <Paperclip className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No documents uploaded</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            Upload contracts, drawings, BOQs, or project specifications related to this client.
          </p>
          {canUpload && (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="zaynops-btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAttachments.map((att) => (
            <div
              key={att.id}
              className="group relative rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-slate-300 hover:shadow-xs transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                    {getFileIcon(att.file_name, att.file_type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate" title={att.file_name}>
                      {att.file_name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {formatFileSize(att.file_size)} · {formatDate(att.uploaded_at || att.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {att.category && (
                <div className="mt-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                    {att.category}
                  </span>
                </div>
              )}

              {att.description && (
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  {att.description}
                </p>
              )}

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="truncate max-w-[120px] text-[11px]">
                  {att.uploaded_by_name || 'Team Member'}
                </span>
                <div className="flex items-center gap-1">
                  {att.download_url && (
                    <button
                      type="button"
                      onClick={() => handleDownload(att)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setAttachmentToDelete(att)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Uploaded By</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredAttachments.map((att) => (
                <tr key={att.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      {getFileIcon(att.file_name, att.file_type)}
                      <span className="font-bold text-slate-900 truncate max-w-xs" title={att.file_name}>
                        {att.file_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                      {att.category || 'Document'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{formatFileSize(att.file_size)}</td>
                  <td className="py-3 px-4 text-slate-600">{att.uploaded_by_name || 'Team Member'}</td>
                  <td className="py-3 px-4 text-slate-600">{formatDate(att.uploaded_at || att.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {att.download_url && (
                        <button
                          type="button"
                          onClick={() => handleDownload(att)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setAttachmentToDelete(att)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
      )}

      {/* Upload Modal */}
      <UploadAttachmentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        leadId={clientId}
        companyName={companyName}
        onUploadComplete={onUpload}
      />

      {/* Delete Confirmation Modal */}
      {attachmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-base font-bold text-slate-900">Delete Document</h4>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Are you sure you want to delete{' '}
              <span className="font-bold text-slate-800">{attachmentToDelete.file_name}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAttachmentToDelete(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
