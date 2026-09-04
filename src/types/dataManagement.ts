/**
 * Type definitions for Phase V — Import / Export & Bulk Data Management
 */

import { Priority, LeadStatus, ClientStatus } from './database';

export type ImportType = 'leads' | 'clients';

export type ImportMode = 'create_only' | 'create_and_update';

export type DuplicateResolutionAction = 'skip' | 'import_anyway' | 'update_existing';

export type ImportJobStatus = 'Processing' | 'Completed' | 'Completed With Errors' | 'Failed';

export interface ImportRowError {
  rowNumber: number;
  field?: string;
  problem: string;
  suggestedCorrection?: string;
  rawData?: Record<string, any>;
}

export interface ImportJobRecord {
  id: string;
  import_type: ImportType;
  file_name: string;
  file_type: 'csv' | 'xlsx';
  initiated_by: string;
  initiated_by_name: string;
  started_at: string;
  completed_at?: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  status: ImportJobStatus;
  mode: ImportMode;
  duplicate_action: DuplicateResolutionAction;
  error_details?: ImportRowError[];
}

export interface ColumnDefinition {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  description: string;
}

export interface ParsedRowResult {
  rowNumber: number;
  raw: Record<string, any>;
  normalized: Record<string, any>;
  isValid: boolean;
  errors: ImportRowError[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateRecordId?: string;
  duplicateRecordName?: string;
  duplicateReason?: string;
  resolvedAction: 'create' | 'update' | 'skip' | 'error';
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
}

export interface ExportFilters {
  entityType: 'leads' | 'clients' | 'activities' | 'followups' | 'targets';
  format: 'csv' | 'xlsx';
  dateRange: 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom';
  startDate?: string;
  endDate?: string;
  status?: string;
  priority?: string;
  salesmanId?: string;
  source?: string;
  leadType?: string;
  tag?: string;
  clientStatus?: 'all' | 'Active' | 'Inactive';
}

export interface BulkOperationResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; name?: string; error: string }>;
}
