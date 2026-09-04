/**
 * Phase S — Duplicate Detection & Data Quality Management Engine
 * Provides normalized matching, deterministic completeness scoring, and validation.
 */

import {
  LeadRecord,
  ClientRecord,
  DuplicateMatch,
  DuplicateMatchField,
  DataQualityReport,
  DataCompletenessIssue,
  NotDuplicateRecord,
  DuplicateMatchCandidate,
  HygieneIssue,
  DatabaseCompletenessReport,
} from '../types/database';

export type { DuplicateMatchCandidate, HygieneIssue, DatabaseCompletenessReport };

/**
 * 1. Normalized Phone
 * Handles international codes (such as Oman +968, 00968) and standardizes to local comparison digits.
 */
export function normalizePhone(raw?: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // Strip international prefix '00968'
  if (digits.startsWith('00968')) {
    digits = digits.slice(5);
  }
  // Strip '968' if followed by 8 digits (standard Oman mobile/landline)
  if (digits.startsWith('968') && digits.length === 11) {
    digits = digits.slice(3);
  }
  // Strip domestic leading 0 if 9 digits (09xxxxxxx or 07xxxxxxx)
  if (digits.startsWith('0') && digits.length === 9) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Checks if two phone strings represent the same telephone number.
 */
export function phonesMatch(phone1?: string, phone2?: string): boolean {
  if (!phone1 || !phone2) return false;
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  if (!n1 || !n2) return false;
  if (n1.length < 7 || n2.length < 7) return false;

  if (n1 === n2) return true;

  // Check suffix match with country prefix difference (<= 4 digits difference)
  if (n1.endsWith(n2) && n1.length - n2.length <= 4) return true;
  if (n2.endsWith(n1) && n2.length - n1.length <= 4) return true;

  return false;
}

/**
 * 2. Normalized Email
 * Trims whitespace and converts to lower case.
 */
export function normalizeEmail(email?: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * 3. Normalized Company Name
 * Standardizes case, extra spaces, punctuation, and common legal suffixes (LLC, Est, Ltd, etc.).
 */
export function normalizeCompanyName(name?: string): string {
  if (!name) return '';
  let str = name.toLowerCase().trim();

  // Standardize ampersand
  str = str.replace(/&/g, ' and ');

  // Remove common punctuation
  str = str.replace(/[.,\-_/'"()\[\]]/g, ' ');

  // Collapse multiple spaces
  str = str.replace(/\s+/g, ' ').trim();

  // Strip common legal/business entity suffixes at the end of company name
  const legalSuffixes = [
    'llc',
    'l l c',
    'wll',
    'w l l',
    'est',
    'establishment',
    'ltd',
    'limited',
    'co',
    'company',
    'corp',
    'corporation',
    'inc',
    'holding',
    'holdings',
    'saog',
    'saoc',
    'spc',
    'fze',
    'fzc',
  ];

  for (const suffix of legalSuffixes) {
    if (str.endsWith(' ' + suffix)) {
      str = str.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }

  return str;
}

/**
 * 4. Normalized Contact Person
 */
export function normalizeContactPerson(name?: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Generates a deterministic canonical key for a pair of IDs to check dismissed duplicates.
 */
export function getPairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('_');
}

/**
 * Evaluates duplicate match between two records.
 */
export function compareRecords(
  recA: {
    id: string;
    company_name: string;
    contact_person?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  },
  recB: {
    id: string;
    company_name: string;
    contact_person?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  }
): { isDuplicate: boolean; score: number; reasons: string[]; matchedFields: DuplicateMatchField[] } {
  if (recA.id === recB.id) {
    return { isDuplicate: false, score: 0, reasons: [], matchedFields: [] };
  }

  const reasons: string[] = [];
  const matchedFields: DuplicateMatchField[] = [];
  let score = 0;

  // 1. Phone Match (Strong identifier)
  if (recA.phone && recB.phone && phonesMatch(recA.phone, recB.phone)) {
    reasons.push(`Phone number match (${recA.phone} ≈ ${recB.phone})`);
    matchedFields.push('phone');
    score += 50;
  }

  // 2. WhatsApp Match (Strong identifier)
  if (recA.whatsapp && recB.whatsapp && phonesMatch(recA.whatsapp, recB.whatsapp)) {
    reasons.push(`WhatsApp number match (${recA.whatsapp} ≈ ${recB.whatsapp})`);
    matchedFields.push('whatsapp');
    score += 40;
  } else if (
    (recA.phone && recB.whatsapp && phonesMatch(recA.phone, recB.whatsapp)) ||
    (recA.whatsapp && recB.phone && phonesMatch(recA.whatsapp, recB.phone))
  ) {
    reasons.push('Cross-matched Phone and WhatsApp contact numbers');
    matchedFields.push('whatsapp');
    score += 40;
  }

  // 3. Email Match (Strong identifier)
  const normEmailA = normalizeEmail(recA.email);
  const normEmailB = normalizeEmail(recB.email);
  if (normEmailA && normEmailB && normEmailA === normEmailB) {
    reasons.push(`Email address match (${normEmailA})`);
    matchedFields.push('email');
    score += 45;
  }

  // 4. Company Name Match (Secondary identifier)
  const normCompA = normalizeCompanyName(recA.company_name);
  const normCompB = normalizeCompanyName(recB.company_name);
  if (normCompA && normCompB && normCompA.length >= 3 && normCompB.length >= 3) {
    if (normCompA === normCompB) {
      reasons.push(`Normalized company name match ("${normCompA}")`);
      matchedFields.push('company_name');
      score += 40;
    }
  }

  // 5. Contact Person Match (Secondary identifier)
  const normContactA = normalizeContactPerson(recA.contact_person);
  const normContactB = normalizeContactPerson(recB.contact_person);
  if (normContactA && normContactB && normContactA.length >= 3 && normContactB.length >= 3) {
    if (normContactA === normContactB) {
      reasons.push(`Contact person match ("${recA.contact_person}")`);
      matchedFields.push('contact_person');
      score += 20;
    }
  }

  // Duplicate threshold:
  // - Either at least one strong identifier match (score >= 40)
  // - Or company name matches AND contact person matches (score >= 60)
  const isDuplicate =
    matchedFields.includes('phone') ||
    matchedFields.includes('whatsapp') ||
    matchedFields.includes('email') ||
    (matchedFields.includes('company_name') && (score >= 40 || matchedFields.includes('contact_person')));

  return {
    isDuplicate,
    score: Math.min(100, score),
    reasons,
    matchedFields,
  };
}

/**
 * Scans a list of Leads and finds all duplicate pairs.
 */
export function scanLeadDuplicates(
  leads: LeadRecord[],
  dismissedPairKeys: Set<string>
): DuplicateMatch<LeadRecord>[] {
  const activeLeads = leads.filter((l) => l.record_status !== 'merged');
  const duplicateMatches: DuplicateMatch<LeadRecord>[] = [];
  const processedKeys = new Set<string>();

  for (let i = 0; i < activeLeads.length; i++) {
    for (let j = i + 1; j < activeLeads.length; j++) {
      const leadA = activeLeads[i];
      const leadB = activeLeads[j];
      const pairKey = getPairKey(leadA.id, leadB.id);

      if (dismissedPairKeys.has(pairKey) || processedKeys.has(pairKey)) {
        continue;
      }
      processedKeys.add(pairKey);

      const comparison = compareRecords(leadA, leadB);
      if (comparison.isDuplicate) {
        duplicateMatches.push({
          id: pairKey,
          recordA: leadA,
          recordB: leadB,
          score: comparison.score,
          reasons: comparison.reasons,
          matchedFields: comparison.matchedFields,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return duplicateMatches;
}

/**
 * Scans a list of Clients and finds all duplicate pairs.
 */
export function scanClientDuplicates(
  clients: ClientRecord[],
  dismissedPairKeys: Set<string>
): DuplicateMatch<ClientRecord>[] {
  const activeClients = clients.filter((c) => c.record_status !== 'merged');
  const duplicateMatches: DuplicateMatch<ClientRecord>[] = [];
  const processedKeys = new Set<string>();

  for (let i = 0; i < activeClients.length; i++) {
    for (let j = i + 1; j < activeClients.length; j++) {
      const clientA = activeClients[i];
      const clientB = activeClients[j];
      const pairKey = getPairKey(clientA.id, clientB.id);

      if (dismissedPairKeys.has(pairKey) || processedKeys.has(pairKey)) {
        continue;
      }
      processedKeys.add(pairKey);

      const comparison = compareRecords(clientA, clientB);
      if (comparison.isDuplicate) {
        duplicateMatches.push({
          id: pairKey,
          recordA: clientA,
          recordB: clientB,
          score: comparison.score,
          reasons: comparison.reasons,
          matchedFields: comparison.matchedFields,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return duplicateMatches;
}

/**
 * Quick check against existing leads for a newly typed lead in modal.
 */
export function checkLeadAgainstExisting(
  candidate: {
    company_name: string;
    contact_person?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  },
  existingLeads: LeadRecord[],
  excludeLeadId?: string
): { match: LeadRecord; reasons: string[]; score: number }[] {
  const activeLeads = existingLeads.filter(
    (l) => l.record_status !== 'merged' && (!excludeLeadId || l.id !== excludeLeadId)
  );
  const matches: { match: LeadRecord; reasons: string[]; score: number }[] = [];

  const tempRec = {
    id: 'candidate_temp_id',
    company_name: candidate.company_name,
    contact_person: candidate.contact_person,
    phone: candidate.phone,
    whatsapp: candidate.whatsapp,
    email: candidate.email,
  };

  for (const existing of activeLeads) {
    const comp = compareRecords(tempRec, existing);
    if (comp.isDuplicate) {
      matches.push({
        match: existing,
        reasons: comp.reasons,
        score: comp.score,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Quick check against existing clients for candidate client data.
 */
export function checkClientAgainstExisting(
  candidate: {
    company_name: string;
    contact_person?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  },
  existingClients: ClientRecord[],
  excludeClientId?: string
): { match: ClientRecord; reasons: string[]; score: number }[] {
  const activeClients = existingClients.filter(
    (c) => c.record_status !== 'merged' && (!excludeClientId || c.id !== excludeClientId)
  );
  const matches: { match: ClientRecord; reasons: string[]; score: number }[] = [];

  const tempRec = {
    id: 'candidate_temp_client_id',
    company_name: candidate.company_name,
    contact_person: candidate.contact_person,
    phone: candidate.phone,
    whatsapp: candidate.whatsapp,
    email: candidate.email,
  };

  for (const existing of activeClients) {
    const comp = compareRecords(tempRec, existing);
    if (comp.isDuplicate) {
      matches.push({
        match: existing,
        reasons: comp.reasons,
        score: comp.score,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ----------------------------------------------------
// Deterministic Data Quality & Completeness Scoring
// ----------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email?: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email.trim());
}

export function isValidPhone(phone?: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Calculates deterministic completeness and validation for a Lead.
 */
export function calculateLeadCompleteness(lead: LeadRecord): DataQualityReport<LeadRecord> {
  const issues: DataCompletenessIssue[] = [];
  const invalidFields: string[] = [];
  let score = 0;

  // 1. Company Name (Critical - 20 pts)
  if (!lead.company_name || !lead.company_name.trim()) {
    issues.push({
      field: 'company_name',
      label: 'Company Name',
      severity: 'critical',
      description: 'Missing company / business name.',
    });
  } else {
    score += 20;
    if (lead.company_name.length !== lead.company_name.trim().length) {
      invalidFields.push('company_name');
    }
  }

  // 2. Contact Person (Critical - 15 pts)
  if (!lead.contact_person || !lead.contact_person.trim()) {
    issues.push({
      field: 'contact_person',
      label: 'Contact Person',
      severity: 'critical',
      description: 'No key decision maker or contact person specified.',
    });
  } else {
    score += 15;
  }

  // 3. Contact Channels (Phone / WhatsApp / Email)
  const hasPhone = Boolean(lead.phone && lead.phone.trim());
  const hasWhatsapp = Boolean(lead.whatsapp && lead.whatsapp.trim());
  const hasEmail = Boolean(lead.email && lead.email.trim());

  if (!hasPhone && !hasWhatsapp && !hasEmail) {
    issues.push({
      field: 'contact_channels',
      label: 'Contact Channels',
      severity: 'critical',
      description: 'No communication channel provided (missing Phone, WhatsApp, and Email).',
    });
  } else {
    // Points distribution
    if (hasPhone) {
      score += 15;
      if (!isValidPhone(lead.phone)) {
        invalidFields.push('phone');
        issues.push({
          field: 'phone',
          label: 'Phone Number',
          severity: 'warning',
          description: 'Phone format appears incomplete or malformed (expected 7-15 digits).',
        });
      }
    } else {
      issues.push({
        field: 'phone',
        label: 'Phone Number',
        severity: 'warning',
        description: 'Phone number is missing.',
      });
    }

    if (hasWhatsapp) {
      score += 10;
      if (!isValidPhone(lead.whatsapp)) {
        invalidFields.push('whatsapp');
      }
    } else {
      issues.push({
        field: 'whatsapp',
        label: 'WhatsApp',
        severity: 'optional',
        description: 'WhatsApp number is not provided.',
      });
    }

    if (hasEmail) {
      score += 10;
      if (!isValidEmail(lead.email)) {
        invalidFields.push('email');
        issues.push({
          field: 'email',
          label: 'Email Address',
          severity: 'warning',
          description: 'Email format is invalid or incomplete.',
        });
      }
    } else {
      issues.push({
        field: 'email',
        label: 'Email Address',
        severity: 'warning',
        description: 'Email address is missing.',
      });
    }
  }

  // 4. Location (Warning - 10 pts)
  if (!lead.location || !lead.location.trim()) {
    issues.push({
      field: 'location',
      label: 'Location',
      severity: 'warning',
      description: 'Geographic location / territory is not specified.',
    });
  } else {
    score += 10;
  }

  // 5. Assigned Salesman (Critical - 10 pts)
  if (!lead.assigned_to || !lead.assigned_to.trim()) {
    issues.push({
      field: 'assigned_to',
      label: 'Assigned Salesman',
      severity: 'critical',
      description: 'Lead is currently unassigned to any salesman.',
    });
  } else {
    score += 10;
  }

  // 6. Lead Status (Critical - 10 pts)
  if (!lead.status) {
    issues.push({
      field: 'status',
      label: 'Pipeline Status',
      severity: 'critical',
      description: 'Pipeline status is undefined.',
    });
  } else {
    score += 10;
  }

  return {
    record: lead,
    recordType: 'Lead',
    score: Math.min(100, Math.max(0, score)),
    issues,
    hasInvalidData: invalidFields.length > 0,
    invalidFields,
  };
}

/**
 * Calculates deterministic completeness and validation for a Client.
 */
export function calculateClientCompleteness(client: ClientRecord): DataQualityReport<ClientRecord> {
  const issues: DataCompletenessIssue[] = [];
  const invalidFields: string[] = [];
  let score = 0;

  // 1. Company Name (Critical - 25 pts)
  if (!client.company_name || !client.company_name.trim()) {
    issues.push({
      field: 'company_name',
      label: 'Company Name',
      severity: 'critical',
      description: 'Missing client company name.',
    });
  } else {
    score += 25;
  }

  // 2. Primary Contact Person (Critical - 20 pts)
  if (!client.contact_person || !client.contact_person.trim()) {
    issues.push({
      field: 'contact_person',
      label: 'Primary Contact Person',
      severity: 'critical',
      description: 'Primary customer contact person is missing.',
    });
  } else {
    score += 20;
  }

  // 3. Contact Channels (Phone / Email / WhatsApp - 25 pts)
  const hasPhone = Boolean(client.phone && client.phone.trim());
  const hasWhatsapp = Boolean(client.whatsapp && client.whatsapp.trim());
  const hasEmail = Boolean(client.email && client.email.trim());

  if (!hasPhone && !hasWhatsapp && !hasEmail) {
    issues.push({
      field: 'contact_channels',
      label: 'Contact Information',
      severity: 'critical',
      description: 'No contact information recorded (missing Phone, WhatsApp, and Email).',
    });
  } else {
    if (hasPhone) {
      score += 15;
      if (!isValidPhone(client.phone)) {
        invalidFields.push('phone');
        issues.push({
          field: 'phone',
          label: 'Phone Number',
          severity: 'warning',
          description: 'Phone format appears invalid (expected 7-15 digits).',
        });
      }
    } else {
      issues.push({
        field: 'phone',
        label: 'Phone Number',
        severity: 'warning',
        description: 'Direct phone number is missing.',
      });
    }

    if (hasEmail) {
      score += 10;
      if (!isValidEmail(client.email)) {
        invalidFields.push('email');
        issues.push({
          field: 'email',
          label: 'Email Address',
          severity: 'warning',
          description: 'Customer email format is malformed.',
        });
      }
    } else {
      issues.push({
        field: 'email',
        label: 'Email Address',
        severity: 'warning',
        description: 'Official email address is missing.',
      });
    }
  }

  // 4. Owner (Critical - 15 pts)
  if (!client.owner_id || !client.owner_id.trim()) {
    issues.push({
      field: 'owner_id',
      label: 'Account Owner',
      severity: 'critical',
      description: 'Client does not have a designated account manager / owner.',
    });
  } else {
    score += 15;
  }

  // 5. Status (Critical - 10 pts)
  if (!client.status) {
    issues.push({
      field: 'status',
      label: 'Account Status',
      severity: 'critical',
      description: 'Account status (Active/Inactive) is missing.',
    });
  } else {
    score += 10;
  }

  // 6. Location (Warning - 5 pts)
  if (!client.location || !client.location.trim()) {
    issues.push({
      field: 'location',
      label: 'Location',
      severity: 'warning',
      description: 'Client address / territory location is not recorded.',
    });
  } else {
    score += 5;
  }

  return {
    record: client,
    recordType: 'Client',
    score: Math.min(100, Math.max(0, score)),
    issues,
    hasInvalidData: invalidFields.length > 0,
    invalidFields,
  };
}

/**
 * Scans all active leads and returns duplicate candidates matching the UI schema.
 */
export function findAllLeadDuplicateCandidates(
  leads: LeadRecord[],
  notDuplicates: NotDuplicateRecord[] = []
): DuplicateMatchCandidate[] {
  const dismissedKeys = new Set<string>();
  notDuplicates.forEach((n) => {
    dismissedKeys.add(n.id || getPairKey(n.record_a_id, n.record_b_id));
  });

  const matches = scanLeadDuplicates(leads, dismissedKeys);
  return matches.map((m) => ({
    pair_id: m.id,
    entity_type: 'Lead',
    record_a: m.recordA,
    record_b: m.recordB,
    confidence_score: m.score,
    match_reasons: m.reasons,
    detected_at: m.detectedAt || new Date().toISOString(),
  }));
}

/**
 * Scans all active clients and returns duplicate candidates matching the UI schema.
 */
export function findAllClientDuplicateCandidates(
  clients: ClientRecord[],
  notDuplicates: NotDuplicateRecord[] = []
): DuplicateMatchCandidate[] {
  const dismissedKeys = new Set<string>();
  notDuplicates.forEach((n) => {
    dismissedKeys.add(n.id || getPairKey(n.record_a_id, n.record_b_id));
  });

  const matches = scanClientDuplicates(clients, dismissedKeys);
  return matches.map((m) => ({
    pair_id: m.id,
    entity_type: 'Client',
    record_a: m.recordA,
    record_b: m.recordB,
    confidence_score: m.score,
    match_reasons: m.reasons,
    detected_at: m.detectedAt || new Date().toISOString(),
  }));
}

/**
 * Real-time check during input/editing for lead candidate data.
 */
export function findPotentialMatchesForLeadInput(
  candidate: {
    id?: string;
    company_name: string;
    contact_person?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  },
  existingLeads: LeadRecord[],
  notDuplicates: NotDuplicateRecord[] = []
): DuplicateMatchCandidate[] {
  const dismissedKeys = new Set<string>();
  notDuplicates.forEach((n) => {
    dismissedKeys.add(n.id || getPairKey(n.record_a_id, n.record_b_id));
  });

  const matches = checkLeadAgainstExisting(candidate, existingLeads, candidate.id);
  const results: DuplicateMatchCandidate[] = [];

  for (const m of matches) {
    const pairId = candidate.id ? getPairKey(candidate.id, m.match.id) : `temp_${m.match.id}`;
    if (dismissedKeys.has(pairId)) continue;

    results.push({
      pair_id: pairId,
      entity_type: 'Lead',
      record_a: candidate,
      record_b: m.match,
      confidence_score: m.score,
      match_reasons: m.reasons,
      detected_at: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Real-time check during input/editing for client candidate data.
 */
export function findPotentialMatchesForClientInput(
  candidate: {
    id?: string;
    company_name: string;
    contact_person?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  },
  existingClients: ClientRecord[],
  notDuplicates: NotDuplicateRecord[] = []
): DuplicateMatchCandidate[] {
  const dismissedKeys = new Set<string>();
  notDuplicates.forEach((n) => {
    dismissedKeys.add(n.id || getPairKey(n.record_a_id, n.record_b_id));
  });

  const matches = checkClientAgainstExisting(candidate, existingClients, candidate.id);
  const results: DuplicateMatchCandidate[] = [];

  for (const m of matches) {
    const pairId = candidate.id ? getPairKey(candidate.id, m.match.id) : `temp_${m.match.id}`;
    if (dismissedKeys.has(pairId)) continue;

    results.push({
      pair_id: pairId,
      entity_type: 'Client',
      record_a: candidate,
      record_b: m.match,
      confidence_score: m.score,
      match_reasons: m.reasons,
      detected_at: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Evaluates completeness across all leads and clients.
 */
export function evaluateDatabaseCompleteness(
  leads: LeadRecord[],
  clients: ClientRecord[]
): DatabaseCompletenessReport {
  const issues: HygieneIssue[] = [];

  for (const lead of leads) {
    if (lead.record_status === 'merged') continue;
    const missing: string[] = [];
    if (!lead.company_name?.trim()) missing.push('company_name');
    if (!lead.contact_person?.trim()) missing.push('contact_person');
    if (!lead.phone?.trim() && !lead.whatsapp?.trim() && !lead.email?.trim()) {
      missing.push('phone');
    }
    if (missing.length > 0) {
      issues.push({
        record_id: lead.id,
        company_name: lead.company_name || 'Unnamed Lead',
        entity_type: 'Lead',
        missing_fields: missing,
      });
    }
  }

  for (const client of clients) {
    if (client.record_status === 'merged') continue;
    const missing: string[] = [];
    if (!client.company_name?.trim()) missing.push('company_name');
    if (!client.contact_person?.trim()) missing.push('contact_person');
    if (!client.phone?.trim() && !client.whatsapp?.trim() && !client.email?.trim()) {
      missing.push('phone');
    }
    if (missing.length > 0) {
      issues.push({
        record_id: client.id,
        company_name: client.company_name || 'Unnamed Client',
        entity_type: 'Client',
        missing_fields: missing,
      });
    }
  }

  const total = leads.length + clients.length;
  const healthPercentage = total > 0 ? Math.round(((total - issues.length) / total) * 100) : 100;

  return {
    issues,
    totalRecordsChecked: total,
    healthPercentage: Math.max(0, healthPercentage),
  };
}
