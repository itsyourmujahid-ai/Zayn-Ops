import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Info,
  Check,
  X,
  FileText,
  Users,
  ShieldAlert,
  Building2,
  FolderPlus,
  Briefcase,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  ImportType,
  ImportMode,
  DuplicateResolutionAction,
  ParsedRowResult,
  ValidationSummary,
  ImportJobRecord,
} from '../../types/dataManagement';
import {
  LEAD_COLUMNS,
  CLIENT_COLUMNS,
  COMBINED_COLUMNS,
  downloadLeadTemplate,
  downloadClientTemplate,
  downloadCombinedTemplate,
  downloadErrorReport,
} from '../../lib/importTemplates';
import {
  parseImportFile,
  autoMapColumns,
  extractUniqueSalesmen,
  autoMatchSalesmen,
  validateAndDetectDuplicates,
  executeBatchedImport,
} from '../../lib/importService';
import { LeadRecord, ClientRecord, UserProfile } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ImportWizardProps {
  existingLeads: LeadRecord[];
  existingClients: ClientRecord[];
  teamUsers: UserProfile[];
  effectiveCompanyId?: string;
  onImportComplete?: () => void;
  onNavigateToLeads?: () => void;
  onNavigateToClients?: () => void;
  onNavigateToHistory?: () => void;
}

export type WizardStep =
  | 'type'
  | 'upload'
  | 'mapping'
  | 'ownership'
  | 'duplicates'
  | 'preview'
  | 'confirm'
  | 'results';

export const ImportWizard: React.FC<ImportWizardProps> = ({
  existingLeads,
  existingClients,
  teamUsers,
  effectiveCompanyId = 'company-bahwan-mge',
  onImportComplete,
  onNavigateToLeads,
  onNavigateToClients,
  onNavigateToHistory,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState<WizardStep>('type');

  // Step 1: Data Type
  const [importType, setImportType] = useState<ImportType>('clients_and_leads');

  // Step 2: File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [fileType, setFileType] = useState<'csv' | 'xlsx'>('xlsx');
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Column Mapping
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Step 4: Ownership Assignment
  const [uniqueFileSalesmen, setUniqueFileSalesmen] = useState<string[]>([]);
  const [salesmanMapping, setSalesmanMapping] = useState<Record<string, string>>({});
  const [fallbackSalesmanId, setFallbackSalesmanId] = useState<string>(userProfile?.id || '');
  const [autoMatchStatus, setAutoMatchStatus] = useState<
    Record<string, { userId: string; userName: string; matchedBy: 'exact' | 'partial' | 'email' | 'none' }>
  >({});

  // Step 5: Duplicate Resolution Rules
  const [duplicateAction, setDuplicateAction] = useState<DuplicateResolutionAction>('skip');
  const [mode, setMode] = useState<ImportMode>('create_only');

  // Step 6 & 7: Validation Results & Preview
  const [validationResults, setValidationResults] = useState<ParsedRowResult[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const pageSize = 20;

  // Step 8: Execution State
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [completedJob, setCompletedJob] = useState<ImportJobRecord | null>(null);

  // Active column schema
  const columnDefinitions = useMemo(() => {
    if (importType === 'leads') return LEAD_COLUMNS;
    if (importType === 'clients') return CLIENT_COLUMNS;
    return COMBINED_COLUMNS;
  }, [importType]);

  // Active company team members
  const activeCompanySalesmen = useMemo(() => {
    return teamUsers.filter(
      (u) =>
        (u.company_id === effectiveCompanyId || !u.company_id) &&
        u.is_active !== false &&
        u.role !== 'SUPER_ADMIN'
    );
  }, [teamUsers, effectiveCompanyId]);

  // Handler for File Selection
  const handleFileChange = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      addToast('error', 'Unsupported File Format', 'Please upload a valid .csv or .xlsx Excel file.');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);

    try {
      const { headers, rows, fileType: parsedType, fileSizeFormatted: sizeStr } =
        await parseImportFile(file);

      if (rows.length === 0) {
        addToast('error', 'Empty File', 'The uploaded file does not contain any readable data rows.');
        setIsParsing(false);
        return;
      }

      setFileHeaders(headers);
      setRawRows(rows);
      setFileType(parsedType);
      setFileSizeFormatted(sizeStr);

      // Auto-map columns
      const autoMap = autoMapColumns(headers, importType);
      setColumnMapping(autoMap);

      // Extract unique salesmen from file
      const rawSalesmen = extractUniqueSalesmen(rows, autoMap);
      setUniqueFileSalesmen(rawSalesmen);

      // Auto-match salesmen
      const matched = autoMatchSalesmen(rawSalesmen, activeCompanySalesmen);
      setAutoMatchStatus(matched);

      const initialMap: Record<string, string> = {};
      Object.entries(matched).forEach(([raw, info]) => {
        if (info.userId) {
          initialMap[raw] = info.userId;
        } else {
          initialMap[raw] = userProfile?.id || activeCompanySalesmen[0]?.id || 'unassigned';
        }
      });
      setSalesmanMapping(initialMap);

      setCurrentStep('mapping');
      addToast(
        'info',
        'File Loaded Successfully',
        `Parsed ${rows.length} rows and ${headers.length} columns from ${file.name}.`
      );
    } catch (err: any) {
      console.error('File parsing error:', err);
      addToast('error', 'Failed to Read File', err.message || 'Error processing spreadsheet.');
    } finally {
      setIsParsing(false);
    }
  };

  // Step 3 -> Step 4 Transition: Extract & prepare salesmen
  const handleProceedFromMapping = () => {
    // Check if Company Name is mapped
    const hasCompanyName = Object.values(columnMapping).includes('company_name');
    if (!hasCompanyName) {
      addToast(
        'error',
        'Required Field Unmapped',
        'You must map at least one column to the mandatory "Company Name" field.'
      );
      return;
    }

    // Refresh unique salesmen based on final mapping
    const rawSalesmen = extractUniqueSalesmen(rawRows, columnMapping);
    setUniqueFileSalesmen(rawSalesmen);

    const matched = autoMatchSalesmen(rawSalesmen, activeCompanySalesmen);
    setAutoMatchStatus(matched);

    const updatedMap = { ...salesmanMapping };
    rawSalesmen.forEach((raw) => {
      if (!updatedMap[raw]) {
        updatedMap[raw] = matched[raw]?.userId || userProfile?.id || activeCompanySalesmen[0]?.id || 'unassigned';
      }
    });
    setSalesmanMapping(updatedMap);

    setCurrentStep('ownership');
  };

  // Step 4 -> Step 5: Run validation and duplicate analysis
  const handleRunValidation = () => {
    const { results, summary } = validateAndDetectDuplicates(
      rawRows,
      columnMapping,
      importType,
      existingLeads,
      existingClients,
      teamUsers,
      salesmanMapping,
      fallbackSalesmanId || userProfile?.id || '',
      mode,
      duplicateAction,
      effectiveCompanyId,
      userProfile?.id || 'admin',
      userProfile?.full_name || 'Company Administrator'
    );

    setValidationResults(results);
    setValidationSummary(summary);
    setPreviewPage(1);
    setCurrentStep('duplicates');
  };

  // Re-run validation whenever duplicate strategy changes
  const handleDuplicateActionChange = (newAction: DuplicateResolutionAction) => {
    setDuplicateAction(newAction);
    const newMode: ImportMode = newAction === 'update_existing' ? 'create_and_update' : 'create_only';
    setMode(newMode);

    const { results, summary } = validateAndDetectDuplicates(
      rawRows,
      columnMapping,
      importType,
      existingLeads,
      existingClients,
      teamUsers,
      salesmanMapping,
      fallbackSalesmanId || userProfile?.id || '',
      newMode,
      newAction,
      effectiveCompanyId,
      userProfile?.id || 'admin',
      userProfile?.full_name || 'Company Administrator'
    );

    setValidationResults(results);
    setValidationSummary(summary);
  };

  // Step 7 -> 8: Execute Import
  const handleExecuteImport = async () => {
    if (!validationResults || validationResults.length === 0) return;

    setIsImporting(true);
    setCurrentStep('results');
    setImportProgress({ current: 0, total: validationResults.length });

    try {
      const jobRecord = await executeBatchedImport(
        validationResults,
        importType,
        selectedFile?.name || 'Import_File',
        fileType,
        effectiveCompanyId,
        {
          uid: userProfile?.id || 'admin',
          name: userProfile?.full_name || 'Company Administrator',
          email: userProfile?.email || 'admin@company.om',
        },
        mode,
        duplicateAction,
        salesmanMapping,
        (current, total) => {
          setImportProgress({ current, total });
        }
      );

      setCompletedJob(jobRecord);
      addToast(
        jobRecord.status === 'Completed' ? 'success' : 'info',
        `Import ${jobRecord.status}`,
        `Processed ${jobRecord.total_rows} rows: ${jobRecord.created_count} created, ${jobRecord.updated_count} updated, ${jobRecord.skipped_count} skipped.`
      );

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      console.error('Import execution error:', err);
      addToast('error', 'Import Execution Failed', err.message || 'Database write failure.');
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered preview rows
  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === 'valid') {
      return validationResults.filter((r) => r.isValid && !r.isDuplicate);
    }
    if (previewFilter === 'duplicate') {
      return validationResults.filter((r) => r.isDuplicate || r.isPossibleDuplicate);
    }
    if (previewFilter === 'error') {
      return validationResults.filter((r) => !r.isValid);
    }
    return validationResults;
  }, [validationResults, previewFilter]);

  const totalPages = Math.ceil(filteredPreviewRows.length / pageSize) || 1;
  const paginatedRows = filteredPreviewRows.slice(
    (previewPage - 1) * pageSize,
    previewPage * pageSize
  );

  // Download error report
  const handleDownloadErrors = () => {
    const allErrors: Array<{ rowNumber: number; problem: string; suggestedCorrection?: string; field?: string }> = [];
    validationResults.forEach((r) => {
      if (r.errors.length > 0) {
        r.errors.forEach((err) => allErrors.push(err));
      }
    });
    if (allErrors.length === 0) {
      addToast('info', 'No Errors', 'No invalid rows or formatting issues detected in this file.');
      return;
    }
    downloadErrorReport(allErrors, importType);
  };

  // Reset entire wizard
  const handleReset = () => {
    setSelectedFile(null);
    setFileHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setValidationResults([]);
    setValidationSummary(null);
    setCompletedJob(null);
    setCurrentStep('type');
  };

  // Step Indicators
  const STEPS_LIST = [
    { key: 'type', label: '1. Select Type' },
    { key: 'upload', label: '2. Upload File' },
    { key: 'mapping', label: '3. Map Columns' },
    { key: 'ownership', label: '4. Assign Ownership' },
    { key: 'duplicates', label: '5. Duplicates & Rules' },
    { key: 'preview', label: '6. Data Preview' },
    { key: 'confirm', label: '7. Confirm' },
    { key: 'results', label: '8. Results' },
  ];

  return (
    <div className="space-y-6">
      {/* Wizard Progress Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {STEPS_LIST.map((s, idx) => {
            const isCurrent = currentStep === s.key;
            const stepOrder = STEPS_LIST.findIndex((x) => x.key === currentStep);
            const isDone = idx < stepOrder;

            return (
              <div
                key={s.key}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-400 bg-slate-50'
                }`}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-current text-[10px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                )}
                <span className="truncate">{s.label.split('. ')[1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: SELECT DATA TYPE */}
      {currentStep === 'type' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900">Step 1: Select What You Want to Import</h2>
            <p className="mt-1 text-xs text-slate-500">
              Choose the entity structure matching your spreadsheet or Excel customer workbook.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Clients + Leads (Combined) */}
              <div
                onClick={() => setImportType('clients_and_leads')}
                className={`cursor-pointer rounded-xl border p-5 transition relative flex flex-col justify-between ${
                  importType === 'clients_and_leads'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold">
                      <Layers className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800">
                      Recommended
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">Clients + Leads (Combined)</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Migrates client accounts and creates associated project opportunities in one pass. Links leads to existing clients automatically.
                  </p>
                </div>
                <div className="mt-5 border-t border-slate-200/60 pt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Download sample:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadCombinedTemplate('csv');
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      CSV
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadCombinedTemplate('xlsx');
                      }}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
                    >
                      Excel (.xlsx)
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 2: Clients Only */}
              <div
                onClick={() => setImportType('clients')}
                className={`cursor-pointer rounded-xl border p-5 transition relative flex flex-col justify-between ${
                  importType === 'clients'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold">
                      <Briefcase className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">Clients Directory Only</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Import existing customer accounts, procurement points of contact, phone numbers, and company addresses into the Client Directory.
                  </p>
                </div>
                <div className="mt-5 border-t border-slate-200/60 pt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Download sample:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadClientTemplate('csv');
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      CSV
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadClientTemplate('xlsx');
                      }}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
                    >
                      Excel (.xlsx)
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 3: Leads Only */}
              <div
                onClick={() => setImportType('leads')}
                className={`cursor-pointer rounded-xl border p-5 transition relative flex flex-col justify-between ${
                  importType === 'leads'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 font-bold">
                      <FolderPlus className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">Leads &amp; Opportunities</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Import active sales pipeline opportunities, project requirements, estimated values, and assign them directly to company sales reps.
                  </p>
                </div>
                <div className="mt-5 border-t border-slate-200/60 pt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Download sample:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadLeadTemplate('csv');
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      CSV
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadLeadTemplate('xlsx');
                      }}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
                    >
                      Excel (.xlsx)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
              >
                <span>Continue to Upload</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: UPLOAD FILE */}
      {currentStep === 'upload' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 2: Upload Data File</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Importing: <span className="font-bold text-slate-800 capitalize">{importType.replace(/_/g, ' ')}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep('type')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Change Type</span>
              </button>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/20 transition cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {isParsing ? (
                <div className="space-y-3">
                  <RefreshCw className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
                  <p className="text-xs font-bold text-slate-700">Reading &amp; validating file in memory...</p>
                  <p className="text-[11px] text-slate-400">Zero data is written to Firestore during this stage.</p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedFile.name}</h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                      {fileType}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-medium">{fileSizeFormatted}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-indigo-600 font-bold">{rawRows.length} rows</span>
                  </div>
                  <p className="pt-2 text-[11px] text-slate-400">Click to choose a different spreadsheet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Drag &amp; drop your Excel or CSV file here</h3>
                  <p className="text-xs text-slate-500">
                    Supports .xlsx, .xls, and .csv files up to 15MB.
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Browse Files</span>
                  </button>
                </div>
              )}
            </div>

            {/* Template Download Prompt */}
            <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Need the standardized template?</h4>
                  <p className="text-[11px] text-indigo-700">
                    Download clean templates with column headers and sample data formatting.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (importType === 'leads') downloadLeadTemplate('xlsx');
                    else if (importType === 'clients') downloadClientTemplate('xlsx');
                    else downloadCombinedTemplate('xlsx');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Excel Template (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (importType === 'leads') downloadLeadTemplate('csv');
                    else if (importType === 'clients') downloadClientTemplate('csv');
                    else downloadCombinedTemplate('csv');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-indigo-50 cursor-pointer"
                >
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Navigation buttons */}
            {selectedFile && (
              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setRawRows([]);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Remove File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('mapping')}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  <span>Proceed to Column Mapping</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: COLUMN MAPPING */}
      {currentStep === 'mapping' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 3: Map Spreadsheet Columns to ZaynOps Fields</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Headers are automatically matched where possible. Review or adjust mappings below.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                  {Object.values(columnMapping).filter(Boolean).length} / {fileHeaders.length} Mapped
                </span>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-1/4">Spreadsheet Header</th>
                    <th className="py-3 px-4 w-1/4">Sample Value (Row 1)</th>
                    <th className="py-3 px-4 w-2/5">ZaynOps CRM Target Field</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {fileHeaders.map((header) => {
                    const currentTargetKey = columnMapping[header] || '';
                    const targetDef = columnDefinitions.find((c) => c.key === currentTargetKey);
                    const sampleValue = rawRows[0]?.[header];

                    return (
                      <tr key={header} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {header}
                        </td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-[200px]" title={String(sampleValue || '')}>
                          {sampleValue !== undefined && sampleValue !== '' ? (
                            <span className="font-mono text-[11px]">{String(sampleValue)}</span>
                          ) : (
                            <span className="italic text-slate-300">Empty in first row</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={currentTargetKey}
                            onChange={(e) => {
                              const newKey = e.target.value;
                              setColumnMapping((prev) => ({
                                ...prev,
                                [header]: newKey,
                              }));
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                          >
                            <option value="">— Do Not Import (Ignore Column) —</option>
                            <optgroup label="Required Fields">
                              {columnDefinitions
                                .filter((c) => c.required)
                                .map((c) => (
                                  <option key={c.key} value={c.key}>
                                    * {c.label} (Required)
                                  </option>
                                ))}
                            </optgroup>
                            <optgroup label="Optional Details">
                              {columnDefinitions
                                .filter((c) => !c.required)
                                .map((c) => (
                                  <option key={c.key} value={c.key}>
                                    {c.label}
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                          {targetDef && (
                            <p className="mt-1 text-[10px] text-slate-400">{targetDef.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {currentTargetKey ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              <Check className="h-3 w-3" />
                              Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              Ignored
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleProceedFromMapping}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
              >
                <span>Proceed to Ownership Assignment</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: OWNERSHIP ASSIGNMENT */}
      {currentStep === 'ownership' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900">Step 4: Ownership &amp; Sales Representative Mapping</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Map salesmen listed in the Excel spreadsheet to registered, active ZaynOps team members in your company.
              </p>
            </div>

            {uniqueFileSalesmen.length === 0 ? (
              <div className="my-6 rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>No Salesman Column Mapped</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  The spreadsheet does not have a mapped Salesman or Owner column. All imported records will be assigned to the company default selected below.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {uniqueFileSalesmen.length} Unique Sales Representatives Found in File
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Bulk action:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultId = userProfile?.id || activeCompanySalesmen[0]?.id || 'unassigned';
                        const bulkMap: Record<string, string> = {};
                        uniqueFileSalesmen.forEach((r) => {
                          bulkMap[r] = defaultId;
                        });
                        setSalesmanMapping(bulkMap);
                        addToast('info', 'Bulk Assigned', `Assigned all file salesmen to ${userProfile?.full_name || 'Admin'}.`);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                    >
                      Assign All to Me ({userProfile?.full_name?.split(' ')[0] || 'Admin'})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Salesman in Excel File</th>
                        <th className="py-3 px-4">Auto-Match Status</th>
                        <th className="py-3 px-4">Assigned ZaynOps Team Member</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {uniqueFileSalesmen.map((fileSalesman) => {
                        const status = autoMatchStatus[fileSalesman];
                        const selectedUserId = salesmanMapping[fileSalesman] || 'unassigned';

                        return (
                          <tr key={fileSalesman} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              "{fileSalesman}"
                            </td>
                            <td className="py-3 px-4">
                              {status?.matchedBy === 'exact' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  <Check className="h-3 w-3" />
                                  Exact Match
                                </span>
                              ) : status?.matchedBy === 'partial' || status?.matchedBy === 'email' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                  <Check className="h-3 w-3" />
                                  Auto-Matched ({status.matchedBy})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  <AlertTriangle className="h-3 w-3" />
                                  Unmatched
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={selectedUserId}
                                onChange={(e) => {
                                  const uid = e.target.value;
                                  setSalesmanMapping((prev) => ({
                                    ...prev,
                                    [fileSalesman]: uid,
                                  }));
                                }}
                                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                              >
                                <option value="unassigned">— Leave as Unassigned —</option>
                                <optgroup label="Company Team Members">
                                  {activeCompanySalesmen.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.full_name} ({user.role} • {user.email})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Fallback Salesman */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <label className="block text-xs font-bold text-slate-900">
                Fallback Sales Representative (For empty or unmapped rows):
              </label>
              <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <select
                  value={fallbackSalesmanId}
                  onChange={(e) => setFallbackSalesmanId(e.target.value)}
                  className="w-full sm:max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                >
                  <option value="unassigned">— Mark as Unassigned —</option>
                  {activeCompanySalesmen.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role} • {u.email})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500">
                  Used if a row has a blank salesman field.
                </span>
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep('mapping')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleRunValidation}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
              >
                <span>Run Validation &amp; Duplicate Check</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: DUPLICATE RESOLUTION RULES */}
      {currentStep === 'duplicates' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900">Step 5: Duplicate Detection &amp; Resolution Rules</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Configure how matching phone numbers, emails, and company names should be handled.
              </p>
            </div>

            {/* Quick Metrics from In-Memory Validation */}
            {validationSummary && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Total Rows</span>
                  <div className="text-lg font-bold text-slate-900">{validationSummary.totalRows}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                  <span className="text-[11px] text-emerald-700 font-medium">New Records</span>
                  <div className="text-lg font-bold text-emerald-700">{validationSummary.validRows - validationSummary.duplicateRows}</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center">
                  <span className="text-[11px] text-amber-700 font-medium">Duplicates Found</span>
                  <div className="text-lg font-bold text-amber-700">{validationSummary.duplicateRows}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-center">
                  <span className="text-[11px] text-rose-700 font-medium">Invalid / Missing</span>
                  <div className="text-lg font-bold text-rose-700">{validationSummary.errorRows}</div>
                </div>
              </div>
            )}

            {/* Strategy Selection */}
            <div className="mt-6 space-y-3">
              <label className="block text-xs font-bold text-slate-900">
                Choose Duplicate Resolution Strategy:
              </label>

              {/* Option A: Skip Duplicates */}
              <div
                onClick={() => handleDuplicateActionChange('skip')}
                className={`cursor-pointer rounded-xl border p-4 transition flex items-start gap-3.5 ${
                  duplicateAction === 'skip'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="duplicate_action"
                  checked={duplicateAction === 'skip'}
                  onChange={() => handleDuplicateActionChange('skip')}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Skip Duplicates (Safest &amp; Recommended)</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800">Default</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Ignores records whose normalized phone, WhatsApp, or email already exists in your company CRM. Existing records remain completely untouched.
                  </p>
                </div>
              </div>

              {/* Option B: Update Existing */}
              <div
                onClick={() => handleDuplicateActionChange('update_existing')}
                className={`cursor-pointer rounded-xl border p-4 transition flex items-start gap-3.5 ${
                  duplicateAction === 'update_existing'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="duplicate_action"
                  checked={duplicateAction === 'update_existing'}
                  onChange={() => handleDuplicateActionChange('update_existing')}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900">Update Existing Records (Non-destructive)</span>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Refreshes contact details, address, and notes on existing records without overwriting original creators, creation dates, or transfer histories.
                  </p>
                </div>
              </div>

              {/* Option C: Import Anyway */}
              <div
                onClick={() => handleDuplicateActionChange('import_anyway')}
                className={`cursor-pointer rounded-xl border p-4 transition flex items-start gap-3.5 ${
                  duplicateAction === 'import_anyway'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="duplicate_action"
                  checked={duplicateAction === 'import_anyway'}
                  onChange={() => handleDuplicateActionChange('import_anyway')}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Import Anyway (Create Duplicates)</span>
                    <span className="rounded-full bg-rose-100 px-2 py-0.2 text-[10px] font-bold text-rose-800">Caution</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Creates brand new records even if a phone number matches existing CRM data. You can merge duplicates later using the Data Quality tools.
                  </p>
                </div>
              </div>
            </div>

            {/* Special Client-Lead Linking Note */}
            {(importType === 'leads' || importType === 'clients_and_leads') && (
              <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 flex items-start gap-3">
                <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900">
                  <span className="font-bold">Automatic Client-Lead Linking: </span>
                  When importing leads that belong to an existing registered Client, the system links the opportunity directly to that Client record (<span className="font-mono text-[11px]">client_id</span>), ensuring client ownership is preserved and no duplicate client entries are created.
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep('ownership')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('preview')}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
              >
                <span>Proceed to Data Preview</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: DATA PREVIEW */}
      {currentStep === 'preview' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 6: In-Memory Data Preview</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review how each row will be classified and treated before confirming the import.
                </p>
              </div>

              {/* Error Report Download if errors exist */}
              {validationSummary && validationSummary.errorRows > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadErrors}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Error Report ({validationSummary.errorRows})</span>
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewFilter('all');
                  setPreviewPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  previewFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Rows ({validationResults.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewFilter('valid');
                  setPreviewPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  previewFilter === 'valid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Valid &amp; New ({validationSummary?.validRows ? validationSummary.validRows - (validationSummary.duplicateRows || 0) : 0})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewFilter('duplicate');
                  setPreviewPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  previewFilter === 'duplicate'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Duplicates ({validationSummary?.duplicateRows || 0})
              </button>
              {validationSummary && validationSummary.errorRows > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewFilter('error');
                    setPreviewPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    previewFilter === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Errors ({validationSummary.errorRows})
                </button>
              )}
            </div>

            {/* Preview Table */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-3">Company Name</th>
                    <th className="py-2.5 px-3">Contact Person</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Salesman</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3 text-center">Planned Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedRows.map((row) => {
                    return (
                      <tr key={row.rowNumber} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                          {row.rowNumber}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {row.normalized.company_name || (
                            <span className="italic text-rose-500 font-normal">Missing Company Name</span>
                          )}
                          {row.linkedClientId && (
                            <span className="ml-1.5 rounded-sm bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">
                              Linked to Client
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {row.normalized.contact_person || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.normalized.normalized_phone ? (
                            <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded-sm">
                              {row.normalized.normalized_phone}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="truncate block max-w-[120px]" title={row.assignedSalesmanName}>
                            {row.assignedSalesmanName || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {row.classification === 'new' && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              New Record
                            </span>
                          )}
                          {row.classification === 'exact_duplicate' && (
                            <span
                              className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 cursor-help"
                              title={row.duplicateReason}
                            >
                              Exact Duplicate
                            </span>
                          )}
                          {row.classification === 'possible_duplicate' && (
                            <span
                              className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 cursor-help"
                              title={row.duplicateReason}
                            >
                              Possible Match
                            </span>
                          )}
                          {row.classification === 'invalid' && (
                            <span
                              className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 cursor-help"
                              title={row.errors.map((e) => e.problem).join('; ')}
                            >
                              Invalid Row
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.resolvedAction === 'create' && (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Will Create
                            </span>
                          )}
                          {row.resolvedAction === 'update' && (
                            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                              Will Update
                            </span>
                          )}
                          {row.resolvedAction === 'skip' && (
                            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              Will Skip
                            </span>
                          )}
                          {row.resolvedAction === 'error' && (
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                              Omitted (Error)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {(previewPage - 1) * pageSize + 1} to{' '}
                {Math.min(previewPage * pageSize, filteredPreviewRows.length)} of {filteredPreviewRows.length} entries
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={previewPage <= 1}
                  onClick={() => setPreviewPage((p) => Math.max(p - 1, 1))}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  Page {previewPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={previewPage >= totalPages}
                  onClick={() => setPreviewPage((p) => Math.min(p + 1, totalPages))}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep('duplicates')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('confirm')}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
              >
                <span>Proceed to Final Confirmation</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 7: SUMMARY & FINAL CONFIRMATION */}
      {currentStep === 'confirm' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900">Step 7: Final Review &amp; Execution Confirmation</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Please verify the summary below before executing the batched import into Firestore.
              </p>
            </div>

            {/* Comprehensive Metrics Grid */}
            {validationSummary && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs text-slate-500 font-medium">Total Rows in File</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{validationSummary.totalRows}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <span className="text-xs text-emerald-800 font-medium">Records to Create</span>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{validationSummary.toCreate}</div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <span className="text-xs text-indigo-800 font-medium">Records to Update</span>
                  <div className="text-2xl font-black text-indigo-700 mt-1">{validationSummary.toUpdate}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
                  <span className="text-xs text-slate-600 font-medium">Records to Skip</span>
                  <div className="text-2xl font-black text-slate-700 mt-1">{validationSummary.toSkip}</div>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <span className="text-xs text-sky-800 font-medium">Leads Linked to Clients</span>
                  <div className="text-2xl font-black text-sky-700 mt-1">{validationSummary.linkedLeads}</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <span className="text-xs text-amber-800 font-medium">Unassigned Records</span>
                  <div className="text-2xl font-black text-amber-700 mt-1">{validationSummary.unassignedCount}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <span className="text-xs text-rose-800 font-medium">Invalid Rows Omitted</span>
                  <div className="text-2xl font-black text-rose-700 mt-1">{validationSummary.errorRows}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs text-slate-500 font-medium">Duplicate Action</span>
                  <div className="text-sm font-bold text-slate-800 mt-2 uppercase tracking-wide">
                    {duplicateAction.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Banner */}
            <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                <ShieldAlert className="h-4 w-4 text-indigo-600" />
                <span>Audit Trail &amp; Data Protection Assurance</span>
              </div>
              <p className="text-xs text-indigo-800 leading-relaxed">
                All created records will be tagged with your company ID (<span className="font-mono">{effectiveCompanyId}</span>). Existing activity logs, follow-ups, and transfer histories are safeguarded and will never be overwritten. An immutable audit record will be logged with your administrator credentials.
              </p>
            </div>

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep('preview')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm &amp; Execute Import</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 8: IMPORT RESULTS & REAL-TIME PROGRESS */}
      {currentStep === 'results' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-2xs text-center max-w-2xl mx-auto">
            {isImporting ? (
              <div className="space-y-6 py-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Processing Batched Migration...</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Committing non-blocking batches of 50 records into Firestore.
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${
                        importProgress.total > 0
                          ? Math.round((importProgress.current / importProgress.total) * 100)
                          : 10
                      }%`,
                    }}
                  />
                </div>

                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                  <span>
                    Committed: {importProgress.current} / {importProgress.total} records
                  </span>
                  <span>
                    {importProgress.total > 0
                      ? Math.round((importProgress.current / importProgress.total) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            ) : completedJob ? (
              <div className="space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-9 w-9" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                    <span>Import Completed Successfully</span>
                  </div>
                  <h2 className="mt-2 text-xl font-black text-slate-900">
                    {completedJob.created_count + completedJob.updated_count} Records Processed
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Migration file <span className="font-bold">{completedJob.file_name}</span> has been processed into the company database.
                  </p>
                </div>

                {/* Stats Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[11px] text-slate-500">Created</span>
                    <div className="text-lg font-bold text-emerald-600">{completedJob.created_count}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[11px] text-slate-500">Updated</span>
                    <div className="text-lg font-bold text-indigo-600">{completedJob.updated_count}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[11px] text-slate-500">Skipped</span>
                    <div className="text-lg font-bold text-slate-600">{completedJob.skipped_count}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[11px] text-slate-500">Errors</span>
                    <div className="text-lg font-bold text-rose-600">{completedJob.error_count}</div>
                  </div>
                </div>

                {/* Navigation CTA buttons */}
                <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                  {onNavigateToLeads && (
                    <button
                      type="button"
                      onClick={onNavigateToLeads}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 cursor-pointer"
                    >
                      <FolderPlus className="h-4 w-4" />
                      <span>View Leads</span>
                    </button>
                  )}
                  {onNavigateToClients && (
                    <button
                      type="button"
                      onClick={onNavigateToClients}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                    >
                      <Briefcase className="h-4 w-4" />
                      <span>View Clients</span>
                    </button>
                  )}
                  {onNavigateToHistory && (
                    <button
                      type="button"
                      onClick={onNavigateToHistory}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>View Import History</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <span>Import Another File</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
