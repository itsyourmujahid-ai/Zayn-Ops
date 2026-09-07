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
} from 'lucide-react';
import {
  ClientRecord,
  UserProfile,
  ClientStatus,
  FollowUpRecord,
  LeadActivityRecord,
} from '../types/database';
import {
  subscribeToClients,
  getAllUsers,
  getUserDisplayName,
  updateClient,
  subscribeToFollowUps,
  subscribeToAllActivities,
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [needsFollowUpOnly, setNeedsFollowUpOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'status' | 'last_contact'>('recent');
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

  // Subscribe to follow-ups for relationship indicators
  useEffect(() => {
    const unsub = subscribeToFollowUps(
      (list) => setFollowups(list),
      userProfile?.role
    );
    return () => unsub();
  }, [userProfile?.role]);

  // Subscribe to activities for last contact calculation
  useEffect(() => {
    const unsub = subscribeToAllActivities(
      (list) => setActivities(list),
      userProfile?.role
    );
    return () => unsub();
  }, [userProfile?.role]);

  // Derived relationship maps for each client
  const { followUpsByLead, activitiesByLead } = useMemo(() => {
    const fuMap = new Map<string, FollowUpRecord[]>();
    followups.forEach((fu) => {
      const list = fuMap.get(fu.lead_id) || [];
      list.push(fu);
      fuMap.set(fu.lead_id, list);
    });

    const actMap = new Map<string, LeadActivityRecord[]>();
    activities.forEach((act) => {
      const list = actMap.get(act.lead_id) || [];
      list.push(act);
      actMap.set(act.lead_id, list);
    });

    return { followUpsByLead: fuMap, activitiesByLead: actMap };
  }, [followups, activities]);

  // Helper to compute client relationship state
  const getClientRelationshipData = (client: ClientRecord) => {
    const clientFus = followUpsByLead.get(client.source_lead_id) || [];
    const clientActs = activitiesByLead.get(client.source_lead_id) || [];

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

    // Needs follow-up if: has overdue follow-up OR has no pending follow-up at all
    const needsFollowUp = isOverdue || !nextFollowUp;

    return {
      nextFollowUp,
      isOverdue,
      lastContact,
      needsFollowUp,
    };
  };

  // Derived statistics for summary strip
  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === 'Active').length;
    const inactive = clients.filter((c) => c.status === 'Inactive').length;
    const myClients = clients.filter(
      (c) => c.owner_id === userProfile?.id || c.owner_id === currentUser?.uid
    ).length;

    // Count clients needing follow-up
    let needingFollowUpCount = 0;
    clients.forEach((c) => {
      const rel = getClientRelationshipData(c);
      if (rel.needsFollowUp && c.status === 'Active') {
        needingFollowUpCount++;
      }
    });

    return { total, active, inactive, myClients, needingFollowUpCount };
  }, [clients, userProfile?.id, currentUser?.uid, followUpsByLead, activitiesByLead]);

  // Filtered and sorted clients
  const filteredClients = useMemo(() => {
    return clients
      .filter((c) => {
        // Search filter: company, contact_person, phone, whatsapp, email, location
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

        // Status filter
        if (statusFilter !== 'all' && c.status !== statusFilter) {
          return false;
        }

        // Owner filter (Admin only)
        if (ownerFilter !== 'all' && c.owner_id !== ownerFilter) {
          return false;
        }

        // Client type filter
        if (typeFilter !== 'all' && c.client_type !== typeFilter) {
          return false;
        }

        // Needs follow-up filter
        if (needsFollowUpOnly) {
          const rel = getClientRelationshipData(c);
          if (!rel.needsFollowUp) return false;
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
            ? new Date(relA.lastContact.activity_date || relA.lastContact.activity_at).getTime()
            : 0;
          const timeB = relB.lastContact
            ? new Date(relB.lastContact.activity_date || relB.lastContact.activity_at).getTime()
            : 0;
          return timeB - timeA;
        }
        // default recent conversion
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [
    clients,
    searchQuery,
    statusFilter,
    ownerFilter,
    typeFilter,
    needsFollowUpOnly,
    sortBy,
    followUpsByLead,
    activitiesByLead,
  ]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setOwnerFilter('all');
    setTypeFilter('all');
    setNeedsFollowUpOnly(false);
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
    needsFollowUpOnly ||
    sortBy !== 'recent';

  const handleToggleStatus = async (e: React.MouseEvent, client: ClientRecord) => {
    e.stopPropagation();
    const newStatus: ClientStatus = client.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await updateClient(client.id, { status: newStatus }, client);
    } catch (err) {
      console.error('Failed to toggle client status:', err);
    }
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
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ---------------- Page Header Banner ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Clients & Customer Accounts
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              {clients.length} Accounts
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Long-term client relationship management, post-sale follow-ups, and repeat sales opportunities.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Security & Role Scope Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>
              {isAdmin ? 'All Enterprise Clients (Admin Scope)' : 'My Assigned Customer Portfolio'}
            </span>
          </div>

          {/* Add Client Button */}
          {canCreateClient && (
            <button
              type="button"
              id="clients-add-new-btn"
              onClick={() => setIsCreateClientOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Client</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------- Metrics & Summary Strip (Section 15) ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total / My Clients */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isAdmin ? 'Total Clients' : 'My Accounts'}
            </span>
            <Building2 className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {isAdmin ? stats.total : stats.myClients}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {isAdmin ? 'Converted Deals' : 'In Portfolio'}
            </span>
          </div>
        </div>

        {/* Card 2: Active Accounts */}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Active Accounts</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-950">{stats.active}</span>
            <span className="text-[11px] font-semibold text-emerald-700">In Business</span>
          </div>
        </div>

        {/* Card 3: Inactive / On Hold (Admin) OR Active Ratio (Salesman) */}
        {isAdmin ? (
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Inactive / On Hold</span>
              <Briefcase className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{stats.inactive}</span>
              <span className="text-[11px] font-semibold text-slate-400">Dormant</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Direct Portfolio</span>
              <UserCheck className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{stats.myClients}</span>
              <span className="text-[11px] font-semibold text-slate-400">Assigned</span>
            </div>
          </div>
        )}

        {/* Card 4: Clients Needing Follow-up (Section 15 Mandate) */}
        <div
          onClick={() => setNeedsFollowUpOnly(!needsFollowUpOnly)}
          className={`rounded-xl border p-4 shadow-2xs transition cursor-pointer ${
            needsFollowUpOnly
              ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/20'
              : stats.needingFollowUpCount > 0
              ? 'border-amber-200/90 bg-amber-50/40 hover:border-amber-300'
              : 'border-slate-200/90 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900">
              Needs Follow-up
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-950">
              {stats.needingFollowUpCount}
            </span>
            <span className="text-[11px] font-semibold text-amber-800">
              {needsFollowUpOnly ? 'Filter Active' : 'Overdue / None'}
            </span>
          </div>
        </div>
      </div>

      {/* ---------------- Filter & Search Controls ---------------- */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company, contact person, phone, WhatsApp, email, or city..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 focus:border-indigo-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs font-semibold text-slate-700 focus:border-indigo-600 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active Accounts</option>
              <option value="Inactive">Inactive Accounts</option>
            </select>

            {/* Owner Filter (Admin only) */}
            {isAdmin && (
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs font-semibold text-slate-700 focus:border-indigo-600 focus:outline-none cursor-pointer"
              >
                <option value="all">All Representatives</option>
                {allUsers
                  .filter((u) => u.role === 'SALESMAN' || u.role === 'sales_rep')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email.split('@')[0]})
                    </option>
                  ))}
              </select>
            )}

            {/* Client Classification Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs font-semibold text-slate-700 focus:border-indigo-600 focus:outline-none cursor-pointer"
            >
              <option value="all">All Classifications</option>
              <option value="B2B Commercial">B2B Commercial</option>
              <option value="Enterprise Corporate">Enterprise Corporate</option>
              <option value="Channel Partner">Channel Partner</option>
              <option value="Vendor / Supplier">Vendor / Supplier</option>
              <option value="Individual">Individual</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs font-semibold text-slate-700 focus:border-indigo-600 focus:outline-none cursor-pointer"
            >
              <option value="recent">Recently Converted</option>
              <option value="name">Company Name (A–Z)</option>
              <option value="status">Account Status</option>
              <option value="last_contact">Recently Contacted</option>
            </select>

            {/* Select All Toggle for Bulk Actions */}
            {filteredClients.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                  selectedClientIds.size > 0
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedClientIds.size > 0 && selectedClientIds.size === filteredClients.length}
                  onChange={handleToggleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 rounded-sm border-slate-300 text-emerald-600 cursor-pointer"
                />
                <span>{selectedClientIds.size > 0 ? `${selectedClientIds.size} Selected` : 'Select All'}</span>
              </button>
            )}

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- Client Records Directory ---------------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-xs font-semibold text-slate-500">Loading client directory...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-100">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {hasActiveFilters ? 'No clients match your filter criteria' : 'No Converted Clients Yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
            {hasActiveFilters
              ? 'Try adjusting your search query or reset the filters to see all available client accounts.'
              : 'When a lead reaches the "Won" stage, use the "Convert to Client" action on the lead details screen to establish permanent customer accounts.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear Filter Criteria</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const ownerName = client.owner_name || getUserDisplayName(client.owner_id, allUsers);
            const isActive = client.status === 'Active';
            const rel = getClientRelationshipData(client);

            return (
              <div
                key={client.id}
                onClick={() => onSelectClient(client.id)}
                className={`group relative rounded-2xl border p-5 shadow-2xs transition cursor-pointer flex flex-col justify-between ${
                  selectedClientIds.has(client.id)
                    ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200/90 bg-white hover:border-emerald-500/80 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top Badges: Classification & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedClientIds.has(client.id)}
                        onChange={() => toggleClientSelect(client.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${client.company_name}`}
                        className="h-4 w-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                        <Tag className="h-3 w-3" />
                        {client.client_type || 'B2B'}
                      </span>
                    </div>

                    {/* Status Toggle Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleStatus(e, client)}
                      title="Click to toggle status"
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isActive ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span>{client.status}</span>
                    </button>
                  </div>

                  {/* Company Name */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition tracking-tight">
                    {client.company_name}
                  </h3>

                  {/* Contact Person & City */}
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {client.contact_person && (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">{client.contact_person}</span>
                      </div>
                    )}
                    {client.location && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{client.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Representative Assignment Badge */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Representative:</span>
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                      <span>{ownerName}</span>
                    </span>
                  </div>

                  {/* Post-Sale Indicators: Last Contact & Next Follow-up (Section 18) */}
                  <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    {/* Last Contact */}
                    <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">Last Contact:</span>
                      {rel.lastContact ? (
                        <div className="font-semibold text-slate-800 truncate mt-0.5">
                          <span className="text-indigo-700 font-bold">{rel.lastContact.activity_type}</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span>{formatTimestamp(rel.lastContact.activity_date || rel.lastContact.activity_at)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No activity yet</span>
                      )}
                    </div>

                    {/* Next Follow-up */}
                    <div
                      className={`p-2 rounded-lg border ${
                        rel.isOverdue
                          ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                          : rel.nextFollowUp
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                          : 'bg-slate-50/80 border-slate-100 text-slate-500'
                      }`}
                    >
                      <span className="block font-medium opacity-75">
                        {rel.isOverdue ? 'Overdue Follow-up:' : 'Next Follow-up:'}
                      </span>
                      {rel.nextFollowUp ? (
                        <div className="font-bold truncate mt-0.5">
                          <span>{rel.nextFollowUp.action}</span>
                          <span className="opacity-60 mx-1">·</span>
                          <span>{formatTimestamp(rel.nextFollowUp.scheduled_at)}</span>
                        </div>
                      ) : (
                        <span className="italic opacity-70">None scheduled</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Quick Contact Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        title="Direct Phone Call"
                        className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 flex items-center justify-center transition"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {client.whatsapp && (
                      <a
                        href={`https://wa.me/${client.whatsapp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="WhatsApp Chat"
                        className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 flex items-center justify-center transition"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {client.email && (
                      <a
                        href={`mailto:${client.email}`}
                        onClick={(e) => e.stopPropagation()}
                        title="Send Email"
                        className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 flex items-center justify-center transition"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 group-hover:translate-x-0.5 transition">
                    <span>Manage Client</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Action Bar for Selected Clients */}
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
