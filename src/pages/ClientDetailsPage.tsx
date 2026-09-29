import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Building2,
  User,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Briefcase,
  Edit3,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Tag,
  Copy,
  Check,
  ArrowUpRight,
  FileText,
  CalendarPlus,
  Sparkles,
  Plus,
  RotateCcw,
  XCircle,
  ChevronRight,
  History,
  Kanban,
  CheckSquare,
  GitMerge,
  AlertTriangle,
  Globe,
  Paperclip,
  Activity,
  Layers,
  Save,
  PauseCircle,
  Trash2,
  X,
} from 'lucide-react';
import {
  ClientRecord,
  UserProfile,
  ClientStatus,
  LeadRecord,
  LeadActivityRecord,
  FollowUpRecord,
  FollowUpActionType,
  CompleteFollowUpInput,
  RescheduleFollowUpInput,
  DuplicateMatchCandidate,
  ClientTransferRecord,
  AttachmentRecord,
  AttachmentCategory,
} from '../types/database';
import {
  subscribeToSingleClient,
  getLocalClients,
  getAllUsers,
  getUserDisplayName,
  updateClient,
  getLeadById,
  subscribeToClientTimeline,
  createActivity,
  subscribeToFollowUps,
  completeFollowUp,
  rescheduleFollowUp,
  cancelFollowUp,
  createFollowUp,
  subscribeToLeads,
  addTagToClient,
  removeTagFromClient,
  getClients,
  getLocalNotDuplicates,
  markAsNotDuplicate,
  subscribeToClientTransfers,
  subscribeToClientAttachments,
  uploadClientAttachment,
  deleteClientAttachment,
  deleteClient,
} from '../lib/dal';
import { findPotentialMatchesForClientInput } from '../lib/dataQuality';
import { RecordMergeModal } from '../components/data-quality/RecordMergeModal';
import { TagBadge } from '../components/TagBadge';
import { TagSelectorModal } from '../components/TagSelectorModal';
import { useAuth } from '../context/AuthContext';
import { EditClientModal } from '../components/clients/EditClientModal';
import { TransferClientModal } from '../components/clients/TransferClientModal';
import { CreateOpportunityModal } from '../components/clients/CreateOpportunityModal';
import { AddClientActivityModal } from '../components/clients/AddClientActivityModal';
import { ClientActivityTimeline } from '../components/clients/ClientActivityTimeline';
import { ClientRelatedLeads } from '../components/clients/ClientRelatedLeads';
import { ClientFollowUps } from '../components/clients/ClientFollowUps';
import { ClientAttachmentsSection } from '../components/clients/ClientAttachmentsSection';
import { ScheduleFollowUpModal } from '../components/followups/ScheduleFollowUpModal';
import { CompleteFollowUpModal } from '../components/followups/CompleteFollowUpModal';
import { RescheduleFollowUpModal } from '../components/followups/RescheduleFollowUpModal';

interface ClientDetailsPageProps {
  clientId: string;
  onBack: () => void;
  onNavigateToLead: (leadId: string) => void;
}

type ClientTab = 'overview' | 'activity' | 'opportunities' | 'followups' | 'attachments' | 'transfers';

export const ClientDetailsPage: React.FC<ClientDetailsPageProps> = ({
  clientId,
  onBack,
  onNavigateToLead,
}) => {
  const { userProfile, currentUser, isAdmin, isSuperAdmin, hasPermission } = useAuth();

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [sourceLead, setSourceLead] = useState<LeadRecord | null>(null);
  const [allLeads, setAllLeads] = useState<LeadRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [clientTransfers, setClientTransfers] = useState<ClientTransferRecord[]>([]);

  const canTransfer =
    !isSuperAdmin &&
    (isAdmin ||
      hasPermission('CLIENTS_TRANSFER') ||
      client?.owner_id === (userProfile?.id || currentUser?.uid));

  // Client Deletion: ADMIN only or explicit CLIENTS_DELETE
  const canDeleteClient = !isSuperAdmin && (isAdmin || hasPermission('CLIENTS_DELETE'));

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(true);
  const [loadingAttachments, setLoadingAttachments] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Active tab (Default: Overview)
  const [activeTab, setActiveTab] = useState<ClientTab>('overview');

  // Quick notes editing
  const [quickNotes, setQuickNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState<boolean>(false);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isCreateOpportunityOpen, setIsCreateOpportunityOpen] = useState<boolean>(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState<boolean>(false);
  const [activityInitialType, setActivityInitialType] = useState<any>('Call');
  const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState<boolean>(false);
  const [scheduleFollowUpAction, setScheduleFollowUpAction] = useState<FollowUpActionType>('Call');
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);

  const [selectedFollowUpForComplete, setSelectedFollowUpForComplete] = useState<FollowUpRecord | null>(null);
  const [selectedFollowUpForReschedule, setSelectedFollowUpForReschedule] = useState<FollowUpRecord | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Phase S: Client duplicate candidate tracking
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatchCandidate[]>([]);
  const [activeMergeCandidate, setActiveMergeCandidate] = useState<DuplicateMatchCandidate | null>(null);

  // Load team members
  useEffect(() => {
    getAllUsers()
      .then((users) => setUsersList(users))
      .catch((e) => console.warn('Failed to load users for client details:', e));
  }, []);

  // Check for potential duplicate clients
  useEffect(() => {
    if (!client || client.record_status === 'merged') {
      setDuplicateMatches([]);
      return;
    }
    let isMounted = true;
    getClients({ userRole: 'ADMIN', includeMerged: false }).then((allClients) => {
      if (!isMounted) return;
      const otherClients = allClients.filter((c) => c.id !== client.id);
      const notDups = getLocalNotDuplicates();
      const matches = findPotentialMatchesForClientInput(client, otherClients, notDups);
      setDuplicateMatches(matches);
    });
    return () => {
      isMounted = false;
    };
  }, [client?.id, client?.company_name, client?.phone, client?.email, client?.whatsapp, client?.record_status]);

  // Subscribe to all leads
  useEffect(() => {
    const unsub = subscribeToLeads(
      (leads) => setAllLeads(leads),
      userProfile?.role
    );
    return () => unsub();
  }, [userProfile?.role]);

  // Subscribe to single client record
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = subscribeToSingleClient(
      clientId,
      (clientData) => {
        if (clientData) {
          setClient(clientData);
          setQuickNotes(clientData.notes || '');
          setError(null);
        } else {
          const localMatch = getLocalClients().find((c) => c.id === clientId);
          if (localMatch) {
            setClient(localMatch);
            setQuickNotes(localMatch.notes || '');
            setError(null);
          } else {
            setClient(null);
            setError('Client not found or you do not have permission to view this customer.');
          }
        }
        setLoading(false);

        if (clientData?.source_lead_id) {
          getLeadById(clientData.source_lead_id, userProfile?.role)
            .then((lead) => {
              setSourceLead(lead);
            })
            .catch((err) => {
              console.warn('Could not fetch source lead for client:', err);
            });
        }
      },
      (err) => {
        console.warn('Client subscription notice:', err);
        const localMatch = getLocalClients().find((c) => c.id === clientId);
        if (localMatch) {
          setClient(localMatch);
          setQuickNotes(localMatch.notes || '');
          setError(null);
        } else {
          setError('Client not found or you do not have permission to view this customer.');
        }
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, userProfile?.role]);

  // Subscribe to client timeline activities
  useEffect(() => {
    setLoadingActivities(true);
    const relatedIds = Array.from(
      new Set([
        ...(client?.related_lead_ids || []),
        ...(client?.source_lead_id ? [client.source_lead_id] : []),
      ])
    );
    const unsub = subscribeToClientTimeline(
      clientId,
      relatedIds,
      (activityList) => {
        setActivities(activityList);
        setLoadingActivities(false);
      },
      (err) => {
        console.warn('Client timeline subscription warning:', err);
        setLoadingActivities(false);
      }
    );
    return () => unsub();
  }, [clientId, client?.related_lead_ids, client?.source_lead_id]);

  // Subscribe to follow-ups
  useEffect(() => {
    const unsub = subscribeToFollowUps(
      (list) => {
        const matching = list.filter(
          (f) =>
            f.client_id === clientId ||
            f.lead_id === clientId ||
            (client?.source_lead_id && f.lead_id === client.source_lead_id) ||
            (client?.related_lead_ids && client.related_lead_ids.includes(f.lead_id))
        );
        setFollowups(matching);
      },
      userProfile?.role
    );
    return () => unsub();
  }, [clientId, client?.source_lead_id, client?.related_lead_ids, userProfile?.role]);

  // Subscribe to client attachments
  useEffect(() => {
    setLoadingAttachments(true);
    const unsub = subscribeToClientAttachments(
      clientId,
      (list) => {
        setAttachments(list);
        setLoadingAttachments(false);
      },
      (err) => {
        console.warn('Client attachments subscription warning:', err);
        setLoadingAttachments(false);
      }
    );
    return () => unsub();
  }, [clientId]);

  // Subscribe to client transfers
  useEffect(() => {
    const unsub = subscribeToClientTransfers(
      (transfers) => setClientTransfers(transfers),
      clientId
    );
    return () => unsub();
  }, [clientId]);

  // Derived related leads
  const relatedLeads = useMemo(() => {
    if (!client) return [];
    return allLeads.filter(
      (l) =>
        l.client_id === client.id ||
        l.id === client.source_lead_id ||
        (client.related_lead_ids && client.related_lead_ids.includes(l.id)) ||
        (l.company_name && l.company_name.toLowerCase() === client.company_name.toLowerCase())
    );
  }, [allLeads, client]);

  // Metrics computation for Relationship Summary
  const relationshipSummary = useMemo(() => {
    const totalLeads = relatedLeads.length;
    const wonLeads = relatedLeads.filter((l) => l.status === 'Won');
    const wonValue = wonLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
    const openOpportunities = relatedLeads.filter(
      (l) => l.status !== 'Won' && l.status !== 'Lost'
    ).length;

    // Last contact (Call, WhatsApp, Email, Meeting, Site Visit)
    const contactTypes = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Site Visit'];
    const contactActs = activities
      .filter((a) => contactTypes.includes(a.activity_type) && !a.is_system_activity)
      .sort((a, b) => {
        const timeA = new Date(a.activity_date || a.activity_at || a.created_at).getTime();
        const timeB = new Date(b.activity_date || b.activity_at || b.created_at).getTime();
        return timeB - timeA;
      });
    const lastContact = contactActs[0] || null;

    // Next follow-up
    const pendingFu = followups
      .filter((f) => f.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    const nextFollowUp = pendingFu[0] || null;
    const isOverdue = nextFollowUp
      ? new Date(nextFollowUp.scheduled_at).getTime() < Date.now()
      : false;

    return {
      totalLeads,
      wonCount: wonLeads.length,
      wonValue,
      openOpportunities,
      lastContact,
      nextFollowUp,
      isOverdue,
    };
  }, [relatedLeads, activities, followups]);

  // RBAC Access Check
  const hasAccess = useMemo(() => {
    if (!client) return false;
    if (isAdmin || isSuperAdmin) return true;
    const userId = userProfile?.id || currentUser?.uid;
    return client.owner_id === userId || client.created_by === userId;
  }, [client, isAdmin, isSuperAdmin, userProfile?.id, currentUser?.uid]);

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStatusChange = async (newStatus: ClientStatus) => {
    if (!client) return;
    try {
      await updateClient(client.id, { status: newStatus }, client);
      setClient((prev) => (prev ? { ...prev, status: newStatus } : null));

      // Record system activity
      await createActivity({
        client_id: client.id,
        company_name: client.company_name,
        client_name: client.contact_person || client.company_name,
        activity_type: 'Note',
        description: `Client status changed to ${newStatus}`,
        outcome: newStatus,
        performed_by: userProfile?.id || currentUser?.uid || '',
        performed_by_name: userProfile?.full_name || 'Team Member',
        is_system_activity: true,
      });
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  const handleSaveQuickNotes = async () => {
    if (!client) return;
    try {
      setIsSavingNotes(true);
      await updateClient(client.id, { notes: quickNotes.trim() }, client);
      setNotesSavedSuccess(true);
      setTimeout(() => setNotesSavedSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save quick notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!client) return;
    await addTagToClient(client.id, tagName);
    setClient((prev) =>
      prev ? { ...prev, tags: [...(prev.tags || []), tagName] } : null
    );
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!client) return;
    await removeTagFromClient(client.id, tagName);
    setClient((prev) =>
      prev
        ? { ...prev, tags: (prev.tags || []).filter((t) => t !== tagName) }
        : null
    );
  };

  // Follow-up actions
  const handleCompleteFollowUp = async (input: CompleteFollowUpInput) => {
    await completeFollowUp({
      ...input,
      client_id: input.client_id || client?.id,
    });
    setSelectedFollowUpForComplete(null);
  };

  const handleRescheduleFollowUp = async (input: RescheduleFollowUpInput) => {
    await rescheduleFollowUp({
      ...input,
      client_id: input.client_id || client?.id,
    });
    setSelectedFollowUpForReschedule(null);
  };

  const handleCancelFollowUp = async (followUp: FollowUpRecord) => {
    if (!window.confirm(`Are you sure you want to cancel "${followUp.action}"?`)) {
      return;
    }
    await cancelFollowUp({
      lead_id: followUp.lead_id,
      client_id: followUp.client_id || client?.id,
      followup_id: followUp.id,
      cancellation_reason: 'Cancelled from Client workspace',
    });
  };

  // Attachments upload & delete
  const handleUploadAttachment = async (
    file: File,
    category: AttachmentCategory,
    description: string,
    onProgress: (p: number) => void
  ) => {
    if (!client) return;
    await uploadClientAttachment(
      {
        client_id: client.id,
        file,
        category,
        description,
        onProgress,
      },
      userProfile?.role
    );
  };

  const handleDeleteAttachment = async (attachment: AttachmentRecord) => {
    if (!client) return;
    await deleteClientAttachment(client.id, attachment, userProfile?.role);
  };

  // Quick action helpers
  const handleQuickCall = () => {
    if (!client) return;
    if (client.phone) {
      window.location.href = `tel:${client.phone}`;
    }
    setActivityInitialType('Call');
    setIsAddActivityOpen(true);
  };

  const handleQuickWhatsApp = () => {
    if (!client) return;
    const num = (client.whatsapp || client.phone || '').replace(/[^0-9]/g, '');
    if (num) {
      window.open(`https://wa.me/${num}`, '_blank');
    }
    setActivityInitialType('WhatsApp');
    setIsAddActivityOpen(true);
  };

  const handleQuickEmail = () => {
    if (!client) return;
    if (client.email) {
      window.location.href = `mailto:${client.email}`;
    }
    setActivityInitialType('Email');
    setIsAddActivityOpen(true);
  };

  const handleOpenScheduleModal = (actionType: FollowUpActionType = 'Call') => {
    setScheduleFollowUpAction(actionType);
    setIsScheduleFollowUpOpen(true);
  };

  // Handle Client Deletion with strict RBAC and compliance audit
  const handleConfirmDelete = async () => {
    if (!client) return;
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm removal.');
      return;
    }
    if (!deleteReason.trim()) {
      setDeleteError('Please specify a deletion reason for compliance audit.');
      return;
    }
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteClient(client.id, deleteReason.trim(), {
        id: userProfile?.id || currentUser?.uid || 'user',
        name: userProfile?.full_name || currentUser?.displayName || 'User',
        role: userProfile?.role || (isAdmin ? 'ADMIN' : 'SALESMAN'),
        company_id: userProfile?.company_id,
      });
      setIsDeleteModalOpen(false);
      onBack();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete client.');
      setIsDeleting(false);
    }
  };

  const formatDateString = (isoString?: string) => {
    if (!isoString) return 'None';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'None';
      return d.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'None';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-3 text-xs font-semibold text-slate-500">Loading client workspace...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center max-w-lg mx-auto mt-12">
        <AlertCircle className="h-10 w-10 text-rose-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-900">Client Not Found</h3>
        <p className="text-xs text-rose-700 mt-1 mb-5">
          {error || 'The requested customer account could not be accessed.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-rose-300 px-4 py-2 text-xs font-bold text-rose-800 shadow-2xs hover:bg-rose-100 transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Client Directory</span>
        </button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center max-w-lg mx-auto mt-12">
        <AlertCircle className="h-10 w-10 text-amber-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-amber-900">Permission Notice</h3>
        <p className="text-xs text-amber-700 mt-1 mb-5">
          You do not have permission to view this customer account. This account is assigned to another sales representative.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-amber-300 px-4 py-2 text-xs font-bold text-amber-800 shadow-2xs hover:bg-amber-100 transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Client Directory</span>
        </button>
      </div>
    );
  }

  const assignedOwnerName =
    client.owner_name || getUserDisplayName(client.owner_id, usersList);

  return (
    <div className="space-y-5 pb-16">
      {/* ---------------- Top Back Button & Header ---------------- */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Clients</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Create Opportunity button */}
          <button
            type="button"
            onClick={() => setIsCreateOpportunityOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>New Opportunity</span>
          </button>

          {/* Edit Client */}
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-500" />
            <span>Edit Account</span>
          </button>

          {/* Delete Client (Secondary Destructive Action, Admin Only) */}
          {canDeleteClient && (
            <button
              type="button"
              id="admin-header-delete-client-btn"
              onClick={() => {
                setDeleteReason('');
                setDeleteConfirmText('');
                setDeleteError(null);
                setIsDeleteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100 hover:border-rose-300 transition cursor-pointer"
              title="Delete Client Account (Admin Only)"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Delete Client</span>
            </button>
          )}
        </div>
      </div>

      {/* Merged Banner if applicable */}
      {client.record_status === 'merged' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-950 text-sm">Archived Account (Merged)</div>
            <p className="text-amber-800 mt-0.5">
              This client record was merged into master account <strong>{client.merged_into_id}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate Alert Banner if applicable */}
      {duplicateMatches.length > 0 && client.record_status !== 'merged' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5">
            <GitMerge className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-950 text-sm">
                Possible Duplicate Client Account Detected ({duplicateMatches[0].confidence_score}% match)
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Existing client <strong>{duplicateMatches[0].record_b.company_name}</strong> shares matching contact details.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveMergeCandidate(duplicateMatches[0])}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition cursor-pointer"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Review &amp; Merge</span>
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await markAsNotDuplicate(client.id, duplicateMatches[0].record_b.id, 'Client');
                setDuplicateMatches((prev) => prev.filter((_, idx) => idx !== 0));
              }}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition cursor-pointer"
            >
              Not Duplicate
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 4A. CLIENT HEADER ---------------- */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          {/* Identity & Contact Details */}
          <div className="space-y-3 max-w-2xl">
            {/* Status & Category & Owner row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Picker Pill (Section 16) */}
              <div className="relative inline-block">
                <select
                  value={client.status || 'Active'}
                  onChange={(e) => handleStatusChange(e.target.value as ClientStatus)}
                  className={`inline-flex items-center text-xs font-bold py-1 px-3 rounded-lg border transition cursor-pointer appearance-none pr-7 ${
                    client.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : client.status === 'Dormant'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <option value="Active">Active Relationship</option>
                  <option value="Dormant">Dormant Account</option>
                  <option value="Inactive">Inactive / Paused</option>
                </select>
                <span
                  className={`absolute right-2.5 top-2.5 h-2 w-2 rounded-full pointer-events-none ${
                    client.status === 'Active'
                      ? 'bg-emerald-500'
                      : client.status === 'Dormant'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
              </div>

              {/* Account Owner */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 font-semibold">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>Owner:</span>
                <span className="text-slate-900">{assignedOwnerName}</span>
                {canTransfer && (
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(true)}
                    className="text-emerald-700 hover:text-emerald-800 hover:underline ml-1 cursor-pointer font-bold text-[11px]"
                  >
                    Change
                  </button>
                )}
              </div>

              {client.client_type && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600">
                  <Tag className="h-3 w-3 text-slate-400" />
                  <span>{client.client_type}</span>
                </span>
              )}
            </div>

            {/* Company & Client Name */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {client.company_name}
              </h1>
              {client.contact_person && (
                <p className="text-sm font-semibold text-slate-600 mt-1 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-slate-400" />
                  <span>Contact Person:</span>
                  <span className="text-slate-900 font-bold">{client.contact_person}</span>
                  {client.contact_role && (
                    <span className="text-slate-400 text-xs font-medium">({client.contact_role})</span>
                  )}
                </p>
              )}
            </div>

            {/* Contact Info Strip */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600 pt-1">
              {client.phone && (
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <a
                    href={`tel:${client.phone}`}
                    className="font-semibold text-slate-800 hover:text-emerald-700 hover:underline"
                  >
                    {client.phone}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(client.phone || '', 'phone')}
                    className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
                    title="Copy Phone"
                  >
                    {copiedField === 'phone' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}

              {client.whatsapp && (
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80">
                  <MessageSquare className="h-3.5 w-3.5 text-teal-600" />
                  <a
                    href={`https://wa.me/${client.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-800 hover:text-teal-700 hover:underline"
                  >
                    {client.whatsapp}
                  </a>
                </div>
              )}

              {client.email && (
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80">
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                  <a
                    href={`mailto:${client.email}`}
                    className="font-semibold text-slate-800 hover:text-blue-700 hover:underline"
                  >
                    {client.email}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(client.email || '', 'email')}
                    className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}

              {client.location && (
                <div className="flex items-center gap-1 text-slate-600 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{client.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* ---------------- 6. DIRECT QUICK ACTIONS ---------------- */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-2 shrink-0 self-stretch sm:self-auto min-w-[200px]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Quick Relationship Actions
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {/* Call */}
              <button
                type="button"
                onClick={handleQuickCall}
                title="Call and log"
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-emerald-300 text-slate-700 transition cursor-pointer"
              >
                <Phone className="h-4 w-4 text-emerald-600 mb-1" />
                <span className="text-[11px] font-bold">Call</span>
              </button>

              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleQuickWhatsApp}
                title="WhatsApp message and log"
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-teal-300 text-slate-700 transition cursor-pointer"
              >
                <MessageSquare className="h-4 w-4 text-teal-600 mb-1" />
                <span className="text-[11px] font-bold">WhatsApp</span>
              </button>

              {/* Email */}
              <button
                type="button"
                onClick={handleQuickEmail}
                title="Send email and log"
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 text-slate-700 transition cursor-pointer"
              >
                <Mail className="h-4 w-4 text-blue-600 mb-1" />
                <span className="text-[11px] font-bold">Email</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* Add Activity */}
              <button
                type="button"
                onClick={() => {
                  setActivityInitialType('Call');
                  setIsAddActivityOpen(true);
                }}
                className="zaynops-btn-primary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span>Add Activity</span>
              </button>

              {/* Schedule */}
              <button
                type="button"
                onClick={() => handleOpenScheduleModal('Call')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer"
              >
                <CalendarPlus className="h-3.5 w-3.5 text-slate-600" />
                <span>Schedule</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 4B. WORKSPACE TABS ---------------- */}
      <div className="border-b border-slate-200">
        <nav className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-px">
          {[
            { key: 'overview', label: 'Overview', icon: Building2 },
            {
              key: 'activity',
              label: 'Activity',
              icon: Activity,
              count: activities.length,
            },
            {
              key: 'opportunities',
              label: 'Leads / Projects',
              icon: Kanban,
              count: relatedLeads.length,
            },
            {
              key: 'followups',
              label: 'Follow-ups',
              icon: Calendar,
              count: followups.filter((f) => f.status === 'pending').length,
            },
            {
              key: 'attachments',
              label: 'Attachments',
              icon: Paperclip,
              count: attachments.length,
            },
            ...(canTransfer || clientTransfers.length > 0
              ? [{ key: 'transfers', label: 'Audit & Ownership', icon: History, count: clientTransfers.length }]
              : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as ClientTab)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'border-emerald-700 text-emerald-800'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ---------------- TAB CONTENTS ---------------- */}

      {/* 5. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Key Metric Highlights Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Won Value */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Won Revenue
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  OMR {relationshipSummary.wonValue.toLocaleString()}
                </span>
                <span className="text-[11px] text-emerald-700 font-bold">
                  ({relationshipSummary.wonCount} won)
                </span>
              </div>
            </div>

            {/* Open Opportunities */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Open Opportunities
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold tracking-tight text-emerald-700">
                  {relationshipSummary.openOpportunities}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  of {relationshipSummary.totalLeads} total
                </span>
              </div>
            </div>

            {/* Last Contact */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Last Contact
              </span>
              <div className="mt-1 truncate">
                {relationshipSummary.lastContact ? (
                  <span className="text-sm font-bold text-slate-800">
                    {formatDateString(
                      relationshipSummary.lastContact.activity_date ||
                        relationshipSummary.lastContact.activity_at
                    )}{' '}
                    ·{' '}
                    <span className="text-emerald-700">
                      {relationshipSummary.lastContact.activity_type}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">No contact yet</span>
                )}
              </div>
            </div>

            {/* Next Follow-up */}
            <div
              className={`rounded-xl border p-3.5 shadow-2xs ${
                relationshipSummary.isOverdue
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-white border-slate-200/80'
              }`}
            >
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {relationshipSummary.isOverdue ? 'Overdue Follow-up' : 'Next Follow-up'}
              </span>
              <div className="mt-1 truncate">
                {relationshipSummary.nextFollowUp ? (
                  <span
                    className={`text-sm font-bold ${
                      relationshipSummary.isOverdue ? 'text-rose-700' : 'text-slate-800'
                    }`}
                  >
                    {formatDateString(relationshipSummary.nextFollowUp.scheduled_at)} ·{' '}
                    <span>{relationshipSummary.nextFollowUp.action}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">None scheduled</span>
                )}
              </div>
            </div>
          </div>

          {/* 2-Column Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: Key Contacts & Client Details & Quick Notes */}
            <div className="lg:col-span-2 space-y-5">
              {/* Card 1: Key Contacts */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-600" />
                    <span>Key Contacts</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Primary Contact</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {client.contact_person || 'Not specified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Role / Designation</span>
                    <span className="font-medium text-slate-700">
                      {client.contact_role || 'Account Manager / Lead Contact'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Direct Phone</span>
                    {client.phone ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <a
                          href={`tel:${client.phone}`}
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          {client.phone}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(client.phone || '', 'phone_ov')}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {copiedField === 'phone_ov' ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">WhatsApp</span>
                    {client.whatsapp ? (
                      <a
                        href={`https://wa.me/${client.whatsapp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-teal-700 hover:underline block mt-0.5"
                      >
                        {client.whatsapp}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px]">Email Address</span>
                    {client.email ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <a
                          href={`mailto:${client.email}`}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {client.email}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(client.email || '', 'email_ov')}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {copiedField === 'email_ov' ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Quick Notes */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <span>Relationship Notes</span>
                  </h3>
                  {notesSavedSuccess && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                      <span>Saved</span>
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                    placeholder="Record key details about this client: preferred communication channel, decision makers, project preferences, special conditions..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400 resize-none leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveQuickNotes}
                      disabled={isSavingNotes}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                    >
                      {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      <span>Save Notes</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Client Details & Ownership & Tags */}
            <div className="space-y-5">
              {/* Card 3: Client Details */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <span>Account Details</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Classification</span>
                    <span className="font-semibold text-slate-800">
                      {client.client_type || 'B2B Commercial'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Location</span>
                    <span className="font-semibold text-slate-800">
                      {client.location || client.address || 'Muscat, Oman'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Client Since</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateString(client.client_since || client.created_at)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Source</span>
                    <span className="font-semibold text-slate-800">
                      {client.source || (client.source_lead_id ? 'Converted Won Lead' : 'Direct Customer')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Ownership */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                    <span>Ownership</span>
                  </h3>
                  {canTransfer && (
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(true)}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Transfer
                    </button>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Account Owner</span>
                    <span className="font-bold text-slate-900 text-sm">{assignedOwnerName}</span>
                  </div>

                  {client.created_by_name && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">Created By</span>
                      <span className="font-medium text-slate-700">{client.created_by_name}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 block text-[11px]">Created On</span>
                    <span className="font-medium text-slate-700">
                      {formatDateString(client.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 5: Tags */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="h-4 w-4 text-amber-600" />
                    <span>Tags</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsTagModalOpen(true)}
                    className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Manage
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {Array.isArray(client.tags) && client.tags.length > 0 ? (
                    client.tags.map((tagName) => (
                      <TagBadge
                        key={tagName}
                        name={tagName}
                        onRemove={() => handleRemoveTag(tagName)}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No tags assigned</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7 & 8. ACTIVITY TIMELINE TAB */}
      {activeTab === 'activity' && (
        <ClientActivityTimeline
          activities={activities}
          loading={loadingActivities}
          users={usersList}
          onAddActivity={() => {
            setActivityInitialType('Call');
            setIsAddActivityOpen(true);
          }}
        />
      )}

      {/* 10 & 11. RELATED LEADS / PROJECTS TAB */}
      {activeTab === 'opportunities' && (
        <ClientRelatedLeads
          client={client}
          leads={relatedLeads}
          followups={followups}
          activities={activities}
          users={usersList}
          onNavigateToLead={onNavigateToLead}
          onCreateOpportunity={() => setIsCreateOpportunityOpen(true)}
        />
      )}

      {/* 12. FOLLOW-UPS TAB */}
      {activeTab === 'followups' && (
        <ClientFollowUps
          client={client}
          followups={followups}
          users={usersList}
          onScheduleFollowUp={handleOpenScheduleModal}
          onCompleteFollowUp={(fu) => setSelectedFollowUpForComplete(fu)}
          onRescheduleFollowUp={(fu) => setSelectedFollowUpForReschedule(fu)}
          onCancelFollowUp={handleCancelFollowUp}
        />
      )}

      {/* 18. ATTACHMENTS TAB */}
      {activeTab === 'attachments' && (
        <ClientAttachmentsSection
          clientId={client.id}
          companyName={client.company_name}
          attachments={attachments}
          loading={loadingAttachments}
          canUpload={true}
          canDelete={isAdmin || client.owner_id === (userProfile?.id || currentUser?.uid)}
          onUpload={handleUploadAttachment}
          onDelete={handleDeleteAttachment}
        />
      )}

      {/* TRANSFERS & AUDIT TAB (Optional) */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Ownership Transfers &amp; Audit Trail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete history of client ownership changes. Past activities preserve original performers.
              </p>
            </div>
            {canTransfer && (
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(true)}
                className="zaynops-btn-primary py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Transfer Client</span>
              </button>
            )}
          </div>

          {clientTransfers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800">No Transfers Recorded</p>
              <p className="text-xs text-slate-400 mt-1">
                This account is currently with original owner {assignedOwnerName}.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
              {clientTransfers.map((tr) => (
                <div key={tr.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Transferred from <span className="font-bold">{tr.from_user_name}</span> to{' '}
                      <span className="font-bold text-emerald-800">{tr.to_user_name}</span>
                    </div>
                    {tr.reason && <p className="text-slate-500 mt-0.5">{tr.reason}</p>}
                  </div>
                  <span className="text-slate-400 font-medium">
                    {formatDateString(tr.transferred_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- MODALS ---------------- */}

      {/* Add Client Activity Modal (Context-aware, no Lead ID required) */}
      <AddClientActivityModal
        isOpen={isAddActivityOpen}
        client={client}
        initialType={activityInitialType}
        users={usersList}
        onClose={() => setIsAddActivityOpen(false)}
        onActivityAdded={() => {
          // Re-trigger / refresh
        }}
      />

      {/* Schedule Follow-up Modal (Context-aware for client) */}
      <ScheduleFollowUpModal
        isOpen={isScheduleFollowUpOpen}
        onClose={() => setIsScheduleFollowUpOpen(false)}
        initialClientId={client.id}
        client={client}
        clientRecord={client}
        isClientContext={true}
        targetType="client"
        initialAction={scheduleFollowUpAction}
        users={usersList}
        leads={relatedLeads}
        onScheduled={() => setIsScheduleFollowUpOpen(false)}
      />

      {/* Complete Follow-up Modal */}
      {selectedFollowUpForComplete && (
        <CompleteFollowUpModal
          isOpen={Boolean(selectedFollowUpForComplete)}
          onClose={() => setSelectedFollowUpForComplete(null)}
          followUp={selectedFollowUpForComplete}
          onCompleted={handleCompleteFollowUp}
        />
      )}

      {/* Reschedule Follow-up Modal */}
      {selectedFollowUpForReschedule && (
        <RescheduleFollowUpModal
          isOpen={Boolean(selectedFollowUpForReschedule)}
          onClose={() => setSelectedFollowUpForReschedule(null)}
          followUp={selectedFollowUpForReschedule}
          onRescheduled={handleRescheduleFollowUp}
        />
      )}

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        client={client}
        onUpdated={() => {}}
      />

      {/* Transfer Client Modal */}
      <TransferClientModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        client={client}
        onTransferred={() => {}}
      />

      {/* Create Opportunity Modal */}
      <CreateOpportunityModal
        isOpen={isCreateOpportunityOpen}
        onClose={() => setIsCreateOpportunityOpen(false)}
        client={client}
        onCreated={(lead) => {
          setIsCreateOpportunityOpen(false);
          onNavigateToLead(lead.id);
        }}
      />

      {/* Tag Selector Modal */}
      <TagSelectorModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title="Manage Client Tags"
        currentTags={client.tags || []}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />

      {/* Merge Modal */}
      {activeMergeCandidate && (
        <RecordMergeModal
          isOpen={Boolean(activeMergeCandidate)}
          onClose={() => setActiveMergeCandidate(null)}
          candidate={activeMergeCandidate}
          entityType="Client"
          onMergeComplete={() => {
            setActiveMergeCandidate(null);
            onBack();
          }}
        />
      )}

      {/* Delete Client Confirmation Modal (Admin Only) */}
      {isDeleteModalOpen && client && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Client?</h3>
                  <p className="text-xs text-slate-500">Authorized deletion with audit tracking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3.5 text-xs text-rose-800 space-y-1">
              <p className="font-semibold text-rose-950">
                This will permanently delete this client and its CRM records:
              </p>
              <p className="font-bold text-sm text-slate-900">
                {client.company_name}
              </p>
              <p className="text-[11px] text-rose-700">
                This action cannot be undone. Active follow-ups will be removed. Historical leads will be unlinked and preserved in your pipeline.
              </p>
            </div>

            {deleteError && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for client removal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Account dissolved, duplicate error, or requested data purge"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-300 focus:border-rose-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-client-modal-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting || deleteConfirmText.trim() !== 'DELETE' || !deleteReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting Client...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Client</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
