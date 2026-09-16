/**
 * Phase V — Business Data Import & Migration Service
 * Handles CSV/XLSX parsing, intelligent column mapping, normalization,
 * multi-level duplicate detection, salesman ownership mapping,
 * non-blocking chunked Firestore writes (batches of 50),
 * audit logging, and import history jobs.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ImportType,
  ImportMode,
  DuplicateResolutionAction,
  DuplicateClassification,
  ParsedRowResult,
  ValidationSummary,
  ImportRowError,
  ImportJobRecord,
} from '../types/dataManagement';
import { LEAD_COLUMNS, CLIENT_COLUMNS, COMBINED_COLUMNS } from './importTemplates';
import {
  LeadRecord,
  ClientRecord,
  UserProfile,
  Priority,
  LeadStatus,
  ClientStatus,
} from '../types/database';
import {
  normalizePhone,
  normalizeEmail,
  normalizeCompanyName,
  normalizeContactPerson,
  phonesMatch,
} from './dataQuality';
import {
  doc,
  collection,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { createAuditLog } from './dal';

const VALID_PRIORITIES: Priority[] = ['Hot', 'Warm', 'Cold'];
const VALID_LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Meeting',
  'Quotation',
  'Negotiation',
  'Won',
  'Lost',
];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 Megabytes

/**
 * 1. Parse File into Raw Rows and Headers (CSV or XLSX)
 */
export async function parseImportFile(file: File): Promise<{
  headers: string[];
  rows: Record<string, any>[];
  fileType: 'csv' | 'xlsx';
  fileSizeFormatted: string;
}> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed limit of 15MB. Please split your file and re-upload.`
    );
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  const fileSizeFormatted = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    : `${(file.size / 1024).toFixed(1)} KB`;

  if (extension === 'xlsx' || extension === 'xls') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    }) as any[][];

    if (!rawData || rawData.length === 0) {
      throw new Error('The uploaded Excel spreadsheet appears to be empty.');
    }

    const headerRow = rawData[0].map((h) => String(h || '').trim()).filter(Boolean);
    if (headerRow.length === 0) {
      throw new Error('No valid column headers were found on the first row of your sheet.');
    }

    const dataRows: Record<string, any>[] = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.every((val: any) => val === '' || val === null || val === undefined)) {
        continue;
      }
      const rowObj: Record<string, any> = {};
      headerRow.forEach((header, index) => {
        rowObj[header] = row[index] !== undefined ? String(row[index]).trim() : '';
      });
      dataRows.push(rowObj);
    }

    return { headers: headerRow, rows: dataRows, fileType: 'xlsx', fileSizeFormatted };
  }

  // Default to CSV Parsing
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const headers = (results.meta.fields || []).filter(Boolean);
        if (headers.length === 0) {
          reject(new Error('The uploaded CSV does not contain valid column headers.'));
          return;
        }
        const rows = (results.data as Record<string, any>[]).filter((row) =>
          Object.values(row).some((val) => val && String(val).trim() !== '')
        );
        resolve({ headers, rows, fileType: 'csv', fileSizeFormatted });
      },
      error: (err) => reject(new Error(`CSV Parsing error: ${err.message}`)),
    });
  });
}

/**
 * 2. Automatic Column Mapping
 * Matches uploaded file headers to official schema column keys based on exact match and aliases.
 */
export function autoMapColumns(
  uploadedHeaders: string[],
  importType: ImportType
): Record<string, string> {
  let definitions = LEAD_COLUMNS;
  if (importType === 'clients') {
    definitions = CLIENT_COLUMNS;
  } else if (importType === 'clients_and_leads') {
    definitions = COMBINED_COLUMNS;
  }

  const mapping: Record<string, string> = {};

  uploadedHeaders.forEach((uploadedHeader) => {
    const cleanHeader = uploadedHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanHeader) return;

    for (const def of definitions) {
      const cleanKey = def.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanLabel = def.label.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (cleanHeader === cleanKey || cleanHeader === cleanLabel) {
        mapping[uploadedHeader] = def.key;
        return;
      }

      for (const alias of def.aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanHeader === cleanAlias) {
          mapping[uploadedHeader] = def.key;
          return;
        }
      }
    }
  });

  return mapping;
}

/**
 * 3. Extract Unique Salesman Names from File
 */
export function extractUniqueSalesmen(
  rows: Record<string, any>[],
  columnMapping: Record<string, string>
): string[] {
  // Find which uploaded header corresponds to 'assigned_salesman' or 'owner'
  const salesmanHeader = Object.entries(columnMapping).find(
    ([_, schemaKey]) => schemaKey === 'assigned_salesman' || schemaKey === 'owner'
  )?.[0];

  if (!salesmanHeader) return [];

  const uniqueSet = new Set<string>();
  rows.forEach((row) => {
    const val = row[salesmanHeader];
    if (val && String(val).trim()) {
      uniqueSet.add(String(val).trim());
    }
  });

  return Array.from(uniqueSet);
}

/**
 * 4. Auto-match File Salesmen to ZaynOps Team Members in Company
 */
export function autoMatchSalesmen(
  uniqueFileSalesmen: string[],
  teamUsers: UserProfile[]
): Record<string, { userId: string; userName: string; matchedBy: 'exact' | 'partial' | 'email' | 'none' }> {
  const result: Record<string, { userId: string; userName: string; matchedBy: 'exact' | 'partial' | 'email' | 'none' }> = {};

  uniqueFileSalesmen.forEach((raw) => {
    const clean = raw.trim().toLowerCase();
    
    // 1. Exact Email match
    const emailMatch = teamUsers.find((u) => u.email && u.email.toLowerCase() === clean);
    if (emailMatch) {
      result[raw] = { userId: emailMatch.id, userName: emailMatch.full_name, matchedBy: 'email' };
      return;
    }

    // 2. Exact Full Name match
    const exactNameMatch = teamUsers.find((u) => u.full_name && u.full_name.toLowerCase() === clean);
    if (exactNameMatch) {
      result[raw] = { userId: exactNameMatch.id, userName: exactNameMatch.full_name, matchedBy: 'exact' };
      return;
    }

    // 3. Partial or First Name match
    const partialMatch = teamUsers.find((u) => {
      const uName = (u.full_name || '').toLowerCase();
      return uName.includes(clean) || clean.includes(uName);
    });
    if (partialMatch) {
      result[raw] = { userId: partialMatch.id, userName: partialMatch.full_name, matchedBy: 'partial' };
      return;
    }

    // 4. No automatic match found
    result[raw] = { userId: '', userName: '', matchedBy: 'none' };
  });

  return result;
}

/**
 * 5. Normalize and Validate Every Row against Schema & Existing Company CRM Data
 */
export function validateAndDetectDuplicates(
  rows: Record<string, any>[],
  columnMapping: Record<string, string>,
  importType: ImportType,
  existingLeads: LeadRecord[],
  existingClients: ClientRecord[],
  teamUsers: UserProfile[],
  salesmanMapping: Record<string, string>,
  fallbackSalesmanId: string,
  mode: ImportMode,
  duplicateAction: DuplicateResolutionAction,
  companyId: string,
  currentUserId: string,
  currentUserName: string
): {
  results: ParsedRowResult[];
  summary: ValidationSummary;
} {
  const results: ParsedRowResult[] = [];

  // Filter existing records to the company scope
  const companyLeads = existingLeads.filter(
    (l) => l.company_id === companyId || !l.company_id
  );
  const companyClients = existingClients.filter(
    (c) => c.company_id === companyId || !c.company_id
  );

  // Pre-index existing data for rapid matching
  const leadPhoneMap = new Map<string, LeadRecord>();
  const leadEmailMap = new Map<string, LeadRecord>();
  const leadCompanyMap = new Map<string, LeadRecord>();

  companyLeads.forEach((l) => {
    if (l.record_status === 'merged') return;
    const p = normalizePhone(l.phone);
    const wa = normalizePhone(l.whatsapp);
    const em = normalizeEmail(l.email);
    const comp = normalizeCompanyName(l.company_name);

    if (p) leadPhoneMap.set(p, l);
    if (wa) leadPhoneMap.set(wa, l);
    if (em) leadEmailMap.set(em, l);
    if (comp) leadCompanyMap.set(comp, l);
  });

  const clientPhoneMap = new Map<string, ClientRecord>();
  const clientEmailMap = new Map<string, ClientRecord>();
  const clientCompanyMap = new Map<string, ClientRecord>();

  companyClients.forEach((c) => {
    if (c.record_status === 'merged') return;
    const p = normalizePhone(c.phone);
    const wa = normalizePhone(c.whatsapp);
    const em = normalizeEmail(c.email);
    const comp = normalizeCompanyName(c.company_name);

    if (p) clientPhoneMap.set(p, c);
    if (wa) clientPhoneMap.set(wa, c);
    if (em) clientEmailMap.set(em, c);
    if (comp) clientCompanyMap.set(comp, c);
  });

  // Resolve fallback user details
  const fallbackUser = teamUsers.find((u) => u.id === fallbackSalesmanId) || {
    id: currentUserId,
    full_name: currentUserName,
  };

  // Helper to resolve salesman UID and Name from mapping or fallback
  const resolveSalesman = (rawInput?: string): { uid: string; name: string; isUnassigned: boolean } => {
    if (!rawInput || !rawInput.trim()) {
      return {
        uid: fallbackUser.id,
        name: fallbackUser.full_name,
        isUnassigned: fallbackUser.id === 'unassigned',
      };
    }

    const trimmed = rawInput.trim();
    const mappedId = salesmanMapping[trimmed];

    if (mappedId === 'unassigned') {
      return { uid: 'unassigned', name: 'Unassigned', isUnassigned: true };
    }

    if (mappedId) {
      const user = teamUsers.find((u) => u.id === mappedId);
      if (user) {
        return { uid: user.id, name: user.full_name, isUnassigned: false };
      }
    }

    // Direct lookup by name/email
    const clean = trimmed.toLowerCase();
    const directUser = teamUsers.find(
      (u) =>
        u.id.toLowerCase() === clean ||
        u.email?.toLowerCase() === clean ||
        u.full_name?.toLowerCase() === clean
    );
    if (directUser) {
      return { uid: directUser.id, name: directUser.full_name, isUnassigned: false };
    }

    return {
      uid: fallbackUser.id,
      name: fallbackUser.full_name,
      isUnassigned: fallbackUser.id === 'unassigned',
    };
  };

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let possibleDuplicateCount = 0;
  let newClientsCount = 0;
  let existingClientsCount = 0;
  let newLeadsCount = 0;
  let linkedLeadsCount = 0;
  let unassignedCount = 0;
  let toCreateCount = 0;
  let toUpdateCount = 0;
  let toSkipCount = 0;

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // 1-indexed, accounting for header row
    const errors: ImportRowError[] = [];
    const warnings: string[] = [];
    const mapped: Record<string, any> = {};

    // Apply column mapping
    Object.entries(columnMapping).forEach(([uploadedHeader, schemaKey]) => {
      if (schemaKey && rawRow[uploadedHeader] !== undefined) {
        mapped[schemaKey] = rawRow[uploadedHeader];
      }
    });

    // Extract raw strings
    const rawCompanyName = String(mapped.company_name || '').trim();
    const rawContactPerson = String(mapped.contact_person || '').trim();
    const rawPhone = String(mapped.phone || '').trim();
    const rawWhatsApp = String(mapped.whatsapp || '').trim();
    const rawEmail = String(mapped.email || '').trim();
    const rawLocation = String(mapped.location || '').trim();
    const rawAddress = String(mapped.address || '').trim();
    const rawNotes = String(mapped.notes || '').trim();
    const rawSalesman = String(mapped.assigned_salesman || mapped.owner || '').trim();

    // Data Normalization
    const normCompany = normalizeCompanyName(rawCompanyName);
    const normContact = normalizeContactPerson(rawContactPerson);
    const normPhone = normalizePhone(rawPhone);
    const normWhatsApp = normalizePhone(rawWhatsApp);
    const normEmail = normalizeEmail(rawEmail);

    // Validation: Company Name (Mandatory)
    if (!rawCompanyName) {
      errors.push({
        rowNumber,
        field: 'Company Name',
        problem: 'Company Name is mandatory and missing.',
        suggestedCorrection: 'Provide a valid business or client organization name.',
        rawData: rawRow,
      });
    }

    // Validation: Email Syntax
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      errors.push({
        rowNumber,
        field: 'Email',
        problem: `Invalid email address syntax: "${rawEmail}".`,
        suggestedCorrection: 'Use standard email formatting (e.g. contact@domain.com).',
        rawData: rawRow,
      });
    }

    // Validation: Contact Warning
    if (!rawPhone && !rawWhatsApp && !rawEmail) {
      warnings.push('No telephone, WhatsApp, or email address provided.');
    }

    // Estimated Value parsing
    let parsedEstimatedValue: number | undefined;
    if (mapped.estimated_value !== undefined && String(mapped.estimated_value).trim() !== '') {
      const cleanNumStr = String(mapped.estimated_value).replace(/[^0-9.]/g, '');
      const val = parseFloat(cleanNumStr);
      if (isNaN(val) || val < 0) {
        warnings.push(`Invalid estimated value "${mapped.estimated_value}". Set to 0.`);
        parsedEstimatedValue = 0;
      } else {
        parsedEstimatedValue = val;
      }
    }

    // Normalize Status & Priority for Leads
    let normalizedPriority: Priority = 'Warm';
    let normalizedLeadStatus: LeadStatus = 'New';
    const rawPriority = String(mapped.priority || '').trim();
    if (rawPriority) {
      const matchPri = VALID_PRIORITIES.find((p) => p.toLowerCase() === rawPriority.toLowerCase());
      if (matchPri) {
        normalizedPriority = matchPri;
      } else {
        warnings.push(`Unrecognized priority "${rawPriority}"; defaulted to Warm.`);
      }
    }

    const rawStatus = String(mapped.status || mapped.lead_status || '').trim();
    if (rawStatus) {
      const matchStat = VALID_LEAD_STATUSES.find((s) => s.toLowerCase() === rawStatus.toLowerCase());
      if (matchStat) {
        normalizedLeadStatus = matchStat;
      } else {
        warnings.push(`Unrecognized stage "${rawStatus}"; defaulted to New.`);
      }
    }

    // Normalize Client Status
    let normalizedClientStatus: ClientStatus = 'Active';
    const rawClientStatus = String(mapped.client_status || mapped.status || '').trim().toLowerCase();
    if (rawClientStatus === 'inactive') {
      normalizedClientStatus = 'Inactive';
    }

    // Resolve Salesman
    const resolvedSalesman = resolveSalesman(rawSalesman);
    if (resolvedSalesman.isUnassigned) {
      unassignedCount++;
    }

    // 6. Multi-level Duplicate Detection & Existing Client Linking
    let classification: DuplicateClassification = 'new';
    let isDuplicate = false;
    let isPossibleDuplicate = false;
    let duplicateRecordId: string | undefined;
    let duplicateRecordName: string | undefined;
    let duplicateReason: string | undefined;

    let linkedClientId: string | undefined;
    let linkedClientName: string | undefined;

    // Check against existing clients first (for linking or client duplicate detection)
    const exactClientMatch =
      (normPhone && clientPhoneMap.get(normPhone)) ||
      (normWhatsApp && clientPhoneMap.get(normWhatsApp)) ||
      (normEmail && clientEmailMap.get(normEmail));

    const companyClientMatch = normCompany ? clientCompanyMap.get(normCompany) : undefined;

    if (exactClientMatch) {
      linkedClientId = exactClientMatch.id;
      linkedClientName = exactClientMatch.company_name;
      existingClientsCount++;
      if (importType === 'clients') {
        isDuplicate = true;
        classification = 'exact_duplicate';
        duplicateRecordId = exactClientMatch.id;
        duplicateRecordName = exactClientMatch.company_name;
        duplicateReason = `Matches existing Client contact details (${exactClientMatch.phone || exactClientMatch.email})`;
      }
    } else if (companyClientMatch) {
      linkedClientId = companyClientMatch.id;
      linkedClientName = companyClientMatch.company_name;
      existingClientsCount++;
      if (importType === 'clients') {
        isPossibleDuplicate = true;
        classification = 'possible_duplicate';
        duplicateRecordId = companyClientMatch.id;
        duplicateRecordName = companyClientMatch.company_name;
        duplicateReason = `Matches existing Client company name: "${companyClientMatch.company_name}"`;
      }
    } else {
      if (importType === 'clients' || importType === 'clients_and_leads') {
        newClientsCount++;
      }
    }

    // Check Leads duplicates if importing leads or combined
    if (importType === 'leads' || importType === 'clients_and_leads') {
      const exactLeadMatch =
        (normPhone && leadPhoneMap.get(normPhone)) ||
        (normWhatsApp && leadPhoneMap.get(normWhatsApp)) ||
        (normEmail && leadEmailMap.get(normEmail));

      const companyLeadMatch = normCompany ? leadCompanyMap.get(normCompany) : undefined;

      if (exactLeadMatch) {
        isDuplicate = true;
        classification = 'exact_duplicate';
        duplicateRecordId = exactLeadMatch.id;
        duplicateRecordName = exactLeadMatch.company_name;
        duplicateReason = normPhone && phonesMatch(exactLeadMatch.phone, normPhone)
          ? `Matches existing Lead phone (${exactLeadMatch.phone})`
          : normEmail && normalizeEmail(exactLeadMatch.email) === normEmail
          ? `Matches existing Lead email (${exactLeadMatch.email})`
          : 'Matches existing Lead contact number';
      } else if (companyLeadMatch) {
        isPossibleDuplicate = true;
        classification = 'possible_duplicate';
        duplicateRecordId = companyLeadMatch.id;
        duplicateRecordName = companyLeadMatch.company_name;
        duplicateReason = `Matches existing Lead company name: "${companyLeadMatch.company_name}"`;
      } else {
        newLeadsCount++;
      }

      if (linkedClientId) {
        linkedLeadsCount++;
      }
    }

    // If severe errors, classify as invalid
    if (errors.length > 0) {
      classification = 'invalid';
      errorCount++;
    } else if (isDuplicate) {
      duplicateCount++;
    } else if (isPossibleDuplicate) {
      possibleDuplicateCount++;
    }

    // 7. Resolve Final Action
    let resolvedAction: 'create' | 'update' | 'skip' | 'error' = 'create';

    if (classification === 'invalid') {
      resolvedAction = 'error';
    } else if (classification === 'exact_duplicate' || classification === 'possible_duplicate') {
      if (duplicateAction === 'skip') {
        resolvedAction = 'skip';
        toSkipCount++;
      } else if (duplicateAction === 'import_anyway') {
        resolvedAction = 'create';
        toCreateCount++;
      } else if (duplicateAction === 'update_existing' || mode === 'create_and_update') {
        resolvedAction = 'update';
        toUpdateCount++;
      }
    } else {
      resolvedAction = 'create';
      toCreateCount++;
    }

    if (errors.length === 0) {
      validCount++;
    }
    if (warnings.length > 0) {
      warningCount++;
    }

    // Build the final normalized record
    const normalizedData: Record<string, any> = {
      company_name: rawCompanyName,
      contact_person: rawContactPerson || undefined,
      phone: rawPhone || undefined,
      whatsapp: rawWhatsApp || undefined,
      email: normEmail || undefined,
      location: rawLocation || undefined,
      address: rawAddress || undefined,
      notes: rawNotes || undefined,
      normalized_phone: normPhone || undefined,
      normalized_whatsapp: normWhatsApp || undefined,
      normalized_email: normEmail || undefined,
      normalized_company_name: normCompany || undefined,
    };

    if (importType === 'leads' || importType === 'clients_and_leads') {
      normalizedData.lead_type = mapped.lead_type || 'Commercial Client';
      normalizedData.source = mapped.source || 'Bulk Import';
      normalizedData.priority = normalizedPriority;
      normalizedData.status = normalizedLeadStatus;
      normalizedData.project_name = mapped.project_name || undefined;
      normalizedData.project_type = mapped.project_type || undefined;
      normalizedData.project_location = mapped.project_location || undefined;
      normalizedData.requirement = mapped.requirement || undefined;
      normalizedData.estimated_value = parsedEstimatedValue;
      normalizedData.expected_closing_date = mapped.expected_closing_date || undefined;
      normalizedData.next_followup_date = mapped.next_followup_date || undefined;
      normalizedData.assigned_to = resolvedSalesman.uid === 'unassigned' ? '' : resolvedSalesman.uid;
      normalizedData.assigned_to_name = resolvedSalesman.name;
    }

    if (importType === 'clients' || importType === 'clients_and_leads') {
      normalizedData.client_status = normalizedClientStatus;
      normalizedData.owner_id = resolvedSalesman.uid === 'unassigned' ? '' : resolvedSalesman.uid;
      normalizedData.owner_name = resolvedSalesman.name;
      normalizedData.tags = mapped.tags
        ? String(mapped.tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
    }

    results.push({
      rowNumber,
      raw: rawRow,
      normalized: normalizedData,
      isValid: errors.length === 0,
      errors,
      warnings,
      classification,
      isDuplicate,
      isPossibleDuplicate,
      duplicateRecordId,
      duplicateRecordName,
      duplicateReason,
      linkedClientId,
      linkedClientName,
      rawSalesman,
      assignedSalesmanId: resolvedSalesman.uid,
      assignedSalesmanName: resolvedSalesman.name,
      resolvedAction,
    });
  });

  const summary: ValidationSummary = {
    totalRows: rows.length,
    validRows: validCount,
    warningRows: warningCount,
    errorRows: errorCount,
    duplicateRows: duplicateCount,
    possibleDuplicates: possibleDuplicateCount,
    newClients: newClientsCount,
    existingClients: existingClientsCount,
    newLeads: newLeadsCount,
    linkedLeads: linkedLeadsCount,
    unassignedCount,
    toCreate: toCreateCount,
    toUpdate: toUpdateCount,
    toSkip: toSkipCount,
  };

  return { results, summary };
}

/**
 * 6. Execute Safe Batched Import Writes
 * Writes records to Firestore in batches of up to 50 items.
 * Preserves ownership and history fields on update.
 * Logs Audit Log and Import Job records.
 */
export async function executeBatchedImport(
  parsedRows: ParsedRowResult[],
  importType: ImportType,
  fileName: string,
  fileType: 'csv' | 'xlsx',
  companyId: string,
  currentUser: { uid: string; name: string; email: string },
  mode: ImportMode,
  duplicateAction: DuplicateResolutionAction,
  salesmanMapping: Record<string, string>,
  onProgress: (current: number, total: number) => void
): Promise<ImportJobRecord> {
  const jobId = `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const startedAt = new Date().toISOString();

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let newClientsCount = 0;
  let newLeadsCount = 0;
  let linkedLeadsCount = 0;
  const errorDetails: ImportRowError[] = [];

  // Log Audit start
  try {
    await createAuditLog({
      action: importType === 'leads' ? 'lead_imported' : 'client_imported',
      entity_type: importType === 'leads' ? 'Lead' : 'Client',
      entity_id: jobId,
      company_id: companyId,
      performed_by: currentUser.uid,
      performed_by_name: currentUser.name,
      performed_by_role: 'ADMIN',
      description: `Company Admin ${currentUser.name} initiated ${importType.replace(/_/g, ' ')} bulk import from "${fileName}" (${parsedRows.length} total rows).`,
      metadata: { jobId, fileName, importType, companyId, totalRows: parsedRows.length },
    });
  } catch (e) {}

  // Filter actionable rows
  const actionableRows = parsedRows.filter(
    (r) => r.resolvedAction === 'create' || r.resolvedAction === 'update'
  );

  skippedCount += parsedRows.filter((r) => r.resolvedAction === 'skip').length;
  parsedRows
    .filter((r) => r.resolvedAction === 'error')
    .forEach((r) => {
      failedCount++;
      errorDetails.push(...r.errors);
    });

  const BATCH_SIZE = 50;
  let processed = 0;

  // Track created records for instantaneous local reactivity
  const createdLeadsLocal: any[] = [];
  const createdClientsLocal: any[] = [];
  const updatedLeadsLocal: any[] = [];
  const updatedClientsLocal: any[] = [];

  for (let i = 0; i < actionableRows.length; i += BATCH_SIZE) {
    const chunk = actionableRows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((item) => {
      const now = new Date().toISOString();

      if (importType === 'leads') {
        if (item.resolvedAction === 'create') {
          const newDocRef = doc(collection(db, 'leads'));
          const leadPayload = {
            ...item.normalized,
            id: newDocRef.id,
            company_id: companyId,
            client_id: item.linkedClientId || undefined,
            created_by: currentUser.uid,
            created_at: now,
            updated_at: now,
            record_status: 'active',
          };
          batch.set(newDocRef, leadPayload);
          createdLeadsLocal.push(leadPayload);

          // Add Initial Activity
          const actRef = doc(collection(db, `leads/${newDocRef.id}/activities`));
          batch.set(actRef, {
            id: actRef.id,
            lead_id: newDocRef.id,
            company_id: companyId,
            activity_type: 'Lead Created',
            description: `Lead imported from file "${fileName}".`,
            performed_by: currentUser.uid,
            performed_by_name: currentUser.name,
            activity_date: now,
            created_by: currentUser.uid,
            created_at: now,
          });

          createdCount++;
          newLeadsCount++;
          if (item.linkedClientId) linkedLeadsCount++;
        } else if (item.resolvedAction === 'update' && item.duplicateRecordId) {
          const docRef = doc(db, 'leads', item.duplicateRecordId);
          // SAFE UPDATE: NEVER overwrite created_by, created_at, converted_to_client_id
          const safeUpdate: Record<string, any> = {
            updated_at: now,
          };
          if (item.normalized.contact_person) safeUpdate.contact_person = item.normalized.contact_person;
          if (item.normalized.phone) safeUpdate.phone = item.normalized.phone;
          if (item.normalized.whatsapp) safeUpdate.whatsapp = item.normalized.whatsapp;
          if (item.normalized.email) safeUpdate.email = item.normalized.email;
          if (item.normalized.location) safeUpdate.location = item.normalized.location;
          if (item.normalized.notes) safeUpdate.notes = item.normalized.notes;
          if (item.normalized.priority) safeUpdate.priority = item.normalized.priority;
          if (item.normalized.status) safeUpdate.status = item.normalized.status;
          if (item.normalized.estimated_value) safeUpdate.estimated_value = item.normalized.estimated_value;
          if (item.normalized.requirement) safeUpdate.requirement = item.normalized.requirement;
          if (item.linkedClientId) safeUpdate.client_id = item.linkedClientId;

          batch.update(docRef, safeUpdate);
          updatedLeadsLocal.push({ id: item.duplicateRecordId, ...safeUpdate });

          // Add Update Activity
          const actRef = doc(collection(db, `leads/${item.duplicateRecordId}/activities`));
          batch.set(actRef, {
            id: actRef.id,
            lead_id: item.duplicateRecordId,
            company_id: companyId,
            activity_type: 'Note',
            description: `Lead details updated via bulk migration (${fileName}).`,
            performed_by: currentUser.uid,
            performed_by_name: currentUser.name,
            activity_date: now,
            created_by: currentUser.uid,
            created_at: now,
          });

          updatedCount++;
        }
      } else if (importType === 'clients') {
        if (item.resolvedAction === 'create') {
          const newDocRef = doc(collection(db, 'clients'));
          const clientPayload = {
            ...item.normalized,
            id: newDocRef.id,
            company_id: companyId,
            status: item.normalized.client_status || 'Active',
            source_lead_id: '',
            created_by: currentUser.uid,
            created_at: now,
            updated_at: now,
            record_status: 'active',
          };
          batch.set(newDocRef, clientPayload);
          createdClientsLocal.push(clientPayload);
          createdCount++;
          newClientsCount++;
        } else if (item.resolvedAction === 'update' && item.duplicateRecordId) {
          const docRef = doc(db, 'clients', item.duplicateRecordId);
          const safeUpdate: Record<string, any> = {
            updated_at: now,
          };
          if (item.normalized.contact_person) safeUpdate.contact_person = item.normalized.contact_person;
          if (item.normalized.phone) safeUpdate.phone = item.normalized.phone;
          if (item.normalized.whatsapp) safeUpdate.whatsapp = item.normalized.whatsapp;
          if (item.normalized.email) safeUpdate.email = item.normalized.email;
          if (item.normalized.location) safeUpdate.location = item.normalized.location;
          if (item.normalized.address) safeUpdate.address = item.normalized.address;
          if (item.normalized.notes) safeUpdate.notes = item.normalized.notes;
          if (item.normalized.client_status) safeUpdate.status = item.normalized.client_status;

          batch.update(docRef, safeUpdate);
          updatedClientsLocal.push({ id: item.duplicateRecordId, ...safeUpdate });
          updatedCount++;
        }
      } else if (importType === 'clients_and_leads') {
        // Combined Clients + Leads mode:
        // 1. Establish Client ID (either existing or new)
        let resolvedClientId = item.linkedClientId;

        if (!resolvedClientId) {
          const clientDocRef = doc(collection(db, 'clients'));
          resolvedClientId = clientDocRef.id;
          const clientPayload = {
            id: clientDocRef.id,
            company_id: companyId,
            company_name: item.normalized.company_name,
            contact_person: item.normalized.contact_person || '',
            phone: item.normalized.phone || '',
            whatsapp: item.normalized.whatsapp || '',
            email: item.normalized.email || '',
            location: item.normalized.location || '',
            address: item.normalized.address || '',
            notes: item.normalized.notes || '',
            status: item.normalized.client_status || 'Active',
            tags: item.normalized.tags || [],
            owner_id: item.normalized.owner_id || '',
            owner_name: item.normalized.owner_name || '',
            created_by: currentUser.uid,
            created_at: now,
            updated_at: now,
            record_status: 'active',
          };
          batch.set(clientDocRef, clientPayload);
          createdClientsLocal.push(clientPayload);
          newClientsCount++;
        } else if (item.resolvedAction === 'update') {
          // Update approved client fields
          const clientDocRef = doc(db, 'clients', resolvedClientId);
          const safeClientUpdate: Record<string, any> = { updated_at: now };
          if (item.normalized.phone) safeClientUpdate.phone = item.normalized.phone;
          if (item.normalized.email) safeClientUpdate.email = item.normalized.email;
          if (item.normalized.contact_person) safeClientUpdate.contact_person = item.normalized.contact_person;
          batch.update(clientDocRef, safeClientUpdate);
          updatedClientsLocal.push({ id: resolvedClientId, ...safeClientUpdate });
        }

        // 2. Create the associated Lead attached to this Client
        const leadDocRef = doc(collection(db, 'leads'));
        const leadPayload = {
          id: leadDocRef.id,
          company_id: companyId,
          client_id: resolvedClientId,
          company_name: item.normalized.company_name,
          contact_person: item.normalized.contact_person || '',
          phone: item.normalized.phone || '',
          whatsapp: item.normalized.whatsapp || '',
          email: item.normalized.email || '',
          location: item.normalized.location || '',
          address: item.normalized.address || '',
          lead_type: item.normalized.lead_type || 'Commercial Client',
          source: item.normalized.source || 'Bulk Migration',
          priority: item.normalized.priority || 'Warm',
          status: item.normalized.status || 'New',
          project_name: item.normalized.project_name || '',
          project_type: item.normalized.project_type || '',
          project_location: item.normalized.project_location || '',
          requirement: item.normalized.requirement || '',
          estimated_value: item.normalized.estimated_value || 0,
          expected_closing_date: item.normalized.expected_closing_date || '',
          next_followup_date: item.normalized.next_followup_date || '',
          assigned_to: item.normalized.assigned_to || '',
          assigned_to_name: item.normalized.assigned_to_name || '',
          notes: item.normalized.notes || '',
          created_by: currentUser.uid,
          created_at: now,
          updated_at: now,
          record_status: 'active',
        };
        batch.set(leadDocRef, leadPayload);
        createdLeadsLocal.push(leadPayload);

        // Add Initial Activity
        const actRef = doc(collection(db, `leads/${leadDocRef.id}/activities`));
        batch.set(actRef, {
          id: actRef.id,
          lead_id: leadDocRef.id,
          company_id: companyId,
          activity_type: 'Lead Created',
          description: `Lead created from combined migration file "${fileName}". Linked to Client "${item.normalized.company_name}".`,
          performed_by: currentUser.uid,
          performed_by_name: currentUser.name,
          activity_date: now,
          created_by: currentUser.uid,
          created_at: now,
        });

        createdCount++;
        newLeadsCount++;
        linkedLeadsCount++;
      }
    });

    try {
      await batch.commit();
      processed += chunk.length;
      onProgress(processed, actionableRows.length);
    } catch (batchError: any) {
      console.error('Batch commit failed for chunk:', batchError);
      failedCount += chunk.length;
      errorDetails.push({
        rowNumber: i + 1,
        problem: `Database batch write failure: ${batchError.message || 'Unknown network error'}`,
        suggestedCorrection: 'Check permissions and network connectivity',
      });
    }
  }

  // Synchronize Local Storage for instantaneous responsiveness
  if (typeof localStorage !== 'undefined') {
    try {
      if (createdLeadsLocal.length > 0 || updatedLeadsLocal.length > 0) {
        const raw = localStorage.getItem('crm_local_leads_v2');
        let leads = raw ? JSON.parse(raw) : [];
        if (createdLeadsLocal.length > 0) {
          leads = [...createdLeadsLocal, ...leads];
        }
        if (updatedLeadsLocal.length > 0) {
          updatedLeadsLocal.forEach((up) => {
            const idx = leads.findIndex((l: any) => l.id === up.id);
            if (idx >= 0) leads[idx] = { ...leads[idx], ...up };
          });
        }
        localStorage.setItem('crm_local_leads_v2', JSON.stringify(leads));
        window.dispatchEvent(new CustomEvent('crm_leads_changed'));
      }

      if (createdClientsLocal.length > 0 || updatedClientsLocal.length > 0) {
        const raw = localStorage.getItem('crm_local_clients_v2');
        let clients = raw ? JSON.parse(raw) : [];
        if (createdClientsLocal.length > 0) {
          clients = [...createdClientsLocal, ...clients];
        }
        if (updatedClientsLocal.length > 0) {
          updatedClientsLocal.forEach((up) => {
            const idx = clients.findIndex((c: any) => c.id === up.id);
            if (idx >= 0) clients[idx] = { ...clients[idx], ...up };
          });
        }
        localStorage.setItem('crm_local_clients_v2', JSON.stringify(clients));
        window.dispatchEvent(new CustomEvent('crm_clients_changed'));
      }
    } catch (e) {
      console.warn('Local storage sync warning:', e);
    }
  }

  const completedAt = new Date().toISOString();
  let jobStatus: ImportJobRecord['status'] = 'Completed';
  if (failedCount > 0 && (createdCount > 0 || updatedCount > 0)) {
    jobStatus = 'Completed With Errors';
  } else if (failedCount > 0 && createdCount === 0 && updatedCount === 0) {
    jobStatus = 'Failed';
  }

  const jobRecord: ImportJobRecord = {
    id: jobId,
    company_id: companyId,
    import_type: importType,
    file_name: fileName,
    file_type: fileType,
    initiated_by: currentUser.uid,
    initiated_by_name: currentUser.name,
    started_at: startedAt,
    completed_at: completedAt,
    total_rows: parsedRows.length,
    created_count: createdCount,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    error_count: failedCount,
    new_clients_count: newClientsCount,
    new_leads_count: newLeadsCount,
    linked_leads_count: linkedLeadsCount,
    status: jobStatus,
    mode,
    duplicate_action: duplicateAction,
    salesman_mapping: salesmanMapping,
    error_details: errorDetails.length > 0 ? errorDetails.slice(0, 50) : undefined,
  };

  // Record to import_jobs in Firestore
  try {
    const jobDocRef = doc(db, 'import_jobs', jobId);
    await setDoc(jobDocRef, jobRecord);
  } catch (err) {
    console.warn('Could not persist import_jobs record to Firestore:', err);
  }

  // Keep in local cache
  try {
    const localJobs = JSON.parse(localStorage.getItem('crm_local_import_jobs_v1') || '[]');
    localJobs.unshift(jobRecord);
    localStorage.setItem('crm_local_import_jobs_v1', JSON.stringify(localJobs));
    window.dispatchEvent(new CustomEvent('crm_import_jobs_changed'));
  } catch (e) {}

  // Log to Audit Log
  try {
    await createAuditLog({
      action: importType === 'leads' ? 'lead_imported' : 'client_imported',
      entity_type: importType === 'leads' ? 'Lead' : 'Client',
      entity_id: jobId,
      company_id: companyId,
      performed_by: currentUser.uid,
      performed_by_name: currentUser.name,
      performed_by_role: 'ADMIN',
      description: `Admin ${currentUser.name} completed ${importType.replace(/_/g, ' ')} migration: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} errors. Status: ${jobStatus}.`,
      metadata: {
        jobId,
        companyId,
        createdCount,
        updatedCount,
        skippedCount,
        failedCount,
        newClientsCount,
        newLeadsCount,
        linkedLeadsCount,
        status: jobStatus,
      },
    });
  } catch (e) {}

  return jobRecord;
}
