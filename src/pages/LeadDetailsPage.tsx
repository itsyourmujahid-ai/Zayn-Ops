import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building,
  User,
  Users,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Briefcase,
  DollarSign,
  FileText,
  Edit3,
  UserCheck,
  Plus,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Loader2,
  ChevronDown,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Send,
  ExternalLink,
  Filter,
  Paperclip,
  FolderPlus,
  Tag as TagIcon,
  GitMerge,
} from 'lucide-react';
import {
  LeadRecord,
  LeadActivityRecord,
  FollowUpRecord,
  FollowUpActionType,
  LeadStatus,
  Priority,
  ActivityType,
  CreateActivityInput,
  CreateFollowUpInput,
  UserProfile,
  AttachmentRecord,
  AttachmentCategory,
  DuplicateMatchCandidate,
} from '../types/database';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToSingleLead,
  subscribeToActivities,
  subscribeToLeadAttachments,
  subscribeToLeadFollowUps,
  createFollowUp,
  uploadLeadAttachment,
  deleteLeadAttachment,
  createActivity,
  updateLeadStatus,
  updateLeadPriority,
  reassignLead,
  updateLeadInformation,
  getUserDisplayName,
  getAllUsers,
  formatFileSize,
  addTagToLead,
  removeTagFromLead,
  getLeads,
  getLocalNotDuplicates,
  markAsNotDuplicate,
} from '../lib/dal';
import { findPotentialMatchesForLeadInput } from '../lib/dataQuality';
import { RecordMergeModal } from '../components/data-quality/RecordMergeModal';
import { TagBadge } from '../components/TagBadge';
import { TagSelectorModal } from '../components/TagSelectorModal';
import { LogActivityModal } from '../components/lead-details/LogActivityModal';
import { QuickContactPrompt } from '../components/lead-details/QuickContactPrompt';
import { EditLeadModal } from '../components/lead-details/EditLeadModal';
import { ReassignLeadModal } from '../components/lead-details/ReassignLeadModal';
import { ActivityTimeline } from '../components/lead-details/ActivityTimeline';
import { AttachmentsSection } from '../components/lead-details/AttachmentsSection';
import { CommunicationCenter } from '../components/lead-details/CommunicationCenter';
import { ScheduleFollowUpModal } from '../components/followups/ScheduleFollowUpModal';
import { ConvertToClientModal } from '../components/lead-details/ConvertToClientModal';

interface LeadDetailsPageProps {
  leadId: string;
  onBack: () => void;
  onNavigateToClient?: (clientId: string) => void;
}

const ALL_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'New', label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'Contacted', label: 'Contacted', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'Interested', label: 'Interested', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'Meeting', label: 'Meeting Scheduled', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'Quotation', label: 'Quotation Sent', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'Negotiation', label: 'Negotiation', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'Won', label: 'Won', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'Lost', label: 'Lost', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const ALL_PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'Hot', label: 'Hot', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'Warm', label: 'Warm', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'Cold', label: 'Cold', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];

export const LeadDetailsPage: React.FC<LeadDetailsPageProps> = ({
  leadId,
  onBack,
  onNavigateToClient,
}) => {
  const { userProfile, currentUser, isAdmin } = useAuth();

  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType>('Call');
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState<boolean>(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState<boolean>(false);
  const [isScheduleFollowUpModalOpen, setIsScheduleFollowUpModalOpen] = useState<boolean>(false);
  const [scheduleFollowUpInitialAction, setScheduleFollowUpInitialAction] = useState<FollowUpActionType>('Call');
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [quickPrompt, setQuickPrompt] = useState<{
    isOpen: boolean;
    type: ActivityType;
  }>({ isOpen: false, type: 'Call' });

  // Status & Priority update loading
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const [priorityUpdating, setPriorityUpdating] = useState<boolean>(false);

  // Tab & Filter states: Default to 'communication' (Phase N Sales Communication Center)
  const [activeTab, setActiveTab] = useState<'communication' | 'timeline' | 'attachments'>('communication');
  const [timelineFilter, setTimelineFilter] = useState<string>('all');

  // Attachments state
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState<boolean>(true);

  // Phase S: Duplicate candidate tracking
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatchCandidate[]>([]);
  const [activeMergeCandidate, setActiveMergeCandidate] = useState<DuplicateMatchCandidate | null>(null);

  // Load users list for name resolution
  useEffect(() => {
    getAllUsers()
      .then((users) => setUsersList(users))
      .catch(() => {});
  }, []);

  // Check for potential duplicate leads in real-time
  useEffect(() => {
    if (!lead || lead.record_status === 'merged') {
      setDuplicateMatches([]);
      return;
    }
    let isMounted = true;
    getLeads({ userRole: 'ADMIN', includeMerged: false }).then((allLeads) => {
      if (!isMounted) return;
      const otherLeads = allLeads.filter((l) => l.id !== lead.id);
      const notDups = getLocalNotDuplicates();
      const matches = findPotentialMatchesForLeadInput(lead, otherLeads, notDups);
      setDuplicateMatches(matches);
    });
    return () => {
      isMounted = false;
    };
  }, [lead?.id, lead?.company_name, lead?.phone, lead?.email, lead?.whatsapp, lead?.record_status]);

  // Real-time Lead, Activities, Follow-ups & Attachments Subscription
  useEffect(() => {
    if (!leadId) {
      setError('Invalid lead identifier.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setAttachmentsLoading(true);
    setError(null);

    // 1. Subscribe to Lead Record
    const unsubLead = subscribeToSingleLead(
      leadId,
      (updatedLead) => {
        if (!updatedLead) {
          setError('Lead not found in CRM database.');
        } else {
          setLead(updatedLead);
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Lead subscription notice:', err);
        setLoading(false);
      }
    );

    // 2. Subscribe to Activities Subcollection
    const unsubActivities = subscribeToActivities(
      leadId,
      (updatedActivities) => {
        setActivities(updatedActivities);
      },
      (err) => {
        console.warn('Activities subscription notice:', err);
      }
    );

    // 3. Subscribe to Follow-ups Subcollection (Section 12 Next Action & Follow-ups)
    const unsubFollowups = subscribeToLeadFollowUps(
      leadId,
      (updatedFollowups) => {
        setFollowups(updatedFollowups);
      },
      (err) => {
        console.warn('Lead followups subscription notice:', err);
      }
    );

    // 4. Subscribe to Attachments Subcollection
    const unsubAttachments = subscribeToLeadAttachments(
      leadId,
      (updatedAttachments) => {
        setAttachments(updatedAttachments);
        setAttachmentsLoading(false);
      },
      (err) => {
        console.warn('Attachments subscription notice:', err);
        setAttachmentsLoading(false);
      }
    );

    return () => {
      unsubLead();
      unsubActivities();
      unsubFollowups();
      unsubAttachments();
    };
  }, [leadId]);

  // Security Check: Salesmen can only access leads they own or created
  const currentUserId = userProfile?.id || currentUser?.uid || '';
  const hasAccess =
    isAdmin ||
    !lead ||
    lead.assigned_to === currentUserId ||
    lead.created_by === currentUserId;

  // Handle Quick Contact Action
  const handleQuickContact = (type: ActivityType) => {
    if (!lead) return;

    if (type === 'Call' && lead.phone) {
      window.location.href = `tel:${lead.phone}`;
      setQuickPrompt({ isOpen: true, type: 'Call' });
    } else if (type === 'WhatsApp') {
      const targetPhone = lead.whatsapp || lead.phone;
      if (targetPhone) {
        const cleanNumber = targetPhone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${cleanNumber}`, '_blank');
        setQuickPrompt({ isOpen: true, type: 'WhatsApp' });
      }
    } else if (type === 'Email' && lead.email) {
      window.location.href = `mailto:${lead.email}`;
      setQuickPrompt({ isOpen: true, type: 'Email' });
    }
  };

  // Open Log Modal pre-filled
  const openLogModal = (type: ActivityType = 'Call') => {
    setSelectedActivityType(type);
    setIsLogModalOpen(true);
  };

  // Handle Activity Logging Submit
  const handleLogActivitySubmit = async (input: CreateActivityInput) => {
    await createActivity(input);
  };

  // Handle Status Update
  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead || lead.status === newStatus || statusUpdating) return;
    try {
      setStatusUpdating(true);
      const performerName =
        userProfile?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
      await updateLeadStatus(lead.id, newStatus, lead, currentUserId, performerName);
      if (newStatus === 'Won' && !lead.converted_to_client_id) {
        setTimeout(() => {
          setIsConvertModalOpen(true);
        }, 350);
      }
    } catch (err: any) {
      console.error('Failed to change lead status:', err);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle Priority Update
  const handlePriorityChange = async (newPriority: Priority) => {
    if (!lead || lead.priority === newPriority || priorityUpdating) return;
    try {
      setPriorityUpdating(true);
      const performerName =
        userProfile?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
      await updateLeadPriority(lead.id, newPriority, lead, currentUserId, performerName);
    } catch (err: any) {
      console.error('Failed to change lead priority:', err);
    } finally {
      setPriorityUpdating(false);
    }
  };

  // Handle Reassign
  const handleReassignSubmit = async (newOwnerId: string, newOwnerName: string, reason: string) => {
    if (!lead) return;
    const currentOwnerName = getUserDisplayName(lead.assigned_to, usersList);
    const performerName =
      userProfile?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';
    await reassignLead(
      lead.id,
      newOwnerId,
      newOwnerName,
      currentOwnerName,
      reason,
      currentUserId,
      performerName
    );
  };

  // Handle Edit Lead Information
  const handleSaveLeadInfo = async (updatedData: Partial<LeadRecord>) => {
    if (!lead) return;
    await updateLeadInformation(lead.id, updatedData);
  };

  // Handle Tags
  const handleSelectTag = async (tagName: string) => {
    if (!lead) return;
    await addTagToLead(lead.id, tagName);
    setLead((prev) => (prev ? { ...prev, tags: [...(prev.tags || []), tagName] } : null));
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!lead) return;
    await removeTagFromLead(lead.id, tagName);
    setLead((prev) =>
      prev ? { ...prev, tags: (prev.tags || []).filter((t) => t.toLowerCase() !== tagName.toLowerCase()) } : null
    );
  };

  // Handle Attachment Upload
  const handleUploadAttachment = async (
    file: File,
    category: AttachmentCategory,
    description: string,
    onProgress: (p: number) => void
  ) => {
    if (!lead) return;
    await uploadLeadAttachment(
      {
        lead_id: lead.id,
        file,
        category,
        description,
        onProgress,
      },
      userProfile?.role
    );
  };

  // Handle Attachment Deletion
  const handleDeleteAttachment = async (attachment: AttachmentRecord) => {
    if (!lead) return;
    const performerName =
      userProfile?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
    await deleteLeadAttachment(
      lead.id,
      attachment,
      userProfile?.role,
      currentUserId,
      performerName
    );
  };

  // Filtered Activities
  const filteredActivities = activities.filter((act) => {
    if (timelineFilter === 'all') return true;
    if (timelineFilter === 'user') return !act.is_system_activity;
    if (timelineFilter === 'system') return act.is_system_activity;
    if (timelineFilter === 'calls') return act.activity_type === 'Call';
    if (timelineFilter === 'messages') return act.activity_type === 'WhatsApp' || act.activity_type === 'Email';
    if (timelineFilter === 'meetings') return act.activity_type === 'Meeting' || act.activity_type === 'Site Visit';
    return true;
  });

  // Derived communication metrics for the left summary card and tabs
  const communicationActivities = activities.filter((act) => !act.is_system_activity);
  const pendingFollowups = followups.filter((f) => f.status === 'pending');
  const nextPendingFollowUp = [...pendingFollowups].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )[0];
  const lastContactActivity = communicationActivities[0] || null;

  const callsCount = communicationActivities.filter((a) => a.activity_type === 'Call').length;
  const whatsappCount = communicationActivities.filter((a) => a.activity_type === 'WhatsApp').length;
  const emailCount = communicationActivities.filter((a) => a.activity_type === 'Email').length;
  const meetingCount = communicationActivities.filter(
    (a) => a.activity_type === 'Meeting' || a.activity_type === 'Site Visit'
  ).length;

  // -------------------------------------------------------------
  // Loading State
  // -------------------------------------------------------------
  if (loading && !lead) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Loading Lead Record...</h3>
        <p className="text-xs text-slate-500 mt-1">Retrieving account data and activity timeline.</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Error / Not Found State
  // -------------------------------------------------------------
  if (error || !lead) {
    return (
      <div className="mx-auto max-w-lg p-6 my-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Lead Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          {error || 'The requested lead record could not be loaded or may have been deleted.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Leads List</span>
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Access Denied State (For Salesmen viewing unauthorized leads)
  // -------------------------------------------------------------
  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-lg p-6 my-12 text-center bg-white rounded-2xl border border-rose-200 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-xs text-slate-600 mt-1 mb-5">
          You do not have permission to view this lead record. In accordance with CRM security policy,
          sales representatives may only access accounts assigned to their portfolio.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to My Assigned Leads</span>
        </button>
      </div>
    );
  }

  const assignedSalesmanName = getUserDisplayName(lead.assigned_to, usersList);
  const createdByName = getUserDisplayName(lead.created_by, usersList);

  return (
    <div className="space-y-6 pb-12">
      {/* ---------------- Top Breadcrumb & Navigation Bar ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Leads</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Phase O: Convert to Client or Converted Badge */}
          {lead.converted_to_client_id ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Converted to Client</span>
              {onNavigateToClient && (
                <button
                  type="button"
                  onClick={() => onNavigateToClient(lead.converted_to_client_id!)}
                  className="ml-1 text-emerald-700 underline hover:text-emerald-950 font-semibold cursor-pointer inline-flex items-center gap-0.5"
                >
                  <span>View Client</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : lead.status === 'Won' ? (
            <button
              type="button"
              onClick={() => setIsConvertModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
            >
              <Building className="h-3.5 w-3.5" />
              <span>Convert to Client</span>
            </button>
          ) : null}

          {/* Reassign Button (Admin Only) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsReassignModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              <span>Reassign Owner</span>
            </button>
          )}

          {/* Schedule Meeting Button */}
          <button
            type="button"
            id="lead-schedule-meeting-btn"
            onClick={() => {
              setScheduleFollowUpInitialAction('Meeting');
              setIsScheduleFollowUpModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-100 transition cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
            <span>Meeting</span>
          </button>

          {/* Schedule Site Visit Button */}
          <button
            type="button"
            id="lead-schedule-visit-btn"
            onClick={() => {
              setScheduleFollowUpInitialAction('Site Visit');
              setIsScheduleFollowUpModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition cursor-pointer"
          >
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            <span>Site Visit</span>
          </button>

          {/* Edit Lead Button */}
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-600" />
            <span>Edit Information</span>
          </button>

          {/* Primary Log Activity Button */}
          <button
            type="button"
            onClick={() => openLogModal('Call')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>+ Log Activity</span>
          </button>
        </div>
      </div>

      {/* Phase S: Merged Status Notice */}
      {lead.record_status === 'merged' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-950 text-sm">
              Archived Record (Merged)
            </div>
            <p className="text-amber-800">
              This lead was consolidated into master record <strong>{lead.merged_into_id}</strong> on{' '}
              {lead.merged_at ? new Date(lead.merged_at).toLocaleDateString() : 'recent date'}.
              All historical communication, follow-ups, and attachments have been preserved on the master account.
            </p>
          </div>
        </div>
      )}

      {/* Phase S: Potential Duplicate Warning Banner */}
      {duplicateMatches.length > 0 && lead.record_status !== 'merged' && (
        <div
          id="lead-duplicate-alert"
          className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-2xs space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <GitMerge className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-950 text-sm flex items-center gap-2">
                  <span>Possible Duplicate Lead Detected</span>
                  <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                    {duplicateMatches[0].confidence_score}% Match
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-1">
                  Existing lead <strong>{duplicateMatches[0].record_b.company_name}</strong> shares matching contact details ({duplicateMatches[0].match_reasons.join(', ')}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {isAdmin && (
                <button
                  type="button"
                  id="open-merge-from-lead-btn"
                  onClick={() => setActiveMergeCandidate(duplicateMatches[0])}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Review & Merge</span>
                </button>
              )}
              <button
                type="button"
                id="dismiss-duplicate-from-lead-btn"
                onClick={async () => {
                  await markAsNotDuplicate(lead.id, duplicateMatches[0].record_b.id, 'Lead');
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

      {/* ---------------- Main Lead Header Banner ---------------- */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Left Column: Company & Primary Info */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-100">
                {lead.lead_type || 'Direct Client'}
              </span>
              {lead.project_type && (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {lead.project_type}
                </span>
              )}
              {lead.location && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {lead.location}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {lead.company_name}
            </h1>

            {lead.contact_person && (
              <p className="text-xs sm:text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" />
                <span>Contact:</span>
                <strong className="text-slate-800">{lead.contact_person}</strong>
              </p>
            )}

            {/* Phase R: Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5" id="lead-tags-container">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <TagIcon className="h-3 w-3 text-slate-400" />
                Tags:
              </span>
              {Array.isArray(lead.tags) && lead.tags.length > 0 ? (
                lead.tags.map((tagName) => (
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
                id="btn-add-tag-to-lead"
                onClick={() => setIsTagModalOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-slate-300 hover:border-indigo-400 bg-white text-[11px] font-medium text-indigo-600 hover:bg-indigo-50/50 transition cursor-pointer"
                title="Add tag to lead"
              >
                <Plus className="h-3 w-3" />
                <span>Add Tag</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Status & Priority Selectors */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
            {/* Stage / Status Selector */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Pipeline Stage
              </label>
              <div className="relative">
                <select
                  disabled={statusUpdating}
                  value={lead.status}
                  onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                  className="rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs font-bold text-slate-800 shadow-2xs focus:border-indigo-600 focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  {ALL_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                {statusUpdating && (
                  <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-indigo-600" />
                )}
              </div>
            </div>

            {/* Priority Selector */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Urgency / Priority
              </label>
              <div className="relative">
                <select
                  disabled={priorityUpdating}
                  value={lead.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                  className="rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs font-bold text-slate-800 shadow-2xs focus:border-indigo-600 focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  {ALL_PRIORITIES.map((pr) => (
                    <option key={pr.value} value={pr.value}>
                      {pr.label} Priority
                    </option>
                  ))}
                </select>
                {priorityUpdating && (
                  <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-indigo-600" />
                )}
              </div>
            </div>

            {/* Assigned Rep Card */}
            <div className="flex flex-col pl-2 border-l border-slate-200">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Representative
              </label>
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                  {assignedSalesmanName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-800 truncate max-w-[110px]">
                  {assignedSalesmanName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- Quick Contact Action Strip ---------------- */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Call */}
            {lead.phone ? (
              <button
                type="button"
                onClick={() => handleQuickContact('Call')}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
              >
                <Phone className="h-3.5 w-3.5 text-indigo-600" />
                <span>Call {lead.phone}</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Phone className="h-3.5 w-3.5" />
                <span>No phone number</span>
              </span>
            )}

            {/* WhatsApp */}
            {(lead.whatsapp || lead.phone) && (
              <button
                type="button"
                onClick={() => handleQuickContact('WhatsApp')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>
            )}

            {/* Email */}
            {lead.email && (
              <button
                type="button"
                onClick={() => handleQuickContact('Email')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <span>Email {lead.email}</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Interacting launches your device dialer/app; prompt will offer quick activity logging.
          </p>
        </div>
      </div>

      {/* ---------------- 2-Column Responsive Layout ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Lead Information & Specs (4 cols on desktop) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Key Account Profile Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Building className="h-4 w-4 text-indigo-600" />
              <span>Contact & Portfolio Info</span>
            </h3>

            <div className="divide-y divide-slate-100 text-xs space-y-2.5">
              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">Company Name:</span>
                <span className="font-bold text-slate-900 text-right">{lead.company_name}</span>
              </div>

              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">Contact Person:</span>
                <span className="font-semibold text-slate-800 text-right">{lead.contact_person || '—'}</span>
              </div>

              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">Phone:</span>
                <span className="font-semibold text-slate-800 text-right font-mono">{lead.phone || '—'}</span>
              </div>

              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">WhatsApp:</span>
                <span className="font-semibold text-slate-800 text-right font-mono">{lead.whatsapp || lead.phone || '—'}</span>
              </div>

              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-semibold text-slate-800 text-right truncate max-w-[160px]">{lead.email || '—'}</span>
              </div>

              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">Location:</span>
                <span className="font-semibold text-slate-800 text-right">{lead.location || '—'}</span>
              </div>

              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">Assigned Rep:</span>
                <span className="font-bold text-indigo-700 text-right">{assignedSalesmanName}</span>
              </div>

              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">Created By:</span>
                <span className="font-semibold text-slate-700 text-right">{createdByName}</span>
              </div>

              <div className="pt-2 flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">Registered:</span>
                <span className="text-slate-600 text-right">
                  {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Communication Status & Next Follow-up Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-600" />
                <span>Communication Status</span>
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {communicationActivities.length} logs
              </span>
            </div>

            {/* Last Contact Row */}
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
                <span>Last Interaction</span>
                {lastContactActivity && (
                  <span className="font-bold text-slate-700">
                    {lastContactActivity.activity_type}
                  </span>
                )}
              </div>
              {lastContactActivity ? (
                <div>
                  <p className="font-semibold text-slate-800">
                    {new Date(lastContactActivity.activity_date).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    by {lastContactActivity.performer_name || 'Team member'}
                    {lastContactActivity.outcome ? ` • ${lastContactActivity.outcome}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 italic text-[11px]">No previous contact recorded</p>
              )}
            </div>

            {/* Next Scheduled Follow-up Row */}
            <div className="rounded-xl bg-amber-50/60 p-3 border border-amber-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-amber-600" />
                  Next Follow-up
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleFollowUpInitialAction('Call');
                    setIsScheduleFollowUpModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer"
                >
                  {nextPendingFollowUp ? 'Change' : '+ Schedule'}
                </button>
              </div>

              {nextPendingFollowUp ? (
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                      {nextPendingFollowUp.action_type}
                    </span>
                    <span>
                      {new Date(nextPendingFollowUp.scheduled_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      at{' '}
                      {new Date(nextPendingFollowUp.scheduled_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {nextPendingFollowUp.description && (
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">
                      "{nextPendingFollowUp.description}"
                    </p>
                  )}
                </div>
              ) : lead.next_action ? (
                <div>
                  <p className="font-semibold text-slate-800">{lead.next_action}</p>
                </div>
              ) : (
                <p className="text-amber-800/80 italic text-[11px]">
                  No upcoming follow-up scheduled. Click "+ Schedule" to set reminder.
                </p>
              )}
            </div>

            {/* Touchpoints Quick Counts */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
              <div className="rounded-lg bg-indigo-50/70 p-1.5 border border-indigo-100">
                <span className="block text-[10px] text-indigo-600 font-bold uppercase">Calls</span>
                <span className="text-xs font-black text-indigo-950">{callsCount}</span>
              </div>
              <div className="rounded-lg bg-emerald-50/70 p-1.5 border border-emerald-100">
                <span className="block text-[10px] text-emerald-600 font-bold uppercase">WA</span>
                <span className="text-xs font-black text-emerald-950">{whatsappCount}</span>
              </div>
              <div className="rounded-lg bg-blue-50/70 p-1.5 border border-blue-100">
                <span className="block text-[10px] text-blue-600 font-bold uppercase">Email</span>
                <span className="text-xs font-black text-blue-950">{emailCount}</span>
              </div>
              <div className="rounded-lg bg-purple-50/70 p-1.5 border border-purple-100">
                <span className="block text-[10px] text-purple-600 font-bold uppercase">Meet</span>
                <span className="text-xs font-black text-purple-950">{meetingCount}</span>
              </div>
            </div>

            {/* Quick Switch to Communication Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab('communication')}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Go to Communication Center</span>
            </button>
          </div>

          {/* Project & Scope Details Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-indigo-600" />
              <span>Project & Requirements</span>
            </h3>

            <div className="space-y-3 text-xs">
              {lead.project_name && (
                <div>
                  <span className="text-slate-500 block font-medium mb-0.5">Project Name:</span>
                  <strong className="text-slate-900 font-semibold">{lead.project_name}</strong>
                </div>
              )}

              {lead.estimated_value ? (
                <div>
                  <span className="text-slate-500 block font-medium mb-0.5">Estimated Deal Value:</span>
                  <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{lead.estimated_value.toLocaleString()} SAR</span>
                  </div>
                </div>
              ) : null}

              {lead.expected_closing_date && (
                <div>
                  <span className="text-slate-500 block font-medium mb-0.5">Expected Closing:</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(lead.expected_closing_date).toLocaleDateString()}
                  </span>
                </div>
              )}

              {lead.next_action && (
                <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-2.5">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide block mb-0.5">
                    Next Follow-up Action
                  </span>
                  <p className="text-xs font-semibold text-amber-900">{lead.next_action}</p>
                </div>
              )}

              {lead.requirement && (
                <div>
                  <span className="text-slate-500 block font-medium mb-0.5">Requirement Summary:</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 whitespace-pre-line leading-relaxed">
                    {lead.requirement}
                  </p>
                </div>
              )}

              {lead.notes && (
                <div>
                  <span className="text-slate-500 block font-medium mb-0.5">Internal Notes:</span>
                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 whitespace-pre-line leading-relaxed">
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Files & Documents Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-indigo-600" />
                <span>Files & Documents</span>
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {attachments.length}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {attachments.length === 0
                ? 'No project documents attached yet. Attach quotations, drawings, or BOQs.'
                : `${attachments.length} ${attachments.length === 1 ? 'file' : 'files'} attached (${formatFileSize(
                    attachments.reduce((acc, c) => acc + (c.file_size || 0), 0)
                  )}).`}
            </p>

            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {attachments.slice(0, 3).map((att) => (
                  <div
                    key={att.id}
                    onClick={() => setActiveTab('attachments')}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:border-slate-300 hover:bg-slate-100/70 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate" title={att.file_name}>
                        {att.file_name}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 shrink-0">
                      {formatFileSize(att.file_size)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('attachments')}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>{attachments.length === 0 ? 'Attach First File' : 'Manage All Documents'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Communication Center, Activity Timeline & Attachments (8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Top Primary View Switcher Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2 pt-2 rounded-t-2xl shadow-2xs">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('communication')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'communication'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Communication Center</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    activeTab === 'communication'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {communicationActivities.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'timeline'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>Full Audit Timeline</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    activeTab === 'timeline'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {activities.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('attachments')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'attachments'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Paperclip className="h-4 w-4" />
                <span>Documents & Files</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    activeTab === 'attachments'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {attachments.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: Communication Center (Phase N Sales Communication Hub) */}
          {activeTab === 'communication' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <CommunicationCenter
                lead={lead}
                activities={activities}
                followups={followups}
                loadingActivities={loading}
                onLogActivity={handleLogActivitySubmit}
                onOpenScheduleFollowUp={(action) => {
                  if (action) setScheduleFollowUpInitialAction(action as FollowUpActionType);
                  setIsScheduleFollowUpModalOpen(true);
                }}
                hasAccess={hasAccess}
              />
            </div>
          )}

          {/* TAB 2: Activity Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Timeline Controls Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    <span>Interaction History & Timeline</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Complete chronological log of calls, messages, meetings, and document audits.
                  </p>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openLogModal('Call')}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>+ Call</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openLogModal('WhatsApp')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>+ WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openLogModal('Meeting')}
                    className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>+ Meeting</span>
                  </button>
                </div>
              </div>

              {/* Timeline Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-400 font-semibold px-1 flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                </span>
                {[
                  { id: 'all', label: `All (${activities.length})` },
                  { id: 'user', label: 'User Activities' },
                  { id: 'system', label: 'System Audits' },
                  { id: 'calls', label: 'Calls' },
                  { id: 'messages', label: 'WhatsApp / Email' },
                  { id: 'meetings', label: 'Meetings / Visits' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTimelineFilter(tab.id)}
                    className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                      timelineFilter === tab.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Chronological Timeline Container */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
                <ActivityTimeline
                  activities={filteredActivities}
                  loading={loading}
                  onLogFirstActivity={() => openLogModal('Call')}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Attachments & Documents */}
          {activeTab === 'attachments' && (
            <div className="animate-in fade-in duration-150">
              <AttachmentsSection
                leadId={lead.id}
                companyName={lead.company_name}
                attachments={attachments}
                loading={attachmentsLoading}
                canUpload={hasAccess}
                canDelete={hasAccess}
                onUpload={handleUploadAttachment}
                onDelete={handleDeleteAttachment}
              />
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Modals ---------------- */}

      {/* 1. Log Activity Modal */}
      <LogActivityModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        leadId={lead.id}
        companyName={lead.company_name}
        initialType={selectedActivityType}
        onSubmit={handleLogActivitySubmit}
      />

      {/* 2. Quick Contact Prompt */}
      <QuickContactPrompt
        isOpen={quickPrompt.isOpen}
        onClose={() => setQuickPrompt((p) => ({ ...p, isOpen: false }))}
        contactType={quickPrompt.type}
        companyName={lead.company_name}
        contactPerson={lead.contact_person || ''}
        onConfirmLog={(type) => openLogModal(type)}
      />

      {/* 3. Edit Lead Modal */}
      <EditLeadModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        lead={lead}
        onSave={handleSaveLeadInfo}
      />

      {/* 4. Reassign Lead Modal (Admin Only) */}
      {isAdmin && (
        <ReassignLeadModal
          isOpen={isReassignModalOpen}
          onClose={() => setIsReassignModalOpen(false)}
          leadId={lead.id}
          companyName={lead.company_name}
          currentOwnerId={lead.assigned_to}
          currentOwnerName={assignedSalesmanName}
          onReassign={handleReassignSubmit}
        />
      )}

      {/* 5. Schedule Follow-up Modal (Integrated Communication Center Action) */}
      <ScheduleFollowUpModal
        isOpen={isScheduleFollowUpModalOpen}
        onClose={() => setIsScheduleFollowUpModalOpen(false)}
        leads={lead ? [lead] : []}
        initialLeadId={lead?.id}
        initialAction={scheduleFollowUpInitialAction}
        users={usersList}
        onSchedule={async (input) => {
          await createFollowUp(input, userProfile?.role);
        }}
      />

      {/* 6. Convert Lead to Client Modal (Phase O) */}
      {lead && (
        <ConvertToClientModal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          lead={lead}
          onConverted={(createdClient) => {
            if (onNavigateToClient) {
              onNavigateToClient(createdClient.id);
            }
          }}
        />
      )}

      {/* 7. Tag Selector Modal (Phase R) */}
      {lead && (
        <TagSelectorModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          entityType="Lead"
          currentTags={lead.tags || []}
          onSelectTag={handleSelectTag}
          onRemoveTag={handleRemoveTag}
          entityName={lead.company_name}
        />
      )}

      {/* 8. Record Merge Modal (Phase S) */}
      {activeMergeCandidate && lead && (
        <RecordMergeModal
          isOpen={true}
          onClose={() => setActiveMergeCandidate(null)}
          entityType="Lead"
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
