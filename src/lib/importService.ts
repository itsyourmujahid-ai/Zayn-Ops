/**
 * Phase V — Import Service
 * Handles CSV/XLSX parsing, auto column mapping, normalization, duplicate detection,
 * batched Firestore persistence, error reporting, and import jobs logging.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ImportType,
  ImportMode,
  DuplicateResolutionAction,
  ParsedRowResult,
  ValidationSummary,
  ImportRowError,
  ImportJobRecord,
} from '../types/dataManagement';
import { LEAD_COLUMNS, CLIENT_COLUMNS } from './importTemplates';
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { createAuditLog, createNotification } from './dal';

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

/**
 * 1. Parse File into Raw Rows and Headers (CSV or XLSX)
 */
export async function parseImportFile(file: File): Promise<{
  headers: string[];
  rows: Record<string, any>[];
  fileType: 'csv' | 'xlsx';
}> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      header: 1,
      defval: '',
    }) as any[][];

    if (!rawData || rawData.length === 0) {
      throw new Error('The uploaded Excel file appears to be empty.');
    }

    const headerRow = rawData[0].map((h) => String(h || '').trim()).filter(Boolean);
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

    return { headers: headerRow, rows: dataRows, fileType: 'xlsx' };
  }

  // Default to CSV Parsing
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = (results.data as Record<string, any>[]).filter((row) =>
          Object.values(row).some((val) => val && String(val).trim() !== '')
        );
        resolve({ headers, rows, fileType: 'csv' });
      },
      error: (err) => reject(err),
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
  const definitions = importType === 'leads' ? LEAD_COLUMNS : CLIENT_COLUMNS;
  const mapping: Record<string, string> = {};

  uploadedHeaders.forEach((uploadedHeader) => {
    const cleanHeader = uploadedHeader.toLowerCase().replace(/[^a-z0-9]/g, '');

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
 * 3. Normalize and Validate Every Row against Schema & Existing CRM Data
 */
export function validateAndDetectDuplicates(
  rows: Record<string, any>[],
  columnMapping: Record<string, string>,
  importType: ImportType,
  existingLeads: LeadRecord[],
  existingClients: ClientRecord[],
  teamUsers: UserProfile[],
  mode: ImportMode,
  duplicateAction: DuplicateResolutionAction,
  currentUserId: string,
  currentUserName: string
): {
  results: ParsedRowResult[];
  summary: ValidationSummary;
} {
  const results: ParsedRowResult[] = [];

  // Pre-index existing data for rapid matching
  const leadPhoneMap = new Map<string, LeadRecord>();
  const leadEmailMap = new Map<string, LeadRecord>();
  const leadCompanyMap = new Map<string, LeadRecord>();

  existingLeads.forEach((l) => {
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

  existingClients.forEach((c) => {
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

  // Helper to resolve salesman UID from name or email
  const resolveSalesman = (rawInput?: string): { uid: string; name: string } => {
    if (!rawInput || !rawInput.trim()) {
      return { uid: currentUserId, name: currentUserName };
    }
    const clean = rawInput.trim().toLowerCase();
    const found = teamUsers.find(
      (u) =>
        u.id.toLowerCase() === clean ||
        u.email.toLowerCase() === clean ||
        u.full_name.toLowerCase() === clean ||
        u.full_name.toLowerCase().includes(clean)
    );
    if (found) {
      return { uid: found.id, name: found.full_name };
    }
    return { uid: currentUserId, name: currentUserName };
  };

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let toCreateCount = 0;
  let toUpdateCount = 0;
  let toSkipCount = 0;

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // 1-indexed, accounting for header
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
    const rawNotes = String(mapped.notes || '').trim();

    // 9. Data Normalization
    const normCompany = normalizeCompanyName(rawCompanyName);
    const normContact = normalizeContactPerson(rawContactPerson);
    const normPhone = normalizePhone(rawPhone);
    const normWhatsApp = normalizePhone(rawWhatsApp);
    const normEmail = normalizeEmail(rawEmail);

    // Validation: Company Name
    if (!rawCompanyName) {
      errors.push({
        rowNumber,
        field: 'Company Name',
        problem: 'Company Name is mandatory and missing.',
        suggestedCorrection: 'Provide a valid business or organization name.',
        rawData: rawRow,
      });
    }

    // Validation: Contact Info
    if (importType === 'leads') {
      if (!rawPhone && !rawWhatsApp && !rawEmail) {
        warnings.push('No phone, WhatsApp, or email provided for this lead.');
      }
    }

    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      errors.push({
        rowNumber,
        field: 'Email',
        problem: `Invalid email address format: "${rawEmail}".`,
        suggestedCorrection: 'Verify standard email syntax (user@example.com).',
        rawData: rawRow,
      });
    }

    // Normalize Status & Priority for Leads
    let normalizedPriority: Priority = 'Warm';
    let normalizedStatus: LeadStatus = 'New';
    let resolvedSalesman = { uid: currentUserId, name: currentUserName };

    if (importType === 'leads') {
      const rawPriority = String(mapped.priority || '').trim();
      if (rawPriority) {
        const matchPri = VALID_PRIORITIES.find(
          (p) => p.toLowerCase() === rawPriority.toLowerCase()
        );
        if (matchPri) {
          normalizedPriority = matchPri;
        } else {
          warnings.push(`Unrecognized priority "${rawPriority}"; defaulted to Warm.`);
        }
      }

      const rawStatus = String(mapped.status || '').trim();
      if (rawStatus) {
        const matchStat = VALID_LEAD_STATUSES.find(
          (s) => s.toLowerCase() === rawStatus.toLowerCase()
        );
        if (matchStat) {
          normalizedStatus = matchStat;
        } else {
          warnings.push(`Unrecognized stage "${rawStatus}"; defaulted to New.`);
        }
      }

      resolvedSalesman = resolveSalesman(mapped.assigned_salesman);
    }

    // Normalize Status & Owner for Clients
    let normalizedClientStatus: ClientStatus = 'Active';
    if (importType === 'clients') {
      const rawStatus = String(mapped.status || '').trim().toLowerCase();
      if (rawStatus === 'inactive') {
        normalizedClientStatus = 'Inactive';
      }
      resolvedSalesman = resolveSalesman(mapped.owner);
    }

    // 10. Duplicate Detection
    let isDuplicate = false;
    let duplicateRecordId: string | undefined;
    let duplicateRecordName: string | undefined;
    let duplicateReason: string | undefined;

    if (importType === 'leads') {
      // Check phone/whatsapp
      let matchedLead =
        (normPhone && leadPhoneMap.get(normPhone)) ||
        (normWhatsApp && leadPhoneMap.get(normWhatsApp)) ||
        (normEmail && leadEmailMap.get(normEmail));

      if (matchedLead) {
        isDuplicate = true;
        duplicateRecordId = matchedLead.id;
        duplicateRecordName = matchedLead.company_name;
        duplicateReason = normPhone && phonesMatch(matchedLead.phone, normPhone)
          ? `Matches existing lead phone (${matchedLead.phone})`
          : normEmail && normalizeEmail(matchedLead.email) === normEmail
          ? `Matches existing lead email (${matchedLead.email})`
          : 'Matches contact numbers';
      } else if (normCompany && leadCompanyMap.has(normCompany)) {
        const compLead = leadCompanyMap.get(normCompany)!;
        // Secondary match: same company name
        isDuplicate = true;
        duplicateRecordId = compLead.id;
        duplicateRecordName = compLead.company_name;
        duplicateReason = `Matches existing company name: "${compLead.company_name}"`;
      }
    } else {
      // Client duplicates
      let matchedClient =
        (normPhone && clientPhoneMap.get(normPhone)) ||
        (normWhatsApp && clientPhoneMap.get(normWhatsApp)) ||
        (normEmail && clientEmailMap.get(normEmail));

      if (matchedClient) {
        isDuplicate = true;
        duplicateRecordId = matchedClient.id;
        duplicateRecordName = matchedClient.company_name;
        duplicateReason = `Matches existing client contact info (${matchedClient.phone || matchedClient.email})`;
      } else if (normCompany && clientCompanyMap.has(normCompany)) {
        const compClient = clientCompanyMap.get(normCompany)!;
        isDuplicate = true;
        duplicateRecordId = compClient.id;
        duplicateRecordName = compClient.company_name;
        duplicateReason = `Matches existing client company name: "${compClient.company_name}"`;
      }
    }

    // 11. Resolve Action Based on Mode and Duplicate Choice
    let resolvedAction: 'create' | 'update' | 'skip' | 'error' = 'create';

    if (errors.length > 0) {
      resolvedAction = 'error';
      errorCount++;
    } else if (isDuplicate) {
      duplicateCount++;
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

    // Build the final normalized payload
    const normalizedData: Record<string, any> = {
      company_name: rawCompanyName,
      contact_person: rawContactPerson || undefined,
      phone: rawPhone || undefined,
      whatsapp: rawWhatsApp || undefined,
      email: normEmail || undefined,
      location: rawLocation || undefined,
      notes: rawNotes || undefined,
      normalized_phone: normPhone || undefined,
      normalized_whatsapp: normWhatsApp || undefined,
      normalized_email: normEmail || undefined,
      normalized_company_name: normCompany || undefined,
    };

    if (importType === 'leads') {
      normalizedData.lead_type = mapped.lead_type || 'Commercial Client';
      normalizedData.source = mapped.source || 'Bulk Import';
      normalizedData.priority = normalizedPriority;
      normalizedData.status = normalizedStatus;
      normalizedData.project_name = mapped.project_name || undefined;
      normalizedData.project_type = mapped.project_type || undefined;
      normalizedData.project_location = mapped.project_location || undefined;
      normalizedData.requirement = mapped.requirement || undefined;
      normalizedData.estimated_value = mapped.estimated_value ? Number(mapped.estimated_value) || 0 : undefined;
      normalizedData.expected_closing_date = mapped.expected_closing_date || undefined;
      normalizedData.assigned_to = resolvedSalesman.uid;
      normalizedData.assigned_to_name = resolvedSalesman.name;
    } else {
      normalizedData.status = normalizedClientStatus;
      normalizedData.owner_id = resolvedSalesman.uid;
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
      isDuplicate,
      duplicateRecordId,
      duplicateRecordName,
      duplicateReason,
      resolvedAction,
    });
  });

  const summary: ValidationSummary = {
    totalRows: rows.length,
    validRows: validCount,
    warningRows: warningCount,
    errorRows: errorCount,
    duplicateRows: duplicateCount,
    toCreate: toCreateCount,
    toUpdate: toUpdateCount,
    toSkip: toSkipCount,
  };

  return { results, summary };
}

/**
 * 4. Execute Safe Batched Import Writes
 * Writes records to Firestore in batches of up to 50 items.
 * Preserves ownership and history fields on update.
 * Logs Audit Log and Import Job records.
 */
export async function executeBatchedImport(
  parsedRows: ParsedRowResult[],
  importType: ImportType,
  fileName: string,
  fileType: 'csv' | 'xlsx',
  currentUser: { uid: string; name: string; email: string },
  mode: ImportMode,
  duplicateAction: DuplicateResolutionAction,
  onProgress: (current: number, total: number) => void
): Promise<ImportJobRecord> {
  const jobId = `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const startedAt = new Date().toISOString();

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errorDetails: ImportRowError[] = [];

  // Log Audit start
  await createAuditLog({
    action: importType === 'leads' ? 'lead_imported' : 'client_imported',
    entity_type: importType === 'leads' ? 'Lead' : 'Client',
    entity_id: jobId,
    performed_by: currentUser.uid,
    performed_by_name: currentUser.name,
    performed_by_role: 'ADMIN',
    description: `Admin ${currentUser.name} started bulk ${importType} import from file "${fileName}" (${parsedRows.length} total rows).`,
    metadata: { jobId, fileName, importType, totalRows: parsedRows.length },
  });

  // Filter out skipped or invalid rows
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
            created_by: currentUser.uid,
            created_at: now,
            updated_at: now,
            record_status: 'active',
          };
          batch.set(newDocRef, leadPayload);

          // Add Initial Activity
          const actRef = doc(collection(db, `leads/${newDocRef.id}/activities`));
          batch.set(actRef, {
            id: actRef.id,
            lead_id: newDocRef.id,
            activity_type: 'Lead Created',
            description: `Lead created via bulk import (${fileName}).`,
            performed_by: currentUser.uid,
            performed_by_name: currentUser.name,
            activity_date: now,
            created_by: currentUser.uid,
            created_at: now,
          });

          createdCount++;
        } else if (item.resolvedAction === 'update' && item.duplicateRecordId) {
          const docRef = doc(db, 'leads', item.duplicateRecordId);
          // SAFE UPDATE: NEVER overwrite created_by, created_at, converted_to_client_id, source_lead_id
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

          batch.update(docRef, safeUpdate);

          // Add Update Activity
          const actRef = doc(collection(db, `leads/${item.duplicateRecordId}/activities`));
          batch.set(actRef, {
            id: actRef.id,
            lead_id: item.duplicateRecordId,
            activity_type: 'Note',
            description: `Record updated via bulk import (${fileName}).`,
            performed_by: currentUser.uid,
            performed_by_name: currentUser.name,
            activity_date: now,
            created_by: currentUser.uid,
            created_at: now,
          });

          updatedCount++;
        }
      } else {
        // Clients Import
        if (item.resolvedAction === 'create') {
          const newDocRef = doc(collection(db, 'clients'));
          const clientPayload = {
            ...item.normalized,
            id: newDocRef.id,
            source_lead_id: '', // Bulk imported direct client
            created_by: currentUser.uid,
            created_at: now,
            updated_at: now,
            record_status: 'active',
          };
          batch.set(newDocRef, clientPayload);
          createdCount++;
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
          if (item.normalized.notes) safeUpdate.notes = item.normalized.notes;
          if (item.normalized.status) safeUpdate.status = item.normalized.status;

          batch.update(docRef, safeUpdate);
          updatedCount++;
        }
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
        problem: `Firestore batch write failure: ${batchError.message || 'Unknown database error'}`,
        suggestedCorrection: 'Check permissions and network connectivity',
      });
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
    status: jobStatus,
    mode,
    duplicate_action: duplicateAction,
    error_details: errorDetails.length > 0 ? errorDetails.slice(0, 50) : undefined,
  };

  // 16. Record to import_jobs in Firestore
  try {
    const jobDocRef = doc(db, 'import_jobs', jobId);
    await setDoc(jobDocRef, jobRecord);
  } catch (err) {
    console.warn('Could not persist import_jobs record to Firestore:', err);
    // Keep local cache
    try {
      const localJobs = JSON.parse(localStorage.getItem('crm_local_import_jobs_v1') || '[]');
      localJobs.unshift(jobRecord);
      localStorage.setItem('crm_local_import_jobs_v1', JSON.stringify(localJobs));
    } catch (e) {}
  }

  // 17. Log to Audit Log
  await createAuditLog({
    action: importType === 'leads' ? 'lead_imported' : 'client_imported',
    entity_type: importType === 'leads' ? 'Lead' : 'Client',
    entity_id: jobId,
    performed_by: currentUser.uid,
    performed_by_name: currentUser.name,
    performed_by_role: 'ADMIN',
    description: `Admin ${currentUser.name} finished ${importType} import: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} errors. Status: ${jobStatus}.`,
    metadata: {
      jobId,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
      status: jobStatus,
    },
  });

  return jobRecord;
}
