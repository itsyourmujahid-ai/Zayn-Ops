import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Building2,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  User,
  UserCheck,
  RotateCcw,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Tag,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  ArrowUpRight,
  Clock,
  CalendarPlus,
  AlertTriangle,
  Plus,
  LayoutGrid,
  List,
  PauseCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ClientRecord,
  UserProfile,
  ClientStatus,
  FollowUpRecord,
  LeadActivityRecord,
  LeadRecord,
} from '../types/database';
import {
  subscribeToClients,
  getAllUsers,
  getUserDisplayName,
  updateClient,
  subscribeToFollowUps,
  subscribeToAllActivities,
  subscribeToLeads,
} from '../lib/dal';
import { BulkActionToolbar } from '../components/common/BulkActionToolbar';
import { CreateClientModal } from '../components/clients/CreateClientModal';
import { useAuth } from '../context/AuthContext';

interface ClientsPageProps {
  onSelectClient: (clientId: string) => void;
  onNavigateToLead: (leadId: string) => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({
  onSelectClient,
  onNavigateToLead,
}) => {
  const { userProfile, currentUser, isAdmin, isSuperAdmin, hasPermission } = useAuth();
  const canCreateClient = !isSuperAdmin && (isAdmin || hasPermission('CLIENTS_CREATE') || userProfile?.role === 'SALESMAN');

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [allLeads, setAllLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus | 'needs_follow_up'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'status' | 'last_contact'>('recent');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [isCreateClientOpen, setIsCreateClientOpen] = useState<boolean>(false);

  // Load team members
  useEffect(() => {
    getAllUsers()
      .then((users) => setAllUsers(users))
      .catch((e) => console.warn('Failed to load users for clients filter:', e));
  }, []);

  // Subscribe to clients (Admin sees all; Salesman sees owned)
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = subscribeToClients(
      (clientList) => {
        setClients(clientList);
        setLoading(false);
      },
      userProfile?.role,
      (err) => {
        console.warn('Subscription error for clients:', err);
        setError('Notice: Operating with real-time local cache synchronization.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userProfile?.role]);

  // Subscribe to follow-ups
  useEffect(() => {
    const unsub = subscribeToFollowUps(
      (list) => setFollowups(list),
      userProfile?.role
    );
    return () => unsub();
  }, [userProfile?.role]);

  // Subscribe to all activities for relationship history
  useEffect(() => {
    const unsub = subscribeToAllActivities(
      (list) => setActivities(list),
      userProfile?.role
    );
    return () => unsub();
  }, [userProfile?.role]);

  // Subscribe to leads for counting related opportunities
  useEffect(() => {
    const unsub = subscribeToLeads(
      (leads) => setAllLeads(leads),
      userProfile?.role
    );
    return () => unsub();
  }, [userProfile?.role]);

  // Helper to compute client relationship state
  const getClientRelationshipData = (client: ClientRecord) => {
    // Collect all follow-ups matching this client
    const clientFus = followups.filter(
      (f) =>
        f.client_id === client.id ||
        f.lead_id === client.id ||
        f.lead_id === client.source_lead_id ||
        (client.related_lead_ids && client.related_lead_ids.includes(f.lead_id))
    );

    // Collect all activities matching this client
    const clientActs = activities.filter(
      (a) =>
        a.client_id === client.id ||
        a.lead_id === client.id ||
        a.lead_id === client.source_lead_id ||
        (client.related_lead_ids && client.related_lead_ids.includes(a.lead_id))
    );

    // Collect all leads matching this client
    const clientLeads = allLeads.filter(
      (l) =>
        l.client_id === client.id ||
        l.id === client.source_lead_id ||
        (client.related_lead_ids && client.related_lead_ids.includes(l.id)) ||
        (l.company_name && l.company_name.toLowerCase() === client.company_name.toLowerCase())
    );

    const openLeadsCount = clientLeads.filter(
      (l) => l.status !== 'Won' && l.status !== 'Lost'
    ).length;

    // Pending follow-ups
    const pending = clientFus
      .filter((f) => f.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    const nextFollowUp = pending[0] || null;
    const isOverdue = nextFollowUp
      ? new Date(nextFollowUp.scheduled_at).getTime() < Date.now()
      : false;

    // Last contact (Call, WhatsApp, Email, Meeting, Site Visit)
    const contactTypes = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Site Visit'];
    const contactActs = clientActs
      .filter((a) => contactTypes.includes(a.activity_type) && !a.is_system_activity)
      .sort((a, b) => {
        const timeA = new Date(a.activity_date || a.activity_at || a.created_at).getTime();
        const timeB = new Date(b.activity_date || b.activity_at || b.created_at).getTime();
        return timeB - timeA;
      });

    const lastContact = contactActs[0] || null;

    // Last activity overall (including notes and updates)
    const sortedAllActs = [...clientActs].sort((a, b) => {
      const timeA = new Date(a.activity_date || a.activity_at || a.created_at).getTime();
      const timeB = new Date(b.activity_date || b.activity_at || b.created_at).getTime();
      return timeB - timeA;
    });
    const lastActivity = sortedAllActs[0] || null;

    // Needs follow-up if: has overdue follow-up OR has no pending follow-up at all
    const needsFollowUp = isOverdue || !nextFollowUp;

    return {
      nextFollowUp,
      isOverdue,
      lastContact,
      lastActivity,
      openLeadsCount,
      totalLeadsCount: clientLeads.length,
      needsFollowUp,
    };
  };

  // Derived statistics for summary strip
  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === 'Active').length;
    const dormant = clients.filter((c) => c.status === 'Dormant').length;
    const inactive = clients.filter((c) => c.status === 'Inactive').length;
    const myClients = clients.filter(
      (c) => c.owner_id === userProfile?.id || c.owner_id === currentUser?.uid
    ).length;

    let needingFollowUpCount = 0;
    clients.forEach((c) => {
      const rel = getClientRelationshipData(c);
      if (rel.needsFollowUp && (c.status === 'Active' || c.status === 'Dormant')) {
        needingFollowUpCount++;
      }
    });

    return { total, active, dormant, inactive, myClients, needingFollowUpCount };
  }, [clients, userProfile?.id, currentUser?.uid, followups, activities, allLeads]);

  // Filtered and sorted clients
  const filteredClients = useMemo(() => {
    return clients
      .filter((c) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCompany = c.company_name?.toLowerCase().includes(q);
          const matchPerson = c.contact_person?.toLowerCase().includes(q);
          const matchEmail = c.email?.toLowerCase().includes(q);
          const matchPhone = c.phone?.toLowerCase().includes(q);
          const matchWhatsApp = c.whatsapp?.toLowerCase().includes(q);
          const matchLocation = c.location?.toLowerCase().includes(q);
          if (
            !matchCompany &&
            !matchPerson &&
            !matchEmail &&
            !matchPhone &&
            !matchWhatsApp &&
            !matchLocation
          ) {
            return false;
          }
        }

        // Status tab filter
        if (statusFilter === 'needs_follow_up') {
          const rel = getClientRelationshipData(c);
          if (!rel.needsFollowUp) return false;
        } else if (statusFilter !== 'all') {
          if (c.status !== statusFilter) return false;
        }

        // Owner filter
        if (ownerFilter !== 'all' && c.owner_id !== ownerFilter) {
          return false;
        }

        // Client type filter
        if (typeFilter !== 'all' && c.client_type !== typeFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.company_name.localeCompare(b.company_name);
        }
        if (sortBy === 'status') {
          return a.status.localeCompare(b.status);
        }
        if (sortBy === 'last_contact') {
          const relA = getClientRelationshipData(a);
          const relB = getClientRelationshipData(b);
          const timeA = relA.lastContact
            ? new Date(relA.lastContact.activity_date || relA.lastContact.activity_at || 0).getTime()
            : 0;
          const timeB = relB.lastContact
            ? new Date(relB.lastContact.activity_date || relB.lastContact.activity_at || 0).getTime()
            : 0;
          return timeB - timeA;
        }
        // default recent conversion / creation
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [
    clients,
    searchQuery,
    statusFilter,
    ownerFilter,
    typeFilter,
    sortBy,
    followups,
    activities,
    allLeads,
  ]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setOwnerFilter('all');
    setTypeFilter('all');
    setSortBy('recent');
  };

  const toggleClientSelect = (clientId: string) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedClientIds.size === filteredClients.length && filteredClients.length > 0) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const selectedClientsList = useMemo(() => {
    return clients.filter((c) => selectedClientIds.has(c.id));
  }, [clients, selectedClientIds]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    ownerFilter !== 'all' ||
    typeFilter !== 'all' ||
    sortBy !== 'recent';

  const handleUpdateStatus = async (
    e: React.MouseEvent,
    client: ClientRecord,
    newStatus: ClientStatus
  ) => {
    e.stopPropagation();
    try {
      await updateClient(client.id, { status: newStatus }, client);
    } catch (err) {
      console.error('Failed to update client status:', err);
    }
  };

  const formatDateOnly = (isoString?: string) => {
    if (!isoString) return 'None';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'None';
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) return 'Today';

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        return 'Yesterday';
      }

      return date.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return 'None';
    }
  };

  const getStatusBadge = (status: ClientStatus | string) => {
    switch (status) {
      case 'Active':
        return {
          label: 'Active',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-500',
        };
      case 'Dormant':
        return {
          label: 'Dormant',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          dotClass: 'bg-amber-500',
        };
      case 'Inactive':
        return {
          label: 'Inactive',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
          dotClass: 'bg-slate-400',
        };
      default:
        return {
          label: status || 'Active',
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
          dotClass: 'bg-slate-400',
        };
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* ---------------- Page Header Banner ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Clients &amp; Relationships
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {clients.length} Accounts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Long-term customer relationships, ongoing interactions, and multi-project history.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200/90 bg-white text-xs font-medium text-slate-600 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.75} />
            <span>{isAdmin ? 'All Clients (Admin)' : 'My Portfolio'}</span>
          </div>

          {/* View Toggle (Table / Grid) */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View (Compact)"
              className={`rounded-md p-1.5 cursor-pointer transition ${
                viewMode === 'table' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Cards View"
              className={`rounded-md p-1.5 cursor-pointer transition ${
                viewMode === 'grid' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Add Client Button */}
          {canCreateClient && (
            <button
              type="button"
              id="clients-add-new-btn"
              onClick={() => setIsCreateClientOpen(true)}
              className="zaynops-btn-primary py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>Add Client</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------- Metrics & Summary Strip (Section 15) ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Accounts */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {isAdmin ? 'Total Clients' : 'My Accounts'}
            </span>
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              {isAdmin ? stats.total : stats.myClients}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Relationships</span>
          </div>
        </div>

        {/* Active Accounts */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Active' ? 'all' : 'Active')}
          className={`rounded-xl border p-3 shadow-2xs transition cursor-pointer ${
            statusFilter === 'Active' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
              Active
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-emerald-700">{stats.active}</span>
            <span className="text-[10px] text-slate-400 font-medium">Ongoing</span>
          </div>
        </div>

        {/* Dormant Accounts */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Dormant' ? 'all' : 'Dormant')}
          className={`rounded-xl border p-3 shadow-2xs transition cursor-pointer ${
            statusFilter === 'Dormant' ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              Dormant
            </span>
            <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-amber-700">{stats.dormant}</span>
            <span className="text-[10px] text-slate-400 font-medium">No recent act.</span>
          </div>
        </div>

        {/* Inactive Accounts */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Inactive' ? 'all' : 'Inactive')}
          className={`rounded-xl border p-3 shadow-2xs transition cursor-pointer ${
            statusFilter === 'Inactive' ? 'border-slate-400 bg-slate-100/50' : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Inactive
            </span>
            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-700">{stats.inactive}</span>
            <span className="text-[10px] text-slate-400 font-medium">Closed / Paused</span>
          </div>
        </div>

        {/* Needs Follow-up */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'needs_follow_up' ? 'all' : 'needs_follow_up')}
          className={`rounded-xl border p-3 shadow-2xs transition cursor-pointer col-span-2 lg:col-span-1 ${
            statusFilter === 'needs_follow_up' ? 'border-rose-400 bg-rose-50/60' : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
              Needs Attention
            </span>
            <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-rose-700">
              {stats.needingFollowUpCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Overdue/None</span>
          </div>
        </div>
      </div>

      {/* ---------------- Filter & Search Bar ---------------- */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs space-y-3">
        {/* Status Category Pills */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {[
              { key: 'all', label: 'All Clients', count: stats.total },
              { key: 'Active', label: 'Active', count: stats.active },
              { key: 'Dormant', label: 'Dormant', count: stats.dormant },
              { key: 'Inactive', label: 'Inactive', count: stats.inactive },
              { key: 'needs_follow_up', label: 'Needs Follow-up', count: stats.needingFollowUpCount },
            ].map((tab) => {
              const isSelected = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selection indicator if items selected */}
          {selectedClientIds.size > 0 && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
              {selectedClientIds.size} selected
            </span>
          )}
        </div>

        {/* Filter Controls: Search, Owner, Sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client, company, phone, email, location..."
              className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Owner Filter (Admin only) */}
            {isAdmin && (
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs font-semibold text-slate-700 focus:border-emerald-600 focus:outline-none cursor-pointer"
              >
                <option value="all">All Owners</option>
                {allUsers
                  .filter((u) => u.role === 'SALESMAN' || u.role === 'sales_rep')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
              </select>
            )}

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs font-semibold text-slate-700 focus:border-emerald-600 focus:outline-none cursor-pointer"
            >
              <option value="recent">Recently Added</option>
              <option value="name">Company Name (A–Z)</option>
              <option value="status">Status</option>
              <option value="last_contact">Recently Contacted</option>
            </select>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- Client Directory Presentation ---------------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-xs font-semibold text-slate-500">Loading client directory...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 border border-emerald-100">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {hasActiveFilters ? 'No clients match your filter criteria' : 'No Clients Recorded Yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
            {hasActiveFilters
              ? 'Try adjusting your search query or reset the filters to see all available client accounts.'
              : 'Add clients directly or convert won leads to establish long-term customer relationships.'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear Filter Criteria</span>
            </button>
          ) : (
            canCreateClient && (
              <button
                type="button"
                onClick={() => setIsCreateClientOpen(true)}
                className="zaynops-btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span>Add Client</span>
              </button>
            )
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ---------------- Minimalist, Specific Columns Table View (Section 2) ---------------- */
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3 px-3.5 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedClientIds.size > 0 &&
                        selectedClientIds.size === filteredClients.length
                      }
                      onChange={handleToggleSelectAll}
                      className="h-3.5 w-3.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 min-w-[140px]">Client</th>
                  <th className="py-3 px-3 min-w-[150px]">Company</th>
                  <th className="py-3 px-3 min-w-[110px]">Owner</th>
                  <th className="py-3 px-3 min-w-[100px]">Status</th>
                  <th className="py-3 px-3 min-w-[125px]">Last Contact</th>
                  <th className="py-3 px-3 min-w-[130px]">Next Follow-up</th>
                  <th className="py-3 px-3 min-w-[80px] text-center">Open Leads</th>
                  <th className="py-3 px-3 min-w-[150px]">Last Activity</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredClients.map((client) => {
                  const ownerName =
                    client.owner_name || getUserDisplayName(client.owner_id, allUsers);
                  const rel = getClientRelationshipData(client);
                  const statusVisual = getStatusBadge(client.status);
                  const isSelected = selectedClientIds.has(client.id);

                  return (
                    <tr
                      key={client.id}
                      onClick={() => onSelectClient(client.id)}
                      className={`hover:bg-slate-50/80 transition cursor-pointer group ${
                        isSelected ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleClientSelect(client.id)}
                          className="h-3.5 w-3.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* 1. Client (Name / Contact Person) */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition truncate max-w-[160px]">
                          {client.contact_person || client.name || 'Primary Contact'}
                        </div>
                        {client.phone && (
                          <div className="text-[11px] text-slate-400 font-normal truncate">
                            {client.phone}
                          </div>
                        )}
                      </td>

                      {/* 2. Company */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 truncate max-w-[170px]" title={client.company_name}>
                          {client.company_name}
                        </div>
                        {client.location && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 text-slate-300 shrink-0" />
                            <span>{client.location}</span>
                          </div>
                        )}
                      </td>

                      {/* 3. Owner */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md text-[11px]">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{ownerName}</span>
                        </span>
                      </td>

                      {/* 4. Status (Active, Dormant, Inactive) */}
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <select
                            value={client.status || 'Active'}
                            onChange={(e) =>
                              handleUpdateStatus(e as any, client, e.target.value as ClientStatus)
                            }
                            className={`inline-flex items-center text-[11px] font-bold py-0.5 px-2 rounded-md border transition cursor-pointer appearance-none pr-5 ${statusVisual.badgeClass}`}
                          >
                            <option value="Active">Active</option>
                            <option value="Dormant">Dormant</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                          <span
                            className={`absolute right-1.5 top-2 h-1.5 w-1.5 rounded-full pointer-events-none ${statusVisual.dotClass}`}
                          />
                        </div>
                      </td>

                      {/* 5. Last Contact (Date + Type, e.g., 12 Sep · Call) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {rel.lastContact ? (
                          <div className="text-xs">
                            <span className="font-semibold text-slate-800">
                              {formatDateOnly(
                                rel.lastContact.activity_date ||
                                  rel.lastContact.activity_at ||
                                  rel.lastContact.created_at
                              )}
                            </span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span className="text-emerald-700 font-bold text-[11px]">
                              {rel.lastContact.activity_type}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No contact yet</span>
                        )}
                      </td>

                      {/* 6. Next Follow-up (Date + Action, e.g., 22 Sep · Meeting) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {rel.nextFollowUp ? (
                          <div
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                              rel.isOverdue
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                            }`}
                          >
                            {rel.isOverdue && <AlertCircle className="h-3 w-3 text-rose-600 shrink-0" />}
                            <span>{formatDateOnly(rel.nextFollowUp.scheduled_at)}</span>
                            <span className="opacity-50">·</span>
                            <span className="font-bold">{rel.nextFollowUp.action}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* 7. Open Leads (Count of open opportunities) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-bold border ${
                            rel.openLeadsCount > 0
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {rel.openLeadsCount}
                        </span>
                      </td>

                      {/* 8. Last Activity (Recent activity summary) */}
                      <td className="py-3 px-3">
                        {rel.lastActivity ? (
                          <div className="text-xs truncate max-w-[170px]" title={rel.lastActivity.description || rel.lastActivity.notes}>
                            <span className="font-semibold text-slate-800">
                              {rel.lastActivity.activity_type}
                            </span>
                            {rel.lastActivity.outcome && (
                              <span className="text-slate-500 text-[11px] ml-1">
                                ({rel.lastActivity.outcome})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition">
                          <span>View</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ---------------- Card Grid View Option ---------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredClients.map((client) => {
            const ownerName =
              client.owner_name || getUserDisplayName(client.owner_id, allUsers);
            const rel = getClientRelationshipData(client);
            const statusVisual = getStatusBadge(client.status);
            const isSelected = selectedClientIds.has(client.id);

            return (
              <div
                key={client.id}
                onClick={() => onSelectClient(client.id)}
                className={`group rounded-xl border p-4 shadow-2xs transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20'
                    : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md border ${statusVisual.badgeClass}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusVisual.dotClass}`} />
                      <span>{statusVisual.label}</span>
                    </span>

                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      <span>{ownerName}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition truncate">
                    {client.company_name}
                  </h3>

                  {client.contact_person && (
                    <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                      {client.contact_person}
                    </p>
                  )}

                  {/* Relationship Highlights */}
                  <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">Last Contact</span>
                      <span className="font-semibold text-slate-800 truncate block mt-0.5">
                        {rel.lastContact
                          ? `${formatDateOnly(rel.lastContact.activity_date)} · ${rel.lastContact.activity_type}`
                          : 'None'}
                      </span>
                    </div>

                    <div
                      className={`p-2 rounded-lg ${
                        rel.isOverdue
                          ? 'bg-rose-50 text-rose-800'
                          : rel.nextFollowUp
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="block text-[10px] opacity-75">
                        {rel.isOverdue ? 'Overdue Follow-up' : 'Next Follow-up'}
                      </span>
                      <span className="font-bold truncate block mt-0.5">
                        {rel.nextFollowUp
                          ? `${formatDateOnly(rel.nextFollowUp.scheduled_at)} · ${rel.nextFollowUp.action}`
                          : 'None'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium text-[11px]">
                    {rel.openLeadsCount} Open {rel.openLeadsCount === 1 ? 'Lead' : 'Leads'}
                  </span>

                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 group-hover:translate-x-0.5 transition">
                    <span>Manage</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionToolbar
        mode="clients"
        selectedItems={selectedClientsList}
        allTeamUsers={allUsers}
        onClearSelection={() => setSelectedClientIds(new Set())}
        onOperationComplete={() => setSelectedClientIds(new Set())}
      />

      {/* Create Client Modal */}
      <CreateClientModal
        isOpen={isCreateClientOpen}
        onClose={() => setIsCreateClientOpen(false)}
        onCreated={(newClient) => {
          onSelectClient(newClient.id);
        }}
      />
    </div>
  );
};
