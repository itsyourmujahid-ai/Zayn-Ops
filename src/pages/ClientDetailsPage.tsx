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
} from 'lucide-react';
import {
  ClientRecord,
  UserProfile,
  ClientStatus,
  LeadRecord,
  LeadActivityRecord,
  FollowUpRecord,
  CreateActivityInput,
  FollowUpActionType,
  CompleteFollowUpInput,
  RescheduleFollowUpInput,
  DuplicateMatchCandidate,
} from '../types/database';
import {
  subscribeToSingleClient,
  getAllUsers,
  getUserDisplayName,
  updateClient,
  getLeadById,
  subscribeToActivities,
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
} from '../lib/dal';
import { findPotentialMatchesForClientInput } from '../lib/dataQuality';
import { RecordMergeModal } from '../components/data-quality/RecordMergeModal';
import { TagBadge } from '../components/TagBadge';
import { TagSelectorModal } from '../components/TagSelectorModal';
import { useAuth } from '../context/AuthContext';
import { EditClientModal } from '../components/clients/EditClientModal';
import { TransferClientModal } from '../components/clients/TransferClientModal';
import { CreateOpportunityModal } from '../components/clients/CreateOpportunityModal';
import { CommunicationCenter } from '../components/lead-details/CommunicationCenter';
import { ActivityTimeline } from '../components/lead-details/ActivityTimeline';
import { ScheduleFollowUpModal } from '../components/followups/ScheduleFollowUpModal';
import { CompleteFollowUpModal } from '../components/followups/CompleteFollowUpModal';
import { RescheduleFollowUpModal } from '../components/followups/RescheduleFollowUpModal';

interface ClientDetailsPageProps {
  clientId: string;
  onBack: () => void;
  onNavigateToLead: (leadId: string) => void;
}

type ClientTab = 'communication' | 'timeline' | 'followups' | 'opportunities' | 'profile';

export const ClientDetailsPage: React.FC<ClientDetailsPageProps> = ({
  clientId,
  onBack,
  onNavigateToLead,
}) => {
  const { userProfile, currentUser, isAdmin } = useAuth();

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [sourceLead, setSourceLead] = useState<LeadRecord | null>(null);
  const [allLeads, setAllLeads] = useState<LeadRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<ClientTab>('communication');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isCreateOpportunityOpen, setIsCreateOpportunityOpen] = useState<boolean>(false);
  const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState<boolean>(false);
  const [scheduleFollowUpAction, setScheduleFollowUpAction] = useState<FollowUpActionType>('Customer Check-in');
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  
  const [selectedFollowUpForComplete, setSelectedFollowUpForComplete] = useState<FollowUpRecord | null>(null);
  const [selectedFollowUpForReschedule, setSelectedFollowUpForReschedule] = useState<FollowUpRecord | null>(null);

  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [followUpFilter, setFollowUpFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');

  // Phase S: Client duplicate candidate tracking
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatchCandidate[]>([]);
  const [activeMergeCandidate, setActiveMergeCandidate] = useState<DuplicateMatchCandidate | null>(null);

  // Load team members
  useEffect(() => {
    getAllUsers()
      .then((users) => setUsersList(users))
      .catch((e) => console.warn('Failed to load users for client details:', e));
  }, []);

  // Check for potential duplicate clients in real-time
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

  // Subscribe to all leads (for repeat business identification & schedule modal)
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
        setClient(clientData);
        setLoading(false);

        // Fetch source lead if available
        if (clientData?.source_lead_id) {
          getLeadById(clientData.source_lead_id)
            .then((lead) => {
              setSourceLead(lead);
            })
            .catch((err) => {
              console.warn('Could not fetch source lead for client:', err);
            });
        }
      },
      (err) => {
        console.error('Error fetching client details:', err);
        setError('Client not found or you do not have permission to view this customer.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId]);

  // Check access permissions
  const hasAccess = useMemo(() => {
    if (isAdmin) return true;
    if (!client) return false;
    const currentId = userProfile?.id || currentUser?.uid;
    return client.owner_id === currentId;
  }, [isAdmin, client, userProfile?.id, currentUser?.uid]);

  // Subscribe to activities for this client (via source lead id and client metadata)
  useEffect(() => {
    if (!client?.source_lead_id) {
      setLoadingActivities(false);
      return;
    }

    setLoadingActivities(true);
    const unsub = subscribeToActivities(
      client.source_lead_id,
      (acts) => {
        setActivities(acts);
        setLoadingActivities(false);
      },
      (err) => {
        console.warn('Could not subscribe to client activities:', err);
        setLoadingActivities(false);
      }
    );

    return () => unsub();
  }, [client?.source_lead_id]);

  // Subscribe to follow-ups for this client
  useEffect(() => {
    if (!client?.source_lead_id) return;

    const unsub = subscribeToFollowUps(
      (allFollowups) => {
        // Filter follow-ups belonging to the source lead or bearing the client's company name
        const clientFollowUps = allFollowups.filter(
          (f) =>
            f.lead_id === client.source_lead_id ||
            f.company_name?.toLowerCase() === client.company_name?.toLowerCase()
        );
        setFollowups(clientFollowUps);
      },
      userProfile?.role
    );

    return () => unsub();
  }, [client?.source_lead_id, client?.company_name, userProfile?.role]);

  // Repeat Opportunities derived from leads where source_client_id === client.id
  const repeatOpportunities = useMemo(() => {
    if (!client) return [];
    return allLeads.filter((l) => l.source_client_id === client.id);
  }, [allLeads, client]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalActivities = activities.length;
    const pendingFollowUps = followups.filter((f) => f.status === 'pending');
    const completedFollowUps = followups.filter((f) => f.status === 'completed');

    // Nearest pending follow-up
    const sortedPending = [...pendingFollowUps].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
    const nextFollowUp = sortedPending[0] || null;

    // Check if next follow-up is overdue
    const isOverdue = nextFollowUp
      ? new Date(nextFollowUp.scheduled_at).getTime() < Date.now()
      : false;

    // Latest communication activity (Call, WhatsApp, Email, Meeting, Site Visit)
    const contactTypes = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Site Visit'];
    const contactActs = activities
      .filter((a) => contactTypes.includes(a.activity_type) && !a.is_system_activity)
      .sort((a, b) => {
        const timeA = new Date(a.activity_date || a.activity_at || a.created_at).getTime();
        const timeB = new Date(b.activity_date || b.activity_at || b.created_at).getTime();
        return timeB - timeA;
      });
    const lastContact = contactActs[0] || null;

    return {
      totalActivities,
      totalFollowups: followups.length,
      pendingCount: pendingFollowUps.length,
      completedCount: completedFollowUps.length,
      nextFollowUp,
      isOverdue,
      lastContact,
    };
  }, [activities, followups]);

  // Filtered follow-ups list
  const filteredFollowUps = useMemo(() => {
    if (followUpFilter === 'all') return followups;
    return followups.filter((f) => f.status === followUpFilter);
  }, [followups, followUpFilter]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleStatus = async (newStatus: ClientStatus) => {
    if (!client || client.status === newStatus || statusUpdating) return;
    try {
      setStatusUpdating(true);
      await updateClient(client.id, { status: newStatus }, client);
    } catch (err: any) {
      console.error('Failed to change client status:', err);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Tag handlers
  const handleSelectTag = async (tagName: string) => {
    if (!client) return;
    await addTagToClient(client.id, tagName);
    setClient((prev) => (prev ? { ...prev, tags: [...(prev.tags || []), tagName] } : null));
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!client) return;
    await removeTagFromClient(client.id, tagName);
    setClient((prev) =>
      prev ? { ...prev, tags: (prev.tags || []).filter((t) => t.toLowerCase() !== tagName.toLowerCase()) } : null
    );
  };

  // Activity logging handler
  const handleLogActivity = async (input: CreateActivityInput) => {
    if (!client) return;
    await createActivity({
      ...input,
      lead_id: client.source_lead_id,
      metadata: {
        ...input.metadata,
        client_id: client.id,
        company_name: client.company_name,
      },
    });
  };

  // Schedule follow-up handler
  const handleScheduleFollowUp = async (data: {
    lead_id: string;
    action: FollowUpActionType;
    scheduled_at: string;
    assigned_to: string;
    notes?: string;
  }) => {
    await createFollowUp({
      lead_id: data.lead_id,
      action: data.action,
      scheduled_at: data.scheduled_at,
      assigned_to: data.assigned_to,
      notes: data.notes,
      company_name: client?.company_name,
      status: 'pending',
    });
  };

  const handleCompleteFollowUp = async (input: CompleteFollowUpInput) => {
    await completeFollowUp(input);
    setSelectedFollowUpForComplete(null);
  };

  const handleRescheduleFollowUp = async (input: RescheduleFollowUpInput) => {
    await rescheduleFollowUp(input);
    setSelectedFollowUpForReschedule(null);
  };

  const handleCancelFollowUp = async (followUp: FollowUpRecord) => {
    if (!window.confirm(`Are you sure you want to cancel the scheduled "${followUp.action}"?`)) {
      return;
    }
    await cancelFollowUp({
      lead_id: followUp.lead_id,
      followup_id: followUp.id,
      cancellation_reason: 'Cancelled from Client Relationship Dashboard',
    });
  };

  const handleOpenScheduleFollowUp = (initialAction?: string) => {
    if (initialAction) {
      setScheduleFollowUpAction(initialAction as FollowUpActionType);
    } else {
      setScheduleFollowUpAction('Customer Check-in');
    }
    setIsScheduleFollowUpOpen(true);
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-3 text-xs font-semibold text-slate-500">Loading client relationship account...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center max-w-lg mx-auto mt-12">
        <AlertCircle className="h-10 w-10 text-rose-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-900">Access Notice</h3>
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

  const assignedSalesmanName =
    client.owner_name || getUserDisplayName(client.owner_id, usersList);
  const isActive = client.status === 'Active';

  // Quick action cleaner strings
  const cleanPhone = (client.phone || client.whatsapp || '').replace(/[^0-9+]/g, '');
  const cleanWhatsapp = (client.whatsapp || client.phone || '').replace(/[^0-9]/g, '');

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      {/* ---------------- Top Navigation & Primary Actions Bar ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Clients</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Create New Opportunity (Repeat Business) Button */}
          <button
            type="button"
            id="client-create-opportunity-btn"
            onClick={() => setIsCreateOpportunityOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>New Opportunity</span>
          </button>

          {/* Schedule Meeting Button */}
          <button
            type="button"
            id="client-schedule-meeting-btn"
            onClick={() => handleOpenScheduleFollowUp('Meeting')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-100 transition cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
            <span>Meeting</span>
          </button>

          {/* Schedule Site Visit Button */}
          <button
            type="button"
            id="client-schedule-visit-btn"
            onClick={() => handleOpenScheduleFollowUp('Site Visit')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition cursor-pointer"
          >
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            <span>Site Visit</span>
          </button>

          {/* Schedule Follow-up Button */}
          <button
            type="button"
            id="client-schedule-followup-btn"
            onClick={() => handleOpenScheduleFollowUp('Customer Check-in')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>Schedule Follow-up</span>
          </button>

          {/* Transfer Ownership (Admin Only) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              <span>Transfer</span>
            </button>
          )}

          {/* Edit Client Button */}
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-600" />
            <span>Edit Account</span>
          </button>
        </div>
      </div>

      {/* Phase S: Merged Status Notice */}
      {client.record_status === 'merged' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-950 text-sm">
              Archived Account (Merged)
            </div>
            <p className="text-amber-800">
              This client record was merged into master account <strong>{client.merged_into_id}</strong> on{' '}
              {client.merged_at ? new Date(client.merged_at).toLocaleDateString() : 'recent date'}.
              All communication activities and follow-ups have been linked to the master customer.
            </p>
          </div>
        </div>
      )}

      {/* Phase S: Potential Duplicate Warning Banner */}
      {duplicateMatches.length > 0 && client.record_status !== 'merged' && (
        <div
          id="client-duplicate-alert"
          className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-2xs space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <GitMerge className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-950 text-sm flex items-center gap-2">
                  <span>Possible Duplicate Client Account Detected</span>
                  <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                    {duplicateMatches[0].confidence_score}% Match
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-1">
                  Existing client <strong>{duplicateMatches[0].record_b.company_name}</strong> shares matching contact details ({duplicateMatches[0].match_reasons.join(', ')}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {isAdmin && (
                <button
                  type="button"
                  id="open-merge-from-client-btn"
                  onClick={() => setActiveMergeCandidate(duplicateMatches[0])}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Review & Merge</span>
                </button>
              )}
              <button
                type="button"
                id="dismiss-duplicate-from-client-btn"
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
        </div>
      )}

      {/* ---------------- Main Customer Header Banner ---------------- */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Left Column: Client Identity */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-100 uppercase tracking-wider">
                <Tag className="h-3 w-3" />
                {client.client_type || 'B2B Commercial'}
              </span>

              {client.location && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {client.location}
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400">
                ID: {client.id.substring(0, 10)}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {client.company_name}
            </h1>

            {client.contact_person && (
              <p className="text-xs sm:text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" />
                <span>Primary Contact:</span>
                <strong className="text-slate-800">{client.contact_person}</strong>
              </p>
            )}

            {/* Phase R: Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5" id="client-tags-container">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Tag className="h-3 w-3 text-slate-400" />
                Tags:
              </span>
              {Array.isArray(client.tags) && client.tags.length > 0 ? (
                client.tags.map((tagName) => (
                  <TagBadge
                    key={tagName}
                    name={tagName}
                    onRemove={() => handleRemoveTag(tagName)}
                  />
                ))
              ) : (
                <span className="text-[11px] text-slate-400 italic">No tags</span>
              )}
              <button
                type="button"
                id="btn-add-tag-to-client"
                onClick={() => setIsTagModalOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-slate-300 hover:border-emerald-400 bg-white text-[11px] font-medium text-emerald-700 hover:bg-emerald-50/50 transition cursor-pointer"
                title="Add tag to client"
              >
                <Plus className="h-3 w-3" />
                <span>Add Tag</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Account Status & Ownership */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50/90 p-4 rounded-xl border border-slate-200/80">
            {/* Account Status Toggle */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Account Status
              </label>
              <div className="relative">
                <select
                  disabled={statusUpdating}
                  value={client.status}
                  onChange={(e) => handleToggleStatus(e.target.value as ClientStatus)}
                  className={`rounded-lg border py-1.5 pl-3 pr-8 text-xs font-bold shadow-2xs focus:outline-none cursor-pointer disabled:opacity-50 ${
                    isActive
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 focus:border-emerald-600'
                      : 'border-slate-300 bg-slate-100 text-slate-700 focus:border-slate-500'
                  }`}
                >
                  <option value="Active">Active Customer</option>
                  <option value="Inactive">Inactive / On Hold</option>
                </select>
                {statusUpdating && (
                  <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-emerald-600" />
                )}
              </div>
            </div>

            {/* Account Owner */}
            <div className="flex flex-col pl-3 border-l border-slate-200">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Assigned Representative
              </label>
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                  {assignedSalesmanName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-800">{assignedSalesmanName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Quick Direct Contact Actions Strip ---------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Direct Reach:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Call */}
          <a
            href={cleanPhone ? `tel:${cleanPhone}` : undefined}
            onClick={(e) => {
              if (!cleanPhone) e.preventDefault();
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
              cleanPhone
                ? 'bg-indigo-50/80 text-indigo-700 border-indigo-200 hover:bg-indigo-100/90 cursor-pointer'
                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
            }`}
            title={cleanPhone ? `Direct Call: ${client.phone || client.whatsapp}` : 'No phone registered'}
          >
            <Phone className="h-3.5 w-3.5 text-indigo-600" />
            <span>Call {client.phone ? `(${client.phone})` : ''}</span>
          </a>

          {/* Quick WhatsApp */}
          <a
            href={cleanWhatsapp ? `https://wa.me/${cleanWhatsapp}` : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!cleanWhatsapp) e.preventDefault();
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
              cleanWhatsapp
                ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100/90 cursor-pointer'
                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
            }`}
            title={cleanWhatsapp ? `Open WhatsApp: ${client.whatsapp || client.phone}` : 'No WhatsApp registered'}
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
            <span>WhatsApp</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>

          {/* Quick Email */}
          <a
            href={client.email ? `mailto:${client.email}` : undefined}
            onClick={(e) => {
              if (!client.email) e.preventDefault();
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
              client.email
                ? 'bg-blue-50/80 text-blue-700 border-blue-200 hover:bg-blue-100/90 cursor-pointer'
                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
            }`}
            title={client.email ? `Send Email: ${client.email}` : 'No email registered'}
          >
            <Mail className="h-3.5 w-3.5 text-blue-600" />
            <span>Email</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>

          {/* Quick Log Interaction */}
          <button
            type="button"
            onClick={() => setActiveTab('communication')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-slate-600" />
            <span>Log Interaction</span>
          </button>
        </div>
      </div>

      {/* ---------------- Post-Sale Relationship Health Strip (Section 11, 12, 19) ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Activities Logged */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Customer Interactions</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Phone className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-slate-900">{metrics.totalActivities}</div>
            <p className="text-[11px] text-slate-500">
              Total activities recorded across calls, meetings, and check-ins
            </p>
          </div>
        </div>

        {/* Card 2: Follow-up Health */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Follow-up Tracking</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{metrics.totalFollowups}</span>
              <span className="text-xs font-bold text-emerald-700">
                {metrics.completedCount} Done
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {metrics.pendingCount} pending task{metrics.pendingCount === 1 ? '' : 's'} scheduled
            </p>
          </div>
        </div>

        {/* Card 3: Last Contacted */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Last Interaction</span>
            <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          {metrics.lastContact ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                  {metrics.lastContact.activity_type}
                </span>
                <span className="text-xs font-bold text-slate-800 truncate">
                  {metrics.lastContact.outcome || 'Logged'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {formatTimestamp(metrics.lastContact.activity_date || metrics.lastContact.activity_at)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No direct interactions recorded yet</p>
          )}
        </div>

        {/* Card 4: Next Follow-up Action */}
        <div
          className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between ${
            metrics.isOverdue
              ? 'border-rose-200 bg-rose-50/40'
              : metrics.nextFollowUp
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className={metrics.isOverdue ? 'text-rose-800' : 'text-slate-500'}>
              {metrics.isOverdue ? 'Overdue Follow-up' : 'Next Follow-up'}
            </span>
            <div
              className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                metrics.isOverdue
                  ? 'bg-rose-100 text-rose-700'
                  : metrics.nextFollowUp
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
            </div>
          </div>

          {metrics.nextFollowUp ? (
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900 truncate">
                {metrics.nextFollowUp.action}
              </div>
              <p
                className={`text-[11px] font-semibold ${
                  metrics.isOverdue ? 'text-rose-700' : 'text-slate-600'
                }`}
              >
                {formatTimestamp(metrics.nextFollowUp.scheduled_at)}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-400 italic mb-1.5">No upcoming follow-up</p>
              <button
                type="button"
                onClick={() => handleOpenScheduleFollowUp('Customer Check-in')}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Schedule Now</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Navigation Tabs ---------------- */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('communication')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'communication'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Communication Center</span>
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {activities.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Activity Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followups')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'followups'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            <span>Follow-ups & Check-ins</span>
            {metrics.pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[11px] font-bold">
                {metrics.pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('opportunities')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'opportunities'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Repeat Opportunities</span>
            {repeatOpportunities.length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-bold">
                {repeatOpportunities.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Account Profile</span>
          </button>
        </nav>
      </div>

      {/* ---------------- Tab Contents ---------------- */}

      {/* TAB 1: COMMUNICATION CENTER */}
      {activeTab === 'communication' && (
        <div className="space-y-6">
          <CommunicationCenter
            client={client}
            activities={activities}
            followups={followups}
            loadingActivities={loadingActivities}
            onLogActivity={handleLogActivity}
            onOpenScheduleFollowUp={handleOpenScheduleFollowUp}
            hasAccess={hasAccess}
          />
        </div>
      )}

      {/* TAB 2: ACTIVITY TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Complete Historical Audit Timeline</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological record of all system events, sales interactions, conversion milestones, and follow-ups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('communication')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 text-indigo-700 px-3 py-1.5 text-xs font-bold hover:bg-indigo-100 transition self-start sm:self-auto cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Log New Activity</span>
              </button>
            </div>

            <ActivityTimeline
              activities={activities}
              loading={loadingActivities}
              onLogFirstActivity={() => setActiveTab('communication')}
            />
          </div>
        </div>
      )}

      {/* TAB 3: FOLLOW-UPS & CHECK-INS */}
      {activeTab === 'followups' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Customer Follow-ups & Relationship Check-ins</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage post-sale check-ins, repeat order discussions, payment verifications, and scheduled calls.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenScheduleFollowUp('Customer Check-in')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>Schedule Follow-up</span>
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFollowUpFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  followUpFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({followups.length})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('pending')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  followUpFilter === 'pending'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                Pending ({metrics.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('completed')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  followUpFilter === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Completed ({metrics.completedCount})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('cancelled')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  followUpFilter === 'cancelled'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Cancelled ({followups.filter((f) => f.status === 'cancelled').length})
              </button>
            </div>

            {/* Follow-ups List */}
            {filteredFollowUps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <Clock className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-800">No Follow-ups Found</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {followUpFilter === 'all'
                    ? 'No follow-up actions have been scheduled for this client yet.'
                    : `No ${followUpFilter} follow-ups in this account.`}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenScheduleFollowUp('Customer Check-in')}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  <span>Schedule a Check-in Now</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFollowUps.map((fu) => {
                  const isPending = fu.status === 'pending';
                  const isCompleted = fu.status === 'completed';
                  const isCancelled = fu.status === 'cancelled';
                  const isOverdue = isPending && new Date(fu.scheduled_at).getTime() < Date.now();

                  return (
                    <div
                      key={fu.id}
                      className={`rounded-xl border p-4 transition ${
                        isOverdue
                          ? 'border-rose-300 bg-rose-50/40'
                          : isPending
                          ? 'border-indigo-100 bg-indigo-50/20 hover:border-indigo-200'
                          : isCompleted
                          ? 'border-slate-200 bg-slate-50/60'
                          : 'border-slate-200 bg-slate-50/40 opacity-70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isOverdue
                                  ? 'bg-rose-100 text-rose-800'
                                  : isPending
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {fu.action}
                            </span>

                            <span className="text-xs font-bold text-slate-900">
                              {formatTimestamp(fu.scheduled_at)}
                            </span>

                            {fu.title && (
                              <span className="text-xs font-semibold text-slate-700">
                                • {fu.title}
                              </span>
                            )}

                            {fu.location && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <MapPin className="h-3 w-3 text-rose-500" />
                                <span>{fu.location}</span>
                              </span>
                            )}

                            {isOverdue && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white">
                                Overdue
                              </span>
                            )}
                          </div>

                          {fu.notes && (
                            <p className="text-xs text-slate-600 line-clamp-2">{fu.notes}</p>
                          )}

                          {isCompleted && fu.outcome && (
                            <div className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Outcome: {fu.outcome}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span>
                              Assigned:{' '}
                              <strong>{fu.assigned_to_name || getUserDisplayName(fu.assigned_to, usersList)}</strong>
                            </span>
                            {fu.completed_at && (
                              <span>Completed: {formatTimestamp(fu.completed_at)}</span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {isPending && hasAccess && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedFollowUpForComplete(fu)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                              <span>Complete</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedFollowUpForReschedule(fu)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Reschedule</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCancelFollowUp(fu)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Cancel follow-up"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REPEAT OPPORTUNITIES */}
      {activeTab === 'opportunities' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Repeat Business & New Sales Opportunities
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clients are long-term relationship accounts. When this client has a new requirement, a separate opportunity is created while preserving this customer relationship record.
                </p>
              </div>

              <button
                type="button"
                id="tab-create-opportunity-btn"
                onClick={() => setIsCreateOpportunityOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition cursor-pointer shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Create New Opportunity</span>
              </button>
            </div>

            {/* Repeat opportunities listing */}
            {repeatOpportunities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-3">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-950">No Repeat Opportunities Yet</h4>
                <p className="text-xs text-emerald-800/80 mt-1 max-w-md mx-auto">
                  When this customer requests new products, services, or renewals, initiate a new sales opportunity to track it through the pipeline without modifying existing won deals.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateOpportunityOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Initiate First Repeat Opportunity</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {repeatOpportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-100 mb-1">
                          {opp.status}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">
                          {opp.project_name || opp.company_name}
                        </h4>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block font-semibold">Value</span>
                        <span className="text-sm font-black text-slate-900">
                          {opp.estimated_value
                            ? `SAR ${opp.estimated_value.toLocaleString()}`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                      <div>
                        <span className="block text-slate-400 font-medium">Priority:</span>
                        <span className="font-bold text-slate-700">{opp.priority}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 font-medium">Created:</span>
                        <span className="font-semibold text-slate-700">
                          {opp.created_at ? new Date(opp.created_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Assigned: <strong>{getUserDisplayName(opp.assigned_to, usersList)}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => onNavigateToLead(opp.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 transition cursor-pointer"
                      >
                        <span>Open Deal</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ACCOUNT PROFILE & SOURCE AUDIT */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Historical Source Lead Anchor */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                  <h3 className="text-sm font-bold text-emerald-950">
                    Original Source Lead Anchor & Audit Traceability
                  </h3>
                </div>
                <p className="text-xs text-emerald-800/90 max-w-2xl">
                  This Client account was converted from Won Lead{' '}
                  <strong className="text-emerald-950">
                    {sourceLead?.project_name || sourceLead?.company_name || client.source_lead_id}
                  </strong>
                  . The original lead and all historical records remain permanently preserved.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigateToLead(client.source_lead_id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition cursor-pointer"
                >
                  <span>View Source Lead</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {sourceLead && (
              <div className="mt-4 pt-3 border-t border-emerald-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-emerald-700 block text-[11px]">Original Value:</span>
                  <span className="font-black text-emerald-950">
                    {sourceLead.estimated_value
                      ? `SAR ${sourceLead.estimated_value.toLocaleString()}`
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[11px]">Original Status:</span>
                  <span className="font-bold text-emerald-950">{sourceLead.status}</span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[11px]">Original Creation:</span>
                  <span className="font-semibold text-emerald-950">
                    {sourceLead.created_at ? new Date(sourceLead.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[11px]">Converted On:</span>
                  <span className="font-semibold text-emerald-950">
                    {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'Recent'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Detailed Contact Channels */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Detailed Account Contact Information
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                  >
                    Edit Contact Details
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Phone */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px]">Direct Phone:</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {client.phone || 'Not recorded'}
                      </span>
                    </div>
                    {client.phone && (
                      <button
                        type="button"
                        onClick={() => handleCopy(client.phone!, 'phone')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                        title="Copy phone"
                      >
                        {copiedField === 'phone' ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* WhatsApp */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px]">WhatsApp:</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {client.whatsapp || 'Not recorded'}
                      </span>
                    </div>
                    {client.whatsapp && (
                      <button
                        type="button"
                        onClick={() => handleCopy(client.whatsapp!, 'whatsapp')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                        title="Copy WhatsApp"
                      >
                        {copiedField === 'whatsapp' ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Email */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 flex items-center justify-between sm:col-span-2">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px]">Email Address:</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {client.email || 'Not recorded'}
                      </span>
                    </div>
                    {client.email && (
                      <button
                        type="button"
                        onClick={() => handleCopy(client.email!, 'email')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                        title="Copy Email"
                      >
                        {copiedField === 'email' ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Location */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <span className="text-slate-400 font-semibold block text-[11px]">Location / City:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {client.location || 'Not specified'}
                    </span>
                  </div>

                  {/* Classification */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <span className="text-slate-400 font-semibold block text-[11px]">Classification:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {client.client_type || 'B2B Commercial'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Handover & Relationship Notes */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Relationship Notes & Briefing</h3>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                  >
                    Edit Notes
                  </button>
                </div>

                {client.notes ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {client.notes}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No special handover notes recorded.</p>
                )}
              </div>
            </div>

            {/* Right 1 Col: Account Overview & Metadata */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Account Overview
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Account ID</span>
                    <span className="font-mono text-slate-700">{client.id.substring(0, 10)}...</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Account Status</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {client.status}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Assigned Representative</span>
                    <span className="font-bold text-slate-800">{assignedSalesmanName}</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Converted Date</span>
                    <span className="font-medium text-slate-700">
                      {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Last Updated</span>
                    <span className="font-medium text-slate-700">
                      {client.updated_at ? new Date(client.updated_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Modals ---------------- */}

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        client={client}
      />

      {/* Transfer Ownership Modal (Admin Only) */}
      {isAdmin && (
        <TransferClientModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          client={client}
          currentOwnerName={assignedSalesmanName}
        />
      )}

      {/* Create Repeat Opportunity Modal */}
      <CreateOpportunityModal
        isOpen={isCreateOpportunityOpen}
        client={client}
        onClose={() => setIsCreateOpportunityOpen(false)}
        onOpportunityCreated={(newLead) => {
          setIsCreateOpportunityOpen(false);
          setActiveTab('opportunities');
        }}
      />

      {/* Schedule Follow-up Modal */}
      <ScheduleFollowUpModal
        isOpen={isScheduleFollowUpOpen}
        leads={
          sourceLead
            ? [sourceLead, ...allLeads.filter((l) => l.id !== sourceLead.id)]
            : allLeads
        }
        users={usersList}
        initialLeadId={client.source_lead_id}
        initialAction={scheduleFollowUpAction}
        onClose={() => setIsScheduleFollowUpOpen(false)}
        onSchedule={handleScheduleFollowUp}
      />

      {/* Complete Follow-up Modal */}
      <CompleteFollowUpModal
        isOpen={!!selectedFollowUpForComplete}
        followUp={selectedFollowUpForComplete}
        onClose={() => setSelectedFollowUpForComplete(null)}
        onComplete={handleCompleteFollowUp}
      />

      {/* Reschedule Follow-up Modal */}
      <RescheduleFollowUpModal
        isOpen={!!selectedFollowUpForReschedule}
        followUp={selectedFollowUpForReschedule}
        onClose={() => setSelectedFollowUpForReschedule(null)}
        onReschedule={handleRescheduleFollowUp}
      />

      {/* Tag Selector Modal (Phase R) */}
      {client && (
        <TagSelectorModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          entityType="Client"
          currentTags={client.tags || []}
          onSelectTag={handleSelectTag}
          onRemoveTag={handleRemoveTag}
          entityName={client.company_name}
        />
      )}

      {/* Record Merge Modal (Phase S) */}
      {activeMergeCandidate && client && (
        <RecordMergeModal
          isOpen={true}
          onClose={() => setActiveMergeCandidate(null)}
          entityType="Client"
          recordA={activeMergeCandidate.record_a}
          recordB={activeMergeCandidate.record_b}
          matchReason={activeMergeCandidate.match_reasons.join(' • ')}
          matchScore={activeMergeCandidate.confidence_score}
          onMergeSuccess={() => {
            setActiveMergeCandidate(null);
            setDuplicateMatches([]);
          }}
          onMarkNotDuplicate={() => {
            setActiveMergeCandidate(null);
            setDuplicateMatches((prev) => prev.filter((m) => m.pair_id !== activeMergeCandidate.pair_id));
          }}
        />
      )}
    </div>
  );
};
