/**
 * Phase V — Bulk Operations Service
 * Safe bulk status/priority/tag updates and bulk assignments with authorization checks,
 * batching, timeline history, and notification triggers.
 */

import { doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { LeadRecord, ClientRecord, LeadStatus, Priority, ClientStatus } from '../types/database';
import { BulkOperationResult } from '../types/dataManagement';
import { createAuditLog, createNotification } from './dal';

const BATCH_LIMIT = 50;

/**
 * Bulk updates lead statuses, priorities, or tags
 */
export async function executeBulkLeadUpdate(
  selectedLeads: LeadRecord[],
  updates: {
    status?: LeadStatus;
    priority?: Priority;
    addTag?: string;
    removeTag?: string;
  },
  currentUser: { uid: string; name: string; role: string }
): Promise<BulkOperationResult> {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';
  const result: BulkOperationResult = {
    total: selectedLeads.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  const authorizedLeads = selectedLeads.filter((l) => {
    if (isAdmin) return true;
    return l.assigned_to === currentUser.uid || l.created_by === currentUser.uid;
  });

  const unauthorizedCount = selectedLeads.length - authorizedLeads.length;
  if (unauthorizedCount > 0) {
    result.failed += unauthorizedCount;
    result.errors.push({
      id: 'auth-error',
      name: `${unauthorizedCount} Leads`,
      error: 'Permission Denied: You cannot modify leads assigned to other salesmen.',
    });
  }

  for (let i = 0; i < authorizedLeads.length; i += BATCH_LIMIT) {
    const chunk = authorizedLeads.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    chunk.forEach((lead) => {
      const docRef = doc(db, 'leads', lead.id);
      const updatePayload: Record<string, any> = {
        updated_at: now,
      };

      let actionDescription = '';

      if (updates.status) {
        updatePayload.status = updates.status;
        actionDescription += `Status changed from ${lead.status} to ${updates.status}. `;
      }
      if (updates.priority) {
        updatePayload.priority = updates.priority;
        actionDescription += `Priority changed from ${lead.priority} to ${updates.priority}. `;
      }
      if (updates.addTag) {
        const existingTags = lead.tags || [];
        if (!existingTags.includes(updates.addTag)) {
          updatePayload.tags = [...existingTags, updates.addTag];
          actionDescription += `Tag "${updates.addTag}" added. `;
        }
      }
      if (updates.removeTag) {
        const existingTags = lead.tags || [];
        updatePayload.tags = existingTags.filter((t) => t !== updates.removeTag);
        actionDescription += `Tag "${updates.removeTag}" removed. `;
      }

      batch.update(docRef, updatePayload);

      // Append Timeline Activity for lead
      if (actionDescription) {
        const actRef = doc(db, `leads/${lead.id}/activities`, `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
        batch.set(actRef, {
          id: actRef.id,
          lead_id: lead.id,
          activity_type: 'Note',
          description: `Bulk Update: ${actionDescription.trim()}`,
          performed_by: currentUser.uid,
          performed_by_name: currentUser.name,
          activity_date: now,
          created_by: currentUser.uid,
          created_at: now,
        });
      }
    });

    try {
      await batch.commit();
      result.succeeded += chunk.length;
    } catch (err: any) {
      result.failed += chunk.length;
      result.errors.push({
        id: `batch-${i}`,
        error: `Database write failure: ${err.message || 'Unknown error'}`,
      });
    }
  }

  // Record Admin Audit Log
  await createAuditLog({
    action: 'bulk_lead_updated',
    entity_type: 'Lead',
    entity_id: `bulk-${Date.now()}`,
    performed_by: currentUser.uid,
    performed_by_name: currentUser.name,
    performed_by_role: currentUser.role,
    description: `${currentUser.name} executed bulk update on ${result.succeeded} leads (${result.failed} failed).`,
    metadata: { updates, total: selectedLeads.length, succeeded: result.succeeded, failed: result.failed },
  });

  return result;
}

/**
 * Bulk Reassign Leads to a new Salesman (Admin only)
 */
export async function executeBulkLeadAssignment(
  selectedLeads: LeadRecord[],
  newSalesmanId: string,
  newSalesmanName: string,
  currentUser: { uid: string; name: string; role: string }
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    total: selectedLeads.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';
  if (!isAdmin) {
    result.failed = selectedLeads.length;
    result.errors.push({
      id: 'auth-error',
      error: 'Security Warning: Only Administrators are authorized to reassign leads in bulk.',
    });
    return result;
  }

  for (let i = 0; i < selectedLeads.length; i += BATCH_LIMIT) {
    const chunk = selectedLeads.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    chunk.forEach((lead) => {
      const docRef = doc(db, 'leads', lead.id);

      // 25. Preserve created_by, update assigned_to and assigned_to_name
      batch.update(docRef, {
        assigned_to: newSalesmanId,
        assigned_to_name: newSalesmanName,
        updated_at: now,
      });

      // Add assignment history to timeline
      const actRef = doc(db, `leads/${lead.id}/activities`, `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
      batch.set(actRef, {
        id: actRef.id,
        lead_id: lead.id,
        activity_type: 'Lead Assigned',
        description: `Lead reassigned in bulk to ${newSalesmanName} by Administrator ${currentUser.name}.`,
        performed_by: currentUser.uid,
        performed_by_name: currentUser.name,
        activity_date: now,
        created_by: currentUser.uid,
        created_at: now,
      });
    });

    try {
      await batch.commit();
      result.succeeded += chunk.length;
    } catch (err: any) {
      result.failed += chunk.length;
      result.errors.push({
        id: `batch-${i}`,
        error: `Database write failure: ${err.message || 'Unknown error'}`,
      });
    }
  }

  // 25. Create in-app notification for the newly assigned salesman
  if (result.succeeded > 0 && newSalesmanId !== currentUser.uid) {
    try {
      await createNotification({
        recipient_id: newSalesmanId,
        recipient_name: newSalesmanName,
        title: 'Bulk Leads Assigned',
        message: `Administrator ${currentUser.name} assigned ${result.succeeded} prospective leads to you.`,
        type: 'lead_assigned',
      });
    } catch (e) {
      console.warn('Could not dispatch assignment notification:', e);
    }
  }

  // Log to Audit Log
  await createAuditLog({
    action: 'lead_assigned',
    entity_type: 'Lead',
    entity_id: `bulk-assign-${Date.now()}`,
    performed_by: currentUser.uid,
    performed_by_name: currentUser.name,
    performed_by_role: 'ADMIN',
    description: `Admin ${currentUser.name} reassigned ${result.succeeded} leads to salesman ${newSalesmanName}.`,
    metadata: { newSalesmanId, newSalesmanName, succeeded: result.succeeded, failed: result.failed },
  });

  return result;
}

/**
 * Bulk updates for Clients (Active/Inactive, Add Tag, Remove Tag)
 * Note: Deleting clients in bulk is strictly prohibited.
 */
export async function executeBulkClientUpdate(
  selectedClients: ClientRecord[],
  updates: {
    status?: ClientStatus;
    addTag?: string;
    removeTag?: string;
  },
  currentUser: { uid: string; name: string; role: string }
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    total: selectedClients.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';
  const authorizedClients = selectedClients.filter((c) => {
    if (isAdmin) return true;
    return c.owner_id === currentUser.uid;
  });

  const unauthorizedCount = selectedClients.length - authorizedClients.length;
  if (unauthorizedCount > 0) {
    result.failed += unauthorizedCount;
    result.errors.push({
      id: 'auth-error',
      name: `${unauthorizedCount} Clients`,
      error: 'Permission Denied: You cannot modify client accounts owned by other team members.',
    });
  }

  for (let i = 0; i < authorizedClients.length; i += BATCH_LIMIT) {
    const chunk = authorizedClients.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    chunk.forEach((client) => {
      const docRef = doc(db, 'clients', client.id);
      const updatePayload: Record<string, any> = {
        updated_at: now,
      };

      if (updates.status) {
        updatePayload.status = updates.status;
      }
      if (updates.addTag) {
        const existingTags = client.tags || [];
        if (!existingTags.includes(updates.addTag)) {
          updatePayload.tags = [...existingTags, updates.addTag];
        }
      }
      if (updates.removeTag) {
        const existingTags = client.tags || [];
        updatePayload.tags = existingTags.filter((t) => t !== updates.removeTag);
      }

      batch.update(docRef, updatePayload);
    });

    try {
      await batch.commit();
      result.succeeded += chunk.length;
    } catch (err: any) {
      result.failed += chunk.length;
      result.errors.push({
        id: `batch-${i}`,
        error: `Database write failure: ${err.message || 'Unknown error'}`,
      });
    }
  }

  await createAuditLog({
    action: 'bulk_client_updated',
    entity_type: 'Client',
    entity_id: `bulk-${Date.now()}`,
    performed_by: currentUser.uid,
    performed_by_name: currentUser.name,
    performed_by_role: currentUser.role,
    description: `${currentUser.name} executed bulk update on ${result.succeeded} clients.`,
    metadata: { updates, total: selectedClients.length, succeeded: result.succeeded, failed: result.failed },
  });

  return result;
}
