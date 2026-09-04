import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { AttachmentCategory } from '../../types/database';
import { validateAttachmentFile, formatFileSize } from '../../lib/dal';

interface UploadAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  companyName: string;
  onUpload: (file: File, category: AttachmentCategory, description: string, onProgress: (p: number) => void) => Promise<void>;
}

const CATEGORIES: { id: AttachmentCategory; label: string; desc: string }[] = [
  { id: 'Quotation', label: 'Quotation', desc: 'Price proposals & bids' },
  { id: 'Drawing', label: 'Drawing', desc: 'CAD, architectural & layout plans' },
  { id: 'BOQ', label: 'BOQ / Estimate', desc: 'Bill of quantities & spreadsheets' },
  { id: 'Project Document', label: 'Project Document', desc: 'Specs, briefs & site notes' },
  { id: 'Contract', label: 'Contract / Agreement', desc: 'Signed contracts & legal docs' },
  { id: 'Specification', label: 'Specification', desc: 'Technical data sheets & guides' },
  { id: 'Image', label: 'Site Photo / Image', desc: 'Site pictures & mockups' },
  { id: 'Other', label: 'Other File', desc: 'General attachments' },
];

export const UploadAttachmentModal: React.FC<UploadAttachmentModalProps> = ({
  isOpen,
  onClose,
  leadId,
  companyName,
  onUpload,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<AttachmentCategory>('Project Document');
  const [description, setDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectFile(e.target.files[0]);
    }
  };

  const selectFile = (selectedFile: File) => {
    setErrorMessage(null);
    const validation = validateAttachmentFile(selectedFile);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file.');
      setFile(null);
      return;
    }

    setFile(selectedFile);

    // Smart category auto-detection from file extension
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';
    if (['dwg', 'dxf', 'cad', 'svg', 'ai', 'psd'].includes(ext)) {
      setCategory('Drawing');
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
      setCategory('BOQ');
    } else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) {
      setCategory('Image');
    } else if (selectedFile.name.toLowerCase().includes('quote') || selectedFile.name.toLowerCase().includes('quotation')) {
      setCategory('Quotation');
    } else if (selectedFile.name.toLowerCase().includes('contract') || selectedFile.name.toLowerCase().includes('agreement')) {
      setCategory('Contract');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setErrorMessage(null);

    try {
      await onUpload(file, category, description.trim(), (p) => setProgress(p));
      handleClose();
    } catch (err: any) {
      console.error('Failed to upload file:', err);
      setErrorMessage(err.message || 'Failed to upload attachment. Please try again.');
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setFile(null);
    setCategory('Project Document');
    setDescription('');
    setProgress(0);
    setErrorMessage(null);
    onClose();
  };

  const getFileIcon = (fileName: string, mimeType: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
      return <ImageIcon className="h-6 w-6 text-emerald-600" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '') || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="h-6 w-6 text-emerald-600" />;
    }
    if (['dwg', 'dxf', 'cad'].includes(ext || '')) {
      return <FileCode className="h-6 w-6 text-purple-600" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '') || mimeType.includes('pdf') || mimeType.includes('word')) {
      return <FileText className="h-6 w-6 text-indigo-600" />;
    }
    return <File className="h-6 w-6 text-slate-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-indigo-600" />
              <span>Attach File to Lead</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Target Lead: <strong className="text-slate-800 font-semibold">{companyName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <span className="font-semibold">Upload Error: </span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Drag & Drop Zone */}
          {!file ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
                dragActive
                  ? 'border-indigo-600 bg-indigo-50/60 scale-[0.99]'
                  : 'border-slate-300 bg-slate-50/50 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInput}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.gif,.dwg,.dxf,.zip,.rar"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3 shadow-xs">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">
                Click to browse or drag & drop file
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PDF, Quotations, Drawings (DWG), BOQ (Excel), Word, or Images
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
                <span>Max size: 30 MB • Executable files strictly blocked</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-xs">
                  {getFileIcon(file.name, file.type)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatFileSize(file.size)} • {file.type || 'Binary file'}
                  </p>
                </div>
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Document Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AttachmentCategory)}
              disabled={uploading}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.desc})
                </option>
              ))}
            </select>
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Document Notes / Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              placeholder="e.g. Revised Quotation with 5% discount, Approved CAD architectural floor plan..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 resize-none"
            />
          </div>

          {/* Live Upload Progress */}
          {uploading && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  <span>Uploading securely to cloud storage...</span>
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full bg-indigo-600 transition-all duration-200 rounded-full"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading {progress}%</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
