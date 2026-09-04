import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Info,
  Check,
  X,
  FileText,
  ChevronRight,
  Database,
  Layers,
} from 'lucide-react';
import {
  ImportType,
  ImportMode,
  DuplicateResolutionAction,
  ParsedRowResult,
  ValidationSummary,
  ImportJobRecord,
} from '../../types/dataManagement';
import { LEAD_COLUMNS, CLIENT_COLUMNS, downloadLeadTemplate, downloadClientTemplate, downloadErrorReport } from '../../lib/importTemplates';
import { parseImportFile, autoMapColumns, validateAndDetectDuplicates, executeBatchedImport } from '../../lib/importService';
import { LeadRecord, ClientRecord, UserProfile } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ImportWizardProps {
  existingLeads: LeadRecord[];
  existingClients: ClientRecord[];
  teamUsers: UserProfile[];
  onImportComplete?: () => void;
  onNavigateToLeads?: () => void;
  onNavigateToClients?: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'completed';

export const ImportWizard: React.FC<ImportWizardProps> = ({
  existingLeads,
  existingClients,
  teamUsers,
  onImportComplete,
  onNavigateToLeads,
  onNavigateToClients,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();

  const [step, setStep] = useState<WizardStep>('upload');
  const [importType, setImportType] = useState<ImportType>('leads');
  const [mode, setMode] = useState<ImportMode>('create_only');
  const [duplicateAction, setDuplicateAction] = useState<DuplicateResolutionAction>('skip');

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [fileType, setFileType] = useState<'csv' | 'xlsx'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Validation results
  const [validationResults, setValidationResults] = useState<ParsedRowResult[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');

  // Execution state
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [completedJob, setCompletedJob] = useState<ImportJobRecord | null>(null);

  const columnDefinitions = importType === 'leads' ? LEAD_COLUMNS : CLIENT_COLUMNS;

  // 1. File Upload & Parsing
  const handleFileSelected = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      addToast('error', 'Unsupported File Format', 'Please upload a valid .csv or .xlsx / .xls spreadsheet.');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);

    try {
      const { headers, rows, fileType: parsedType } = await parseImportFile(file);
      if (rows.length === 0) {
        addToast('error', 'Empty File', 'The selected file contains no readable data rows.');
        setIsParsing(false);
        return;
      }

      setFileHeaders(headers);
      setRawRows(rows);
      setFileType(parsedType);

      // Automatically map columns
      const autoMapping = autoMapColumns(headers, importType);
      setColumnMapping(autoMapping);

      setStep('mapping');
      addToast('info', 'File Loaded', `Successfully loaded ${rows.length} rows. Please review column mappings.`);
    } catch (err: any) {
      console.error('File parsing failed:', err);
      addToast('error', 'Parsing Failed', err.message || 'Could not parse the selected file.');
    } finally {
      setIsParsing(false);
    }
  };

  // 2. Perform Validation & Duplicate Detection
  const handleRunValidation = () => {
    // Verify required columns are mapped
    const requiredDefs = columnDefinitions.filter((d) => d.required);
    const mappedSchemaKeys = new Set(Object.values(columnMapping));
    const missingRequired = requiredDefs.filter((d) => !mappedSchemaKeys.has(d.key));

    if (missingRequired.length > 0) {
      addToast(
        'error',
        'Required Columns Missing',
        `Please map the mandatory column: ${missingRequired.map((d) => d.label).join(', ')}.`
      );
      return;
    }

    const { results, summary } = validateAndDetectDuplicates(
      rawRows,
      columnMapping,
      importType,
      existingLeads,
      existingClients,
      teamUsers,
      mode,
      duplicateAction,
      currentUser?.uid || 'system-admin',
      userProfile?.full_name || 'Administrator'
    );

    setValidationResults(results);
    setValidationSummary(summary);
    setStep('preview');
  };

  // Re-run validation when duplicate action or mode changes
  const handleConfigChange = (newMode: ImportMode, newDupAction: DuplicateResolutionAction) => {
    setMode(newMode);
    setDuplicateAction(newDupAction);

    if (rawRows.length > 0 && step === 'preview') {
      const { results, summary } = validateAndDetectDuplicates(
        rawRows,
        columnMapping,
        importType,
        existingLeads,
        existingClients,
        teamUsers,
        newMode,
        newDupAction,
        currentUser?.uid || 'system-admin',
        userProfile?.full_name || 'Administrator'
      );
      setValidationResults(results);
      setValidationSummary(summary);
    }
  };

  // 3. Confirm and Execute Batched Import
  const handleExecuteImport = async () => {
    if (!selectedFile) return;

    setStep('importing');
    setImportProgress({ current: 0, total: validationResults.length });

    try {
      const job = await executeBatchedImport(
        validationResults,
        importType,
        selectedFile.name,
        fileType,
        {
          uid: currentUser?.uid || 'admin-user',
          name: userProfile?.full_name || 'Administrator',
          email: currentUser?.email || 'admin@leadflow.crm',
        },
        mode,
        duplicateAction,
        (current, total) => {
          setImportProgress({ current, total });
        }
      );

      setCompletedJob(job);
      setStep('completed');
      if (onImportComplete) {
        onImportComplete();
      }
      addToast('success', 'Import Processed', `Finished importing ${job.created_count} new records.`);
    } catch (err: any) {
      console.error('Import execution error:', err);
      addToast('error', 'Import Failed', err.message || 'An error occurred during database writing.');
      setStep('preview');
    }
  };

  // Reset wizard to start
  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setFileHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setValidationResults([]);
    setValidationSummary(null);
    setCompletedJob(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filtered preview rows
  const filteredPreviewRows = validationResults.filter((r) => {
    if (previewFilter === 'valid') return r.isValid && !r.isDuplicate;
    if (previewFilter === 'duplicate') return r.isDuplicate;
    if (previewFilter === 'error') return !r.isValid;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Wizard Progress Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          {[
            { id: 'upload', label: '1. Select & Upload' },
            { id: 'mapping', label: '2. Column Mapping' },
            { id: 'preview', label: '3. Validate & Preview' },
            { id: 'completed', label: '4. Summary' },
          ].map((s, idx) => {
            const isCurrent = step === s.id || (s.id === 'preview' && step === 'importing');
            const isPassed =
              (s.id === 'upload' && step !== 'upload') ||
              (s.id === 'mapping' && (step === 'preview' || step === 'importing' || step === 'completed')) ||
              (s.id === 'preview' && step === 'completed');

            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-50'
                      : isPassed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isPassed ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:inline ${
                    isCurrent ? 'text-indigo-600 font-semibold' : isPassed ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
                {idx < 3 && <ChevronRight className="h-4 w-4 text-slate-300 mx-1 sm:mx-2" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: UPLOAD FILE & SELECT TYPE */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Target Entity Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setImportType('leads')}
              className={`cursor-pointer rounded-xl border p-5 transition ${
                importType === 'leads'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Import Leads Pipeline</h3>
                    <p className="text-xs text-slate-500">Inbound inquiries, prospective contractors & clients</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadLeadTemplate('csv');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    title="Download Lead CSV Template"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadLeadTemplate('xlsx');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                    title="Download Lead Excel Template"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Excel
                  </button>
                </div>
              </div>
            </div>

            <div
              onClick={() => setImportType('clients')}
              className={`cursor-pointer rounded-xl border p-5 transition ${
                importType === 'clients'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Import Converted Clients</h3>
                    <p className="text-xs text-slate-500">Official business accounts and verified corporate buyers</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadClientTemplate('csv');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    title="Download Client CSV Template"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadClientTemplate('xlsx');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                    title="Download Client Excel Template"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Excel
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelected(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center transition hover:border-indigo-500 hover:bg-slate-50/60 cursor-pointer"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
            />
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs">
              <UploadCloud className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">
              {isParsing ? 'Reading spreadsheet data...' : 'Upload your CSV or Excel file'}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Drag &amp; drop your file here, or click to browse files. Supports standard <code className="text-indigo-600 font-semibold">.csv</code>, <code className="text-indigo-600 font-semibold">.xlsx</code>, and <code className="text-indigo-600 font-semibold">.xls</code>.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span>Maximum 5,000 rows per batch</span>
              <span>•</span>
              <span>Safe batched Firestore writes</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 'mapping' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Map Spreadsheet Columns</h3>
              <p className="text-xs text-slate-500">
                Match each column in <span className="font-semibold text-slate-700">{selectedFile?.name}</span> ({rawRows.length} rows) to official {importType} fields.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setColumnMapping(autoMapColumns(fileHeaders, importType))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                Reset Auto-Map
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {columnDefinitions.map((colDef) => {
              // Find which uploaded header is mapped to this column
              const mappedHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === colDef.key) || '';

              return (
                <div
                  key={colDef.key}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                    colDef.required && !mappedHeader
                      ? 'border-rose-200 bg-rose-50/20'
                      : mappedHeader
                      ? 'border-slate-200 bg-slate-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{colDef.label}</span>
                      {colDef.required ? (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          Required
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">{colDef.description}</p>
                  </div>

                  <div className="mt-3">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Spreadsheet Column
                    </label>
                    <select
                      value={mappedHeader}
                      onChange={(e) => {
                        const newHeader = e.target.value;
                        setColumnMapping((prev) => {
                          const updated = { ...prev };
                          // Clear previous mapping for this key
                          Object.keys(updated).forEach((k) => {
                            if (updated[k] === colDef.key) {
                              delete updated[k];
                            }
                          });
                          if (newHeader) {
                            updated[newHeader] = colDef.key;
                          }
                          return updated;
                        });
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="">-- Do Not Import (Skip) --</option>
                      {fileHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel &amp; Change File
            </button>
            <button
              type="button"
              onClick={handleRunValidation}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <span>Validate &amp; Preview</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: VALIDATION, DUPLICATE RESOLUTION & PREVIEW */}
      {step === 'preview' && validationSummary && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Rows</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{validationSummary.totalRows}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Ready to Create</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700">{validationSummary.toCreate}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Duplicates Detected</div>
              <div className="mt-1 text-2xl font-bold text-amber-700">{validationSummary.duplicateRows}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Invalid Rows</div>
              <div className="mt-1 text-2xl font-bold text-rose-700">{validationSummary.errorRows}</div>
            </div>
          </div>

          {/* Import Modes & Duplicate Configuration */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Info className="h-4 w-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Import Behavior &amp; Duplicate Protection Rules
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Import Mode</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="create_only"
                      checked={mode === 'create_only'}
                      onChange={() => handleConfigChange('create_only', duplicateAction)}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Create Only (Safe Default)</div>
                      <div className="text-[11px] text-slate-500">
                        Only add new records. Do not alter or update existing CRM data.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="create_and_update"
                      checked={mode === 'create_and_update'}
                      onChange={() => handleConfigChange('create_and_update', duplicateAction)}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Create + Update Existing</div>
                      <div className="text-[11px] text-slate-500">
                        Safely update contact fields for matching records. Preserves original creator and timeline history.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">When Duplicate is Detected</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dupAction"
                      value="skip"
                      checked={duplicateAction === 'skip'}
                      onChange={() => handleConfigChange(mode, 'skip')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Skip Duplicates (Recommended)</div>
                      <div className="text-[11px] text-slate-500">
                        Prevents clutter by ignoring rows that match an existing phone or email.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dupAction"
                      value="update_existing"
                      checked={duplicateAction === 'update_existing'}
                      onChange={() => handleConfigChange(mode, 'update_existing')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Update Existing Matching Record</div>
                      <div className="text-[11px] text-slate-500">
                        Refresh details without creating duplicate entities in the database.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dupAction"
                      value="import_anyway"
                      checked={duplicateAction === 'import_anyway'}
                      onChange={() => handleConfigChange(mode, 'import_anyway')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Import Anyway (Create New)</div>
                      <div className="text-[11px] text-slate-500">
                        Force create independent new record even if matching phone/email exists.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Row Preview Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 p-4 gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewFilter('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    previewFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All ({validationResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('valid')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    previewFilter === 'valid'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Ready ({validationSummary.validRows - validationSummary.duplicateRows})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('duplicate')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    previewFilter === 'duplicate'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Duplicates ({validationSummary.duplicateRows})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('error')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    previewFilter === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Errors ({validationSummary.errorRows})
                </button>
              </div>

              {validationSummary.errorRows > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allErrors = validationResults.flatMap((r) => r.errors);
                    downloadErrorReport(allErrors, importType);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                >
                  <Download className="h-3.5 w-3.5 text-rose-600" />
                  Download Error Report
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-14">Row #</th>
                    <th className="py-2.5 px-3">Company Name</th>
                    <th className="py-2.5 px-3">Contact Person</th>
                    <th className="py-2.5 px-3">Phone / WhatsApp</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPreviewRows.slice(0, 100).map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        !row.isValid
                          ? 'bg-rose-50/40'
                          : row.isDuplicate
                          ? 'bg-amber-50/30'
                          : 'hover:bg-slate-50'
                      }
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-400">{row.rowNumber}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {row.normalized.company_name || <span className="text-rose-500 font-bold italic">Missing</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{row.normalized.contact_person || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {row.normalized.phone || row.normalized.whatsapp || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{row.normalized.email || '—'}</td>
                      <td className="py-2.5 px-3">
                        {!row.isValid ? (
                          <div className="flex items-center gap-1 text-rose-600 font-semibold">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{row.errors[0]?.problem}</span>
                          </div>
                        ) : row.isDuplicate ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              {row.resolvedAction === 'skip'
                                ? 'Will Skip (Duplicate)'
                                : row.resolvedAction === 'update'
                                ? 'Will Update Record'
                                : 'Importing Anyway'}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-xs">{row.duplicateReason}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            Create New
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredPreviewRows.length > 100 && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400">
                Showing first 100 of {filteredPreviewRows.length} rows
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setStep('mapping')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Back to Column Mapping
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={validationSummary.toCreate === 0 && validationSummary.toUpdate === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <Check className="h-4 w-4" />
              <span>
                Confirm &amp; Import ({validationSummary.toCreate + validationSummary.toUpdate} Records)
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT IN PROGRESS */}
      {step === 'importing' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 animate-pulse">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Writing Records to Firestore Pipeline...</h3>
            <p className="mt-1 text-xs text-slate-500">
              Processing in safe atomic batches. Please do not close or refresh this tab.
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Progress</span>
              <span>
                {importProgress.current} / {importProgress.total} Records
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{
                  width: `${
                    importProgress.total > 0
                      ? Math.min(100, Math.round((importProgress.current / importProgress.total) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: COMPLETED SUMMARY */}
      {step === 'completed' && completedJob && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Import Finished</h3>
              <p className="text-xs text-slate-500">
                Job ID: <span className="font-mono">{completedJob.id}</span> • Status:{' '}
                <span className="font-semibold text-emerald-600">{completedJob.status}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Processed</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{completedJob.total_rows}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">New Created</div>
              <div className="mt-1 text-xl font-bold text-emerald-700">{completedJob.created_count}</div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">Existing Updated</div>
              <div className="mt-1 text-xl font-bold text-indigo-700">{completedJob.updated_count}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Skipped / Dups</div>
              <div className="mt-1 text-xl font-bold text-slate-600">{completedJob.skipped_count}</div>
            </div>
          </div>

          {completedJob.error_details && completedJob.error_details.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800">
                  {completedJob.error_details.length} Errors or Warnings Recorded
                </span>
                <button
                  type="button"
                  onClick={() => downloadErrorReport(completedJob.error_details || [], completedJob.import_type)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Error Log
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Import Another File
            </button>

            <div className="flex items-center gap-2">
              {completedJob.import_type === 'leads' && onNavigateToLeads && (
                <button
                  type="button"
                  onClick={onNavigateToLeads}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  <span>View Leads Pipeline</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              {completedJob.import_type === 'clients' && onNavigateToClients && (
                <button
                  type="button"
                  onClick={onNavigateToClients}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <span>View Converted Clients</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
