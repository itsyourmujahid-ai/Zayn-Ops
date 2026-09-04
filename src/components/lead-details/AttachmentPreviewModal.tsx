import React, { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Trash2,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  Clock,
  User,
  HardDrive,
  Tag,
  AlertTriangle,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { AttachmentRecord } from '../../types/database';
import { formatFileSize } from '../../lib/dal';

interface AttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: AttachmentRecord | null;
  canDelete: boolean;
  onDelete: (attachment: AttachmentRecord) => Promise<void>;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  isOpen,
  onClose,
  attachment,
  canDelete,
  onDelete,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!isOpen || !attachment) return null;

  const isImage =
    attachment.file_type?.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(attachment.file_name);

  const isPdf =
    attachment.file_type?.includes('pdf') ||
    /\.pdf$/i.test(attachment.file_name);

  const isSpreadsheet =
    attachment.file_type?.includes('spreadsheet') ||
    attachment.file_type?.includes('excel') ||
    /\.(xls|xlsx|csv)$/i.test(attachment.file_name);

  const isCad = /\.(dwg|dxf|cad)$/i.test(attachment.file_name);

  const handleDownload = () => {
    if (!attachment.download_url) return;
    const link = document.createElement('a');
    link.href = attachment.download_url;
    link.download = attachment.file_name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(attachment);
      setShowConfirmDelete(false);
      onClose();
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setIsDeleting(false);
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Recently';
    }
  };

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'Quotation':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Drawing':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'BOQ':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Contract':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Image':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Specification':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-5xl h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3.5 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-xs">
              {isImage ? (
                <ImageIcon className="h-5 w-5 text-emerald-600" />
              ) : isPdf ? (
                <FileText className="h-5 w-5 text-rose-600" />
              ) : isSpreadsheet ? (
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              ) : isCad ? (
                <FileCode className="h-5 w-5 text-purple-600" />
              ) : (
                <File className="h-5 w-5 text-indigo-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-md" title={attachment.file_name}>
                  {attachment.file_name}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${getCategoryBadgeClass(
                    attachment.category
                  )}`}
                >
                  {attachment.category || 'Document'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
                <span>{formatFileSize(attachment.file_size)}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 text-slate-400" />
                  {attachment.uploaded_by_name || 'Team Member'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  {formatTimestamp(attachment.uploaded_at || attachment.created_at)}
                </span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isImage && (
              <div className="hidden sm:flex items-center bg-slate-200/70 rounded-lg p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="rounded p-1 text-slate-700 hover:bg-white transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-semibold text-slate-700 px-1">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="rounded p-1 text-slate-700 hover:bg-white transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="rounded p-1 text-slate-700 hover:bg-white transition cursor-pointer"
                  title="Rotate 90°"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            )}

            {attachment.download_url && (
              <a
                href={attachment.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
                title="Open in new window"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open URL</span>
              </a>
            )}

            {attachment.download_url && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                title="Download original file"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                title="Delete document"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Confirmation Modal Overlay */}
        {showConfirmDelete && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mx-auto">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h4 className="text-base font-bold text-slate-900">Confirm File Deletion</h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-900">{attachment.file_name}</strong>?
                  This action will permanently delete the file from cloud storage and record the deletion in the lead timeline.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
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
                      <span>Yes, Delete Document</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Viewport */}
        <div className="relative flex-1 bg-slate-900 flex items-center justify-center overflow-auto p-4">
          {isImage ? (
            <div className="flex items-center justify-center min-h-full min-w-full">
              {attachment.download_url ? (
                <img
                  src={attachment.download_url}
                  alt={attachment.file_name}
                  referrerPolicy="no-referrer"
                  className="max-h-[72vh] max-w-full object-contain transition-transform duration-200 rounded-lg shadow-lg"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                />
              ) : (
                <div className="text-center text-white p-8">
                  <ImageIcon className="h-12 w-12 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold">Image Preview Unavailable</p>
                </div>
              )}
            </div>
          ) : isPdf ? (
            <div className="w-full h-full rounded-lg overflow-hidden bg-white shadow-inner flex flex-col">
              {attachment.download_url ? (
                <iframe
                  src={attachment.download_url}
                  title={attachment.file_name}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-700">
                  <FileText className="h-16 w-16 text-rose-500 mb-3" />
                  <h4 className="text-base font-bold text-slate-900">{attachment.file_name}</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    PDF document ready for direct access or download.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center shadow-2xl border border-slate-200">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-xs">
                {isSpreadsheet ? (
                  <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                ) : isCad ? (
                  <FileCode className="h-8 w-8 text-purple-600" />
                ) : (
                  <File className="h-8 w-8 text-indigo-600" />
                )}
              </div>
              <h4 className="text-base font-bold text-slate-900">{attachment.file_name}</h4>
              <span
                className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${getCategoryBadgeClass(
                  attachment.category
                )}`}
              >
                {attachment.category || 'Document'}
              </span>

              <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left text-xs space-y-2 border border-slate-100">
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">File Size:</span>
                  <span className="font-semibold text-slate-900">{formatFileSize(attachment.file_size)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">File Type:</span>
                  <span className="font-semibold text-slate-900">{attachment.file_type || 'Document'}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Uploaded By:</span>
                  <span className="font-semibold text-slate-900">{attachment.uploaded_by_name || 'User'}</span>
                </div>
                {attachment.description && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="font-medium text-slate-600">Notes:</span>
                    <p className="text-slate-800 mt-0.5 text-xs font-normal whitespace-pre-line">
                      {attachment.description}
                    </p>
                  </div>
                )}
              </div>

              {attachment.download_url && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download {attachment.file_name}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        {attachment.description && (
          <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Tag className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <strong className="text-slate-800 font-semibold">Notes: </strong>
              <span>{attachment.description}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
