import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, CheckCircle2, X } from 'lucide-react';
import { PipelineHeader, PipelineFilterState } from '../components/pipeline/PipelineHeader';
import { KanbanBoard } from '../components/pipeline/KanbanBoard';
import {
  LeadRecord,
  FollowUpRecord,
  UserProfile,
  LeadStatus,
} from '../types/database';
import {
  subscribeToLeads,
  subscribeToFollowUps,
  subscribeToUsers,
  filterActiveSalesmen,
  updateLeadStatus,
} from '../lib/dal';
import { isFollowUpOverdue, isFollowUpDueToday } from '../utils/dashboardUtils';
import { useAuth } from '../context/AuthContext';

interface PipelinePageProps {
  onOpenAddLead: () => void;
  onSelectLead?: (leadId: string) => void;
}

const INITIAL_FILTERS: PipelineFilterState = {
  search: '',
  priority: 'all',
  leadType: 'all',
  location: 'all',
  followupStatus: 'all',
  salesman: 'all',
};

export const PipelinePage: React.FC<PipelinePageProps> = ({
  onOpenAddLead,
  onSelectLead,
}) => {
  const { userProfile, isAdmin } = useAuth();

  // Core Data States
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeSalesmen, setActiveSalesmen] = useState<UserProfile[]>([]);

  // Filters State
  const [filters, setFilters] = useState<PipelineFilterState>(INITIAL_FILTERS);

  // Loading & Feedback States
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // 1. Real-time Subscriptions
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorNotice(null);

    const userRole = userProfile?.role;
    const userId = userProfile?.id;

    // Leads Subscription (Role-scoped)
    const unsubLeads = subscribeToLeads(
      (updatedLeads) => {
        if (!isMounted) return;
        setLeads(updatedLeads);
        setLoading(false);
      },
      userRole,
      (err) => {
        console.warn('Pipeline leads subscription notice:', err);
        if (isMounted) setLoading(false);
      },
      userId
    );

    // Follow-ups Subscription (Role-scoped)
    const unsubFollowups = subscribeToFollowUps(
      (updatedFollowups) => {
        if (!isMounted) return;
        setFollowups(updatedFollowups);
      },
      userRole,
      (err) => {
        console.warn('Pipeline follow-ups subscription notice:', err);
      },
      userId
    );

    // Users Subscription (For Sales Team & dynamic names)
    const unsubUsers = subscribeToUsers(
      (updatedUsers) => {
        if (!isMounted) return;
        setAllUsers(updatedUsers);
        setActiveSalesmen(filterActiveSalesmen(updatedUsers));
      },
      (err) => {
        console.warn('Pipeline users subscription notice:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubLeads();
      unsubFollowups();
      unsubUsers();
    };
  }, [userProfile?.role, userProfile?.id]);

  // 2. Filter & Search Logic
  const filteredLeads = useMemo(() => {
    // Build quick lookup for pending followups by lead_id
    const pendingFollowups = followups.filter((f) => f.status === 'pending');
    const leadFollowupMap = new Map<string, FollowUpRecord[]>();
    pendingFollowups.forEach((f) => {
      const arr = leadFollowupMap.get(f.lead_id) || [];
      arr.push(f);
      leadFollowupMap.set(f.lead_id, arr);
    });

    return leads.filter((lead) => {
      // 1. Search filter (company, contact, phone, whatsapp, email)
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const matchCompany = lead.company_name?.toLowerCase().includes(query);
        const matchContact = lead.contact_person?.toLowerCase().includes(query);
        const matchPhone = lead.phone?.includes(query);
        const matchWhatsApp = lead.whatsapp?.includes(query);
        const matchEmail = lead.email?.toLowerCase().includes(query);

        if (!matchCompany && !matchContact && !matchPhone && !matchWhatsApp && !matchEmail) {
          return false;
        }
      }

      // 2. Priority filter
      if (filters.priority !== 'all' && lead.priority !== filters.priority) {
        return false;
      }

      // 3. Lead Type filter
      if (filters.leadType !== 'all' && lead.lead_type !== filters.leadType) {
        return false;
      }

      // 4. Location filter
      if (filters.location !== 'all' && lead.location !== filters.location) {
        return false;
      }

      // 5. Salesman filter (Admin only)
      if (isAdmin && filters.salesman !== 'all' && lead.assigned_to !== filters.salesman) {
        return false;
      }

      // 6. Follow-up Status filter
      if (filters.followupStatus !== 'all') {
        const leadFus = leadFollowupMap.get(lead.id) || [];
        const hasPending = leadFus.length > 0;
        const hasOverdue = leadFus.some((f) => isFollowUpOverdue(f));
        const hasToday = leadFus.some((f) => isFollowUpDueToday(f));

        if (filters.followupStatus === 'has_followup' && !hasPending) return false;
        if (filters.followupStatus === 'no_followup' && hasPending) return false;
        if (filters.followupStatus === 'overdue' && !hasOverdue) return false;
        if (filters.followupStatus === 'today' && !hasToday) return false;
      }

      return true;
    });
  }, [leads, followups, filters, isAdmin]);

  // 3. Drag-and-Drop / Quick Status Change Handler with Optimistic UI & Rollback
  const handleStatusChange = useCallback(
    async (leadId: string, newStatus: LeadStatus) => {
      const currentLead = leads.find((l) => l.id === leadId);
      if (!currentLead) return;

      const prevStatus = currentLead.status;
      if (prevStatus === newStatus) return; // Same-column drag: no write, no timeline activity

      // Save previous state for rollback
      const previousLeads = [...leads];

      // Optimistic UI Update
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: newStatus, updated_at: new Date().toISOString() } : l
        )
      );

      try {
        await updateLeadStatus(
          leadId,
          newStatus,
          currentLead,
          userProfile?.id,
          userProfile?.full_name
        );

        setSuccessNotice(`Updated ${currentLead.company_name} stage to "${newStatus}"`);
        setTimeout(() => setSuccessNotice(null), 3000);
      } catch (err: any) {
        console.error('Failed to update lead status:', err);

        // Rollback on failure
        setLeads(previousLeads);
        setErrorNotice(
          `Failed to update stage in database: ${err?.message || 'Permission denied'}. Original stage restored.`
        );
        setTimeout(() => setErrorNotice(null), 6000);
      }
    },
    [leads, userProfile]
  );

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  // Loading Skeleton State
  if (loading && leads.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-slate-100 animate-pulse rounded-xl w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-76 shrink-0 h-96 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Notifications Bar */}
      {errorNotice && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-rose-500 hover:text-rose-700 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header, Search & Filters Bar */}
      <PipelineHeader
        leads={leads}
        followups={followups}
        salesmen={activeSalesmen}
        isAdmin={isAdmin}
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={handleResetFilters}
        onOpenAddLead={onOpenAddLead}
      />

      {/* Filter match count indicator when filtered */}
      {leads.length !== filteredLeads.length && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong>{filteredLeads.length}</strong> of {leads.length} accounts matching current filters.
          </span>
          <button
            type="button"
            onClick={handleResetFilters}
            className="font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Visual Kanban Board */}
      <KanbanBoard
        leads={filteredLeads}
        followups={followups}
        users={allUsers}
        isAdmin={isAdmin}
        onSelectLead={onSelectLead}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};
